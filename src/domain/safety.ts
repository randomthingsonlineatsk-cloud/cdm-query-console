// SAE reconciliation: the clinical database (EDC) against the fictional sponsor safety
// database, field by field, at an agreed cut-off. Each discrepancy is classed as an EDC
// error (query the site), a safety database error (note to the safety team), an acceptable
// difference, an SAE not reported to safety, or an SAE missing from the EDC.

import type { Project, SaeClass, ReconDecision, Signature } from './types'
import { seedStudy, SAE_SUBJECTS, type Entry } from './seed'
import { ACTIVE, OST_ID } from './study'
import { OST_SAE_SUBJECTS } from './ost/seed'
import { formsOfSubject } from './engine'
import { audit, me, nowUtc, raiseManual, value, SYSTEM, seedEntry } from './project'
import { SMD, exactLlt, ptOf } from './dictmed'
import { smd, TERM_FIELD } from './coding'
import { addDays, daysBetween } from './util'
import { isActive } from './queries'

export const CRITERIA = ['AESDTH', 'AESLIFE', 'AESHOSP', 'AESDISAB', 'AESCONG', 'AESMIE'] as const
export const CRIT_LABEL: Record<string, string> = { AESDTH: 'death', AESLIFE: 'life-threatening', AESHOSP: 'hospitalisation', AESDISAB: 'disability', AESCONG: 'congenital anomaly', AESMIE: 'medically important' }
export interface SafetyCase {
  caseId: string; subj: string; term: string; onset: string; end: string; criteria: string[]
  outcome: string; causality: string; sponsorCausality: string; action: string; aware: string; received: string
  edcForm?: string // the seed AE this case was reported from (answer key only)
}
export const FIELDS = ['subject', 'term', 'onset', 'end', 'criteria', 'outcome', 'causality', 'action'] as const
export type Field = (typeof FIELDS)[number]
export const FIELD_LABEL: Record<Field, string> = { subject: 'Subject', term: 'Event term', onset: 'Onset date', end: 'Resolution date', criteria: 'Seriousness criteria', outcome: 'Outcome', causality: 'Causality (investigator)', action: 'Action with study drug' }

const casePrefix = () => (ACTIVE.id === OST_ID ? 'HRP' : 'HAL')
const LATE_REPORT = ['103-005', '106-007', '303-006']
const fromEntry = (e: Entry, n: number): SafetyCase => ({
  caseId: `${casePrefix()}-2026-${String(n).padStart(5, '0')}`, subj: e.subj, term: e.truth.AETERM, onset: e.truth.AESTDAT, end: e.truth.AEENDAT,
  criteria: CRITERIA.filter((c) => e.truth[c] === 'Y'), outcome: e.truth.AEOUT, causality: e.truth.AEREL,
  sponsorCausality: e.truth.AEREL === 'NOT RELATED' ? 'NOT RELATED' : 'POSSIBLY RELATED', action: e.truth.AEACN, aware: e.truth.AESTDAT, received: addDays(e.truth.AESTDAT, LATE_REPORT.includes(e.subj) ? 4 : 1), edcForm: `${e.subj}|LOG|AE|${e.inst}`,
})

// The safety database copy of each study's SAEs, with that study's planted differences.
const caches: Record<string, { cases: SafetyCase[]; truth: Map<string, Entry>; notReported: string[] }> = {}
export function safetyBase() {
  if (caches[ACTIVE.id]) return caches[ACTIVE.id]
  const s = seedStudy()
  const ost = ACTIVE.id === OST_ID
  const listed = ost ? OST_SAE_SUBJECTS : [...SAE_SUBJECTS, '103-007']
  const saes = [...s.entries, ...s.hidden].filter((e) => e.form === 'AE' && e.truth.AESER === 'Y' && listed.includes(e.subj)).sort((a, b) => a.truth.AESTDAT.localeCompare(b.truth.AESTDAT))
  const truth = new Map<string, Entry>()
  const cases: SafetyCase[] = []
  const notReported: string[] = []
  let n = 140
  for (const e of saes) {
    const c = fromEntry(e, ++n)
    truth.set(c.caseId, e)
    if (ost) {
      if (e.subj === '304-003') { notReported.push(c.edcForm!); continue } // never reported to safety
      if (e.subj === '302-002') { c.outcome = 'RECOVERING/RESOLVING'; c.end = '' }
      if (e.subj === '301-007') c.onset = addDays(c.onset, 3)
      cases.push(c); continue
    }
    if (e.subj === '105-008') { notReported.push(c.edcForm!); continue } // never reported to safety
    // Planted safety-database errors.
    if (e.subj === '105-005') { c.outcome = 'RECOVERING/RESOLVING'; c.end = '' }
    if (e.subj === '106-003') c.term = 'Community-acquired pneumonia'
    if (e.subj === '101-006') c.criteria = [...c.criteria, 'AESMIE']
    if (e.subj === '103-005') c.end = addDays(c.end, -18)
    if (e.subj === '104-006') c.subj = '104-009'
    cases.push(c)
  }
  return (caches[ACTIVE.id] = { cases, truth, notReported })
}

// The safety database as it stands today: received cases, with the safety team's corrections,
// plus cases created for SAEs that were not reported.
export function safetyDb(p: Project): SafetyCase[] {
  const { cases, notReported } = safetyBase()
  const out = cases.filter((c) => c.received <= p.clock).map((c) => ({ ...c, ...(p.sae.safetyFixes[c.caseId] as Partial<SafetyCase>) }))
  for (const fk of p.sae.createdCases) {
    const e = [...seedStudy().entries].find((x) => x.form === 'AE' && `${x.subj}|LOG|AE|${x.inst}` === fk)
    if (e && notReported.includes(fk)) out.push({ ...fromEntry(e, 900 + p.sae.createdCases.indexOf(fk)), received: p.clock })
  }
  return out
}

export interface EdcSae { fk: string; subj: string; term: string; pt?: string; onset: string; end: string; criteria: string[]; outcome: string; causality: string; action: string }
export function edcSaes(p: Project): EdcSae[] {
  const subjects = [...new Set(Object.keys(p.forms).filter((k) => k.includes('|LOG|AE|')).map((k) => k.slice(0, 7)))]
  const out: EdcSae[] = []
  for (const s of subjects) for (const f of formsOfSubject(p, s)) {
    if (f.form !== 'AE' || f.values.AESER !== 'Y') continue
    const fk = `${f.subj}|LOG|AE|${f.inst}`
    const cr = p.coding[`${fk}|AETERM`]
    out.push({ fk, subj: f.subj, term: f.values.AETERM, pt: cr?.code ? ptOf(smd(p), cr.code)?.name : undefined, onset: f.values.AESTDAT, end: f.values.AEENDAT, criteria: CRITERIA.filter((c) => f.values[c] === 'Y'), outcome: f.values.AEOUT, causality: f.values.AEREL, action: f.values.AEACN })
  }
  return out
}
const casePt = (c: SafetyCase) => { const t = exactLlt(SMD['1.0'], c.term); return t ? ptOf(SMD['1.0'], t.code)?.name : undefined }

export interface Pair { id: string; edc?: EdcSae; sc?: SafetyCase; linked: boolean }
export function pairs(p: Project): Pair[] {
  const edc = edcSaes(p), cases = safetyDb(p)
  const used = new Set<string>()
  const out: Pair[] = []
  for (const e of edc) {
    const manual = p.sae.links[e.fk]
    const c = manual ? cases.find((x) => x.caseId === manual) : cases.find((x) => !used.has(x.caseId) && x.subj === e.subj && Math.abs(daysBetween(x.onset, e.onset || x.onset)) <= 14)
    if (c) used.add(c.caseId)
    out.push({ id: `${e.fk}~${c?.caseId ?? ''}`, edc: e, sc: c, linked: !!manual })
  }
  for (const c of cases) if (!used.has(c.caseId)) out.push({ id: `~${c.caseId}`, sc: c, linked: false })
  return out.sort((a, b) => (a.edc?.subj ?? a.sc!.subj).localeCompare(b.edc?.subj ?? b.sc!.subj))
}

const fv = (x: EdcSae | SafetyCase, f: Field): string => f === 'subject' ? x.subj : f === 'criteria' ? [...x.criteria].sort().join(',') : String((x as unknown as Record<string, string>)[f] ?? '')
export interface Discrepancy { id: string; pair: Pair; field: Field | 'missing-safety' | 'missing-edc'; edc: string; safety: string; expected: SaeClass | 'link'; onset: string }

export function discrepancies(p: Project): Discrepancy[] {
  const { truth } = safetyBase()
  const out: Discrepancy[] = []
  for (const pr of pairs(p)) {
    if (pr.edc && !pr.sc) {
      const elsewhere = [...truth.entries()].some(([cid, t]) => t.subj === pr.edc!.subj && `${t.subj}|LOG|AE|${t.inst}` === pr.edc!.fk && safetyDb(p).some((c) => c.caseId === cid))
      out.push({ id: `${pr.id}#missing-safety`, pair: pr, field: 'missing-safety', edc: pr.edc.term, safety: '', expected: elsewhere ? 'link' : 'not-reported', onset: pr.edc.onset }); continue
    }
    if (!pr.edc && pr.sc) {
      const realSubj = truth.get(pr.sc.caseId)?.subj
      const enteredElsewhere = realSubj && realSubj !== pr.sc.subj
      out.push({ id: `${pr.id}#missing-edc`, pair: pr, field: 'missing-edc', edc: '', safety: pr.sc.term, expected: enteredElsewhere ? 'link' : 'missing-edc', onset: pr.sc.onset }); continue
    }
    const e = pr.edc!, c = pr.sc!
    const t = truth.get(c.caseId)
    for (const f of FIELDS) {
      const a = fv(e, f), b = fv(c, f)
      if (a.toLowerCase() === b.toLowerCase()) continue
      let exp: SaeClass = 'acceptable'
      if (f === 'term' && (e.pt ?? exactPt(e.term)) && (e.pt ?? exactPt(e.term)) === casePt(c)) exp = 'acceptable'
      else if (t) {
        const tv = f === 'subject' ? t.subj : f === 'criteria' ? CRITERIA.filter((x) => t.truth[x] === 'Y').sort().join(',') : t.truth[{ term: 'AETERM', onset: 'AESTDAT', end: 'AEENDAT', outcome: 'AEOUT', causality: 'AEREL', action: 'AEACN' }[f as 'term']]
        exp = a.toLowerCase() !== String(tv).toLowerCase() ? 'edc' : 'safety'
      }
      out.push({ id: `${pr.id}#${f}`, pair: pr, field: f, edc: a, safety: b, expected: exp, onset: e.onset })
    }
  }
  return out
}
const exactPt = (term: string) => { const t = exactLlt(SMD['1.0'], term); return t ? ptOf(SMD['1.0'], t.code)?.name : undefined }

export type DStatus = 'open' | 'pending' | 'accepted' | 'resolved'
export function statusOf(p: Project, d: Discrepancy): DStatus {
  const dec = p.sae.decisions[d.id]
  if (!dec) return 'open'
  if (dec.cls === 'acceptable') return 'accepted'
  return 'pending'
}
// Discrepancies that disappeared (because the data now agree) count as resolved.
export function resolvedIds(p: Project, current: Discrepancy[]) {
  const live = new Set(current.map((d) => d.id))
  return Object.keys(p.sae.decisions).filter((id) => !live.has(id) && p.sae.decisions[id].cls !== 'acceptable')
}

const dmOnly = (p: Project) => { const u = me(p); if (u.role !== 'dm' && u.role !== 'dmlead') throw new Error('Data management performs the reconciliation.'); return u }

export function decide(p: Project, d: Discrepancy, cls: SaeClass, reason: string) {
  const u = dmOnly(p)
  const utc = nowUtc(p)
  const dec: ReconDecision = { cls, reason: reason.trim(), userId: u.id, utc }
  if (cls === 'acceptable' && !dec.reason) throw new Error('Give the reason the difference is acceptable.')
  if (cls === 'edc') {
    const field = d.field === 'criteria' ? 'AESER' : ({ term: 'AETERM', onset: 'AESTDAT', end: 'AEENDAT', outcome: 'AEOUT', causality: 'AEREL', action: 'AEACN', subject: 'AETERM' } as Record<string, string>)[d.field] ?? 'AETERM'
    const key = `${d.pair.edc!.fk}|${field}`
    const text = `SAE reconciliation: ${FIELD_LABEL[d.field as Field] ?? d.field} in the EDC is "${d.edc || 'blank'}", but the SAE report sent to drug safety says "${d.safety || 'blank'}". Please check the source and confirm which is correct.`
    const existing = p.queries.find((q) => q.key === key && q.source === 'manual' && isActive(q))
    dec.queryId = existing?.id ?? raiseManual(p, key, text, u).id
  }
  if (cls === 'missing-edc') {
    const sc = d.pair.sc!
    const iss = seedStudy().issues.find((i) => i.subj === sc.subj && 'listing' in i.find && i.find.listing === 'sae-missing')
    const key = `${sc.subj}|LOG|AE|${iss?.inst ?? 90}|AETERM`
    dec.queryId = raiseManual(p, key, `SAE reconciliation: drug safety holds a serious adverse event "${sc.term}" with onset ${sc.onset} (case ${sc.caseId}) that is not in the EDC. Please enter the adverse event from the source, or confirm why it is not recorded.`, u).id
  }
  if (cls === 'safety' || cls === 'not-reported') dec.noteDue = addDays(p.clock, 3)
  p.sae.decisions[d.id] = dec
  audit(p, u, 'sae.decide', d.id, undefined, cls, dec.reason || (dec.queryId ? `Query ${dec.queryId}` : 'Note sent to drug safety'), utc)
}
export function link(p: Project, edcFk: string, caseId: string | null) {
  const u = dmOnly(p)
  if (caseId) p.sae.links[edcFk] = caseId; else delete p.sae.links[edcFk]
  audit(p, u, 'sae.link', edcFk, undefined, caseId ?? 'unlinked', 'Manual match between EDC and safety database')
}

// The safety team acts on notes three days after they arrive, correcting only what the SAE
// report supports. A wrong note gets a reply and no change.
export function processSafety(p: Project) {
  if (!Object.values(p.sae.decisions).some((d) => d.noteDue && !d.done && d.noteDue <= p.clock)) return
  const { truth } = safetyBase()
  const ds = discrepancies(p)
  for (const [id, dec] of Object.entries(p.sae.decisions)) {
    if (!dec.noteDue || dec.noteDue > p.clock || dec.done) continue
    const d = ds.find((x) => x.id === id)
    if (dec.cls === 'not-reported') {
      const fk = id.split('~')[0]
      if (safetyBase().notReported.includes(fk) && !p.sae.createdCases.includes(fk)) { p.sae.createdCases.push(fk); audit(p, safetyUser, 'safety.case.create', fk, undefined, 'case created', 'Drug safety entered the late-reported SAE and assessed reportability', `${p.clock}T15:00:00Z`) }
      dec.done = true; continue
    }
    if (d && d.pair.sc) {
      const t = truth.get(d.pair.sc.caseId)
      const fix: Record<string, string | string[]> = {}
      if (t) {
        if (d.field === 'subject') fix.subj = t.subj
        else if (d.field === 'criteria') fix.criteria = CRITERIA.filter((x) => t.truth[x] === 'Y')
        else if (d.field in { onset: 1, end: 1, outcome: 1, causality: 1, action: 1, term: 1 }) fix[d.field] = t.truth[{ term: 'AETERM', onset: 'AESTDAT', end: 'AEENDAT', outcome: 'AEOUT', causality: 'AEREL', action: 'AEACN' }[d.field as 'term']]
      }
      const cur = d.pair.sc as unknown as Record<string, unknown>
      const changes = Object.entries(fix).filter(([k, v]) => JSON.stringify(cur[k]) !== JSON.stringify(v))
      if (changes.length) { p.sae.safetyFixes[d.pair.sc.caseId] = { ...(p.sae.safetyFixes[d.pair.sc.caseId] ?? {}), ...Object.fromEntries(changes) } as Record<string, string>; audit(p, safetyUser, 'safety.case.update', d.pair.sc.caseId, String(changes.map(([k]) => cur[k])), String(changes.map(([, v]) => v)), 'Corrected per the SAE report', `${p.clock}T15:00:00Z`) }
      else dec.reply = 'Drug safety: our database matches the SAE report. Please check the EDC.'
    }
    dec.done = true
  }
}
const safetyUser = { id: 'rmenon', name: 'Dr Ravi Menon', role: 'safety' as const, pin: '', trained: true }

export function inScope(p: Project, d: Discrepancy) { return !p.sae.cutoff || (d.onset || '0000') <= p.sae.cutoff }
export function reconReady(p: Project) {
  const ds = discrepancies(p).filter((d) => inScope(p, d))
  return ds.every((d) => statusOf(p, d) === 'accepted')
}
export function setCutoff(p: Project, date: string) {
  const u = dmOnly(p)
  p.sae.cutoff = date; p.sae.signoffDm = undefined; p.sae.signoffSafety = undefined
  audit(p, u, 'sae.cutoff', 'SAE reconciliation', undefined, date, 'Data cut-off agreed with drug safety')
}
export function signoff(p: Project, s: Signature) {
  if (!reconReady(p)) throw new Error('Every discrepancy in scope must be resolved or accepted first.')
  if (s.role === 'safety') p.sae.signoffSafety = s; else p.sae.signoffDm = s
  audit(p, SYSTEM, 'sae.signoff', 'SAE reconciliation', undefined, s.role, `Signed by ${s.userId} for cut-off ${p.sae.cutoff}`, s.utc)
}
export const answerKey = (p: Project) => discrepancies(p)
export { value, TERM_FIELD, seedEntry }
