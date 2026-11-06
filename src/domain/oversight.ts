// Oversight: source data verification, protocol deviations, centralised monitoring
// (ICH E6(R3) 3.11.4.2), quality tolerance limits (3.10) and the study metrics.

import type { Deviation, DvCategory, ItemKey, MonitoringDecision, Project, Signature } from './types'
import { parseKey } from './types'
import { FORMS, SITES, VISITS, fieldOf } from './study'
import { formsOfSubject, runChecksOnSubject } from './engine'
import { audit, me, nowUtc, seedEntry, enterForm, runChecks, simSiteUser, value, writeValue } from './project'
import { seedStudy, UNDER_REPORTED } from './seed'
import { VAX_DEV_CHECKS } from './vax/checks'
import { safetyDb } from './safety'
import { metrics, isActive, ageOf } from './queries'
import { QTLS } from './dmp'
import { addDays, daysBetween, median } from './util'
import { codingStats } from './coding'

// ---------- SDV ----------

const SAE_FORM_ALL = true
export function sdvRequired(p: Project, fk: string): string[] {
  const [, , form] = fk.split('|')
  const def = FORMS[form]
  const vals: Record<string, string> = { ...Object.fromEntries(def.fields.map((f) => [f.id, value(p, `${fk}|${f.id}`)])), __visit: fk.split('|')[1] }
  const visible = def.fields.filter((f) => !f.derived && (!f.showIf || vals[f.showIf.field] === f.showIf.equals))
  if (p.sdvPlan.mode === 'full') return visible.map((f) => f.id)
  if (form === 'IE' || (SAE_FORM_ALL && form === 'AE' && vals.AESER === 'Y')) return visible.map((f) => f.id)
  return visible.filter((f) => f.ctq).map((f) => f.id)
}
export type SdvState = 'verified' | 'changed' | 'pending' | 'not required'
export function sdvState(p: Project, key: ItemKey): SdvState {
  const k = parseKey(key)
  if (!sdvRequired(p, `${k.subj}|${k.visit}|${k.form}|${k.inst}`).includes(k.field)) return 'not required'
  const r = p.sdv[key]
  if (!r) return 'pending'
  return r.ver === (p.items[key]?.versions.length ?? 0) ? 'verified' : 'changed'
}
export const sourceValue = (fk: string, field: string) => (seedEntry(fk) ?? seedStudy().hidden.find((e) => `${e.subj}|${e.visit}|${e.form}|${e.inst}` === fk))?.truth[field]

export function verify(p: Project, key: ItemKey) {
  const u = me(p)
  if (u.role !== 'cra') throw new Error('The CRA performs source data verification.')
  const ver = p.items[key]?.versions.length ?? 0
  p.sdv[key] = { userId: u.id, utc: nowUtc(p), ver }
  audit(p, u, 'sdv.verify', key, undefined, value(p, key), 'Verified against the source document')
  const fk = key.split('|').slice(0, 4).join('|')
  const fs = p.forms[fk]
  if (fs && fs.status === 'entered' && sdvRequired(p, fk).every((f) => sdvState(p, `${fk}|${f}`) === 'verified')) { fs.status = 'sdv'; audit(p, u, 'form.sdv', fk, 'entered', 'sdv', 'All required fields verified') }
}
export function sdvProgress(p: Project, site?: string) {
  let req = 0, done = 0, changed = 0
  for (const fk of Object.keys(p.forms)) {
    if (p.forms[fk].deleted || (site && !fk.startsWith(site))) continue
    for (const f of sdvRequired(p, fk)) { req++; const s = sdvState(p, `${fk}|${f}`); if (s === 'verified') done++; if (s === 'changed') changed++ }
  }
  return { req, done, changed, pct: req ? done / req : 0 }
}
export function setSdvPlan(p: Project, mode: 'targeted' | 'full', s: Signature) {
  p.sdvPlan = { mode, signature: s }
  audit(p, me(p), 'sdv.plan', 'SDV plan', undefined, mode, `Approved by ${s.userId}`, s.utc)
}

// ---------- protocol deviations ----------

export const DEV_CHECKS: Record<string, DvCategory> = { 'EX-10': 'Investigational product', 'SV-04': 'Visit window', 'SV-05': 'Visit window', 'IC-03': 'Informed consent', 'IC-04': 'Informed consent', 'CM-10': 'Prohibited medication', 'EX-03': 'Investigational product', 'EX-08': 'Investigational product', 'DM-04': 'Eligibility', 'IE-03': 'Eligibility', 'IE-04': 'Eligibility', 'IE-05': 'Eligibility' }
export const DV_CATEGORIES: DvCategory[] = ['Eligibility', 'Informed consent', 'Visit window', 'Prohibited medication', 'Investigational product', 'Safety reporting', 'Procedure not done', 'Other']

export function addDeviation(p: Project, d: { subj: string; category: DvCategory; description: string; source: string; key?: ItemKey }, u = me(p)) {
  if (!['dm', 'dmlead', 'cra', 'system'].includes(u.role)) throw new Error('Data management or the CRA logs deviations.')
  if (!/^\d{3}-\d{3}$/.test(d.subj) || !Object.keys(p.forms).some((k) => k.startsWith(d.subj + '|'))) throw new Error('Give a subject number that is in the study, such as 103-004.')
  if (!d.description.trim()) throw new Error('Describe the deviation.')
  const dv: Deviation = { id: `DV-${String(p.deviations.length + 1).padStart(3, '0')}`, ...d, identified: p.clock, userId: u.id, utc: nowUtc(p), status: 'to classify' }
  p.deviations.push(dv)
  audit(p, u, 'deviation.log', dv.id, undefined, `${d.subj} ${d.category}`, d.description)
  // Every deviation is also recorded on the subject's DV eCRF form (CDASH DV domain).
  if (Object.keys(p.forms).some((k) => k.startsWith(d.subj + '|'))) {
    const inst = Math.max(0, ...Object.keys(p.forms).filter((k) => k.startsWith(`${d.subj}|LOG|DV|`)).map((k) => Number(k.split('|')[3]))) + 1
    enterForm(p, d.subj, 'LOG', 'DV', inst, { DVSTDAT: p.clock, DVTERM: `${dv.id}: ${d.description}`.slice(0, 200), DVDECOD: d.category.toUpperCase(), DVIMPT: '' }, u, dv.utc)
    dv.dvForm = `${d.subj}|LOG|DV|${inst}`
  }
  return dv
}
// Called when data management closes a query from a deviation-type check with the data confirmed.
export function deviationFromQuery(p: Project, checkId: string, key: ItemKey, queryId: string) {
  const cat = (DEV_CHECKS[checkId] ?? VAX_DEV_CHECKS[checkId]) as DvCategory | undefined; if (!cat) return
  const k = parseKey(key)
  if (!runChecksOnSubject(p, k.subj).some((f) => f.checkId === checkId && f.key === key)) return
  if (p.deviations.some((d) => d.key === key && d.category === cat)) return
  const ch = p.checks.find((c) => c.id === checkId)
  addDeviation(p, { subj: k.subj, category: cat, description: `${ch?.title ?? checkId} (${k.visit === 'LOG' ? FORMS[k.form].name : VISITS.find((v) => v.id === k.visit)?.name}); confirmed by the site`, source: `Edit check ${checkId}, query ${queryId}`, key }, { id: 'system', name: 'System', role: 'system', pin: '', trained: true })
}
export function classify(p: Project, id: string, important: boolean, rationale: string) {
  const u = me(p)
  if (!['dm', 'dmlead', 'cra'].includes(u.role)) throw new Error('Data management or the CRA classifies deviations.')
  if (!rationale.trim()) throw new Error('Give the rationale for the classification.')
  const d = p.deviations.find((x) => x.id === id)!
  Object.assign(d, { important, rationale: rationale.trim(), classifiedBy: u.id, status: 'classified' })
  if (d.dvForm && p.items[`${d.dvForm}|DVIMPT`]) writeValue(p, `${d.dvForm}|DVIMPT`, important ? 'Y' : 'N', u, `Classified: ${rationale.trim()}`)
  audit(p, u, 'deviation.classify', id, undefined, important ? 'important' : 'not important', rationale.trim())
}
// The study's deviation plan: what counts as important here (affects subject safety, rights,
// or the reliability of the primary endpoint).
export function expectedImportant(d: Deviation): boolean | undefined {
  if (['Eligibility', 'Informed consent', 'Prohibited medication', 'Investigational product', 'Safety reporting'].includes(d.category)) return true
  if (d.category === 'Visit window') return d.key ? parseKey(d.key).visit === 'W12' : undefined
  if (d.category === 'Procedure not done') return false
  return undefined
}
export const DV_PLAN = [
  'Important: anything affecting eligibility, informed consent, subject safety (including late SAE reporting), the investigational product, or a prohibited medication that affects the primary endpoint.',
  'Important: a Week 12 visit outside its window, because Week 12 carries the primary endpoint.',
  'Not important: other visit-window deviations, and a missed non-critical procedure.',
]

// ---------- centralised monitoring ----------

export type KriId = 'ae' | 'digit' | 'identical' | 'lag' | 'queries' | 'response' | 'missing'
export const KRI: Record<KriId, { label: string; unit: string; dir: 'low' | 'high'; why: string }> = {
  ae: { label: 'Adverse events per randomised subject', unit: '', dir: 'low', why: 'Too few AEs may mean under-reporting.' },
  digit: { label: 'Systolic BP values ending in 0', unit: '%', dir: 'high', why: 'About 10% is expected; much more suggests rounding instead of measuring.' },
  identical: { label: 'Subjects with identical BP at 3+ visits', unit: '', dir: 'high', why: 'Copied values instead of new measurements.' },
  lag: { label: 'Median data entry lag (days)', unit: 'd', dir: 'high', why: 'Late entry delays cleaning and safety review.' },
  queries: { label: 'Queries per 100 data points', unit: '', dir: 'high', why: 'Many queries point to training needs.' },
  response: { label: 'Median days for the site to answer a query', unit: 'd', dir: 'high', why: 'Slow answers hold up cleaning and lock.' },
  missing: { label: 'Required fields left blank (%)', unit: '%', dir: 'high', why: 'Missing data weakens the analysis.' },
}
export interface Signal { id: string; site: string; kri: KriId; value: number; reference: number; flagged: boolean }

export function signals(p: Project): Signal[] {
  const ms = metrics(p)
  const per: Record<string, Record<KriId, number>> = {}
  for (const s of SITES) {
    const subs = [...new Set(Object.keys(p.forms).filter((k) => k.startsWith(s.id)).map((k) => k.slice(0, 7)))]
    const forms = subs.flatMap((x) => formsOfSubject(p, x))
    const rand = subs.filter((x) => forms.some((f) => f.subj === x && f.visit === 'D1' && f.form === 'SV')).length
    const sbp = forms.filter((f) => f.form === 'VS' && f.values.SYSBP).map((f) => f.values.SYSBP)
    let ident = 0
    for (const x of subs) {
      const bp = VISITS.slice(1).map((v) => forms.find((f) => f.subj === x && f.visit === v.id && f.form === 'VS')).filter(Boolean).map((f) => `${f!.values.SYSBP}/${f!.values.DIABP}`)
      if (bp.some((b, i) => i >= 2 && bp[i - 1] === b && bp[i - 2] === b)) ident++
    }
    const req = forms.flatMap((f) => FORMS[f.form].fields.filter((d) => d.required && !d.derived).map((d) => f.values[d.id]))
    const answered = p.queries.filter((q) => q.key.startsWith(s.id) && q.answeredUtc).map((q) => daysBetween(q.raisedUtc.slice(0, 10), q.msgs.find((m) => m.kind === 'response')!.utc.slice(0, 10)))
    const m = ms.find((x) => x.site === s.id)!
    per[s.id] = {
      ae: rand ? forms.filter((f) => f.form === 'AE').length / rand : NaN,
      digit: sbp.length ? (sbp.filter((v) => v.endsWith('0')).length / sbp.length) * 100 : NaN,
      identical: ident,
      lag: m.entryLag, queries: m.perHundred,
      response: median(answered),
      missing: req.length ? (req.filter((v) => !v).length / req.length) * 100 : NaN,
    }
  }
  const out: Signal[] = []
  for (const kri of Object.keys(KRI) as KriId[]) {
    for (const s of SITES) {
      const v = per[s.id][kri]
      if (Number.isNaN(v)) continue
      const others = SITES.filter((x) => x.id !== s.id).map((x) => per[x.id][kri]).filter((x) => !Number.isNaN(x))
      const ref = median(others)
      let flagged = false
      if (kri === 'ae') flagged = ref > 0 && v < ref * 0.5
      else if (kri === 'digit') flagged = v > 40
      else if (kri === 'identical') flagged = v >= 1
      else flagged = ref > 0 && v > ref * 2 && v - ref > (kri === 'missing' ? 0.5 : 2)
      out.push({ id: `${s.id}:${kri}`, site: s.id, kri, value: v, reference: ref, flagged })
    }
  }
  return out
}
// Answer key: which flags are real problems at this study's sites.
export function expectedFinding(sig: Signal): { finding: 'action' | 'explained' | 'either'; actions?: MonitoringDecision['action'][]; why: string } {
  const any: MonitoringDecision['action'][] = ['site retraining', 'for-cause visit', 'escalate to sponsor']
  if (sig.id === '104:ae') return { finding: 'action', actions: ['for-cause visit'], why: 'Site 104 leaves AEs out of the EDC; only a visit to the source finds them.' }
  if (sig.site === '103') return { finding: 'action', actions: any, why: 'Site 103 has a new coordinator: errors, copied values and queries all point to training.' }
  if (sig.id === '106:digit' || sig.id === '106:identical') return { finding: 'action', actions: any, why: 'Site 106 rounds blood pressure to the nearest 10 instead of reading it.' }
  if (sig.id === '106:lag') return { finding: 'action', actions: any, why: 'Site 106 enters data two to three weeks after each visit.' }
  if (sig.id === '102:response') return { finding: 'action', actions: any, why: 'Site 102 takes weeks to answer queries.' }
  if (sig.id === '106:ae') return { finding: 'explained', why: 'Site 106 started late: its subjects have had less time on study, so fewer AEs are expected.' }
  if (sig.id === '106:response') return { finding: 'either', actions: any, why: 'Borderline: site 106 is slower than most but within a fortnight.' }
  return { finding: 'explained', why: 'Chance variation at a small site.' }
}
export function decideSignal(p: Project, id: string, d: Omit<MonitoringDecision, 'userId' | 'utc'>) {
  const u = me(p)
  if (!['dm', 'dmlead', 'cra'].includes(u.role)) throw new Error('Data management or the CRA reviews monitoring signals.')
  if (!d.note.trim()) throw new Error('Record what you found.')
  if (d.finding === 'action' && !d.action) throw new Error('Choose the action.')
  p.monitoring.decisions[id] = { ...d, note: d.note.trim(), userId: u.id, utc: nowUtc(p) }
  if (d.action === 'for-cause visit') { const site = id.split(':')[0]; p.monitoring.forCause[site] ??= addDays(p.clock, 7) }
  audit(p, u, 'monitoring.decide', id, undefined, d.finding + (d.action ? `: ${d.action}` : ''), d.note.trim())
}
// For-cause visits happen a week after they are planned; at site 104 the CRA finds the AEs
// that were never entered, and the site enters them.
export function processMonitoring(p: Project) {
  for (const [site, date] of Object.entries(p.monitoring.forCause)) {
    if (date > p.clock || date.startsWith('done')) continue
    p.monitoring.forCause[site] = `done ${p.clock}`
    audit(p, { id: 'mlind', name: 'Maya Lindqvist', role: 'cra', pin: '', trained: true }, 'monitoring.visit', `Site ${site}`, undefined, 'for-cause visit', 'For-cause monitoring visit performed', `${p.clock}T11:00:00Z`)
    if (site !== '104') continue
    const u = simSiteUser('104')
    for (const x of UNDER_REPORTED) {
      const h = seedStudy().hidden.find((e) => e.subj === x.subj && e.inst === 60)
      if (!h || p.forms[`${x.subj}|LOG|AE|60`] || !p.forms[`${x.subj}|D1|SV|1`]) continue
      enterForm(p, x.subj, 'LOG', 'AE', 60, h.values, u, `${p.clock}T14:00:00Z`)
      runChecks(p, [x.subj], `${p.clock}T14:00:00Z`)
    }
  }
}

// ---------- quality tolerance limits ----------

export interface QtlStatus { id: string; text: string; observed: number; num: number; den: number; limit: number; warn: number; state: 'within' | 'warning' | 'breached' }
export function qtlStatus(p: Project): QtlStatus[] {
  const subs = [...new Set(Object.keys(p.forms).filter((k) => k.includes('|D1|SV|')).map((k) => k.slice(0, 7)))]
  const q1 = p.deviations.filter((d) => d.category === 'Eligibility' && d.important).map((d) => d.subj)
  const pastW12 = subs.filter((s) => { const d1 = value(p, `${s}|D1|SV|1|VISDAT`); return d1 && addDays(d1, 88 + 14) < p.clock })
  const q2 = pastW12.filter((s) => !value(p, `${s}|W12|VS|1|SYSBP`))
  const cases = safetyDb(p)
  const q3 = cases.filter((c) => daysBetween(c.aware, c.received) > 1)
  const raw = [[new Set(q1).size, subs.length], [q2.length, pastW12.length], [q3.length, cases.length]]
  return QTLS.map((q, i) => {
    const [num, den] = raw[i]
    const observed = den ? (num / den) * 100 : 0
    const limit = p.startup.qtl[q.id] ?? q.suggest
    const warn = limit * (2 / 3)
    return { id: q.id, text: q.text, observed, num, den, limit, warn, state: observed > limit ? 'breached' : observed > warn ? 'warning' : 'within' }
  })
}
export function recordBreach(p: Project, qtl: string, rootCause: string, action: string, s: Signature) {
  if (rootCause.trim().length < 20 || action.trim().length < 20) throw new Error('Describe the root cause and the corrective action (at least a sentence each).')
  const st = qtlStatus(p).find((x) => x.id === qtl)!
  p.qtlLog.push({ id: `QTL-${p.qtlLog.length + 1}`, qtl, observed: st.observed, limit: st.limit, rootCause: rootCause.trim(), action: action.trim(), utc: s.utc, signature: s })
  audit(p, me(p), 'qtl.breach', qtl, undefined, `${st.observed.toFixed(1)}% vs ${st.limit}%`, `${rootCause.trim()} | ${action.trim()}`, s.utc)
}

// ---------- study dashboard ----------

export function missingPages(p: Project, site: string) {
  let n = 0
  for (const fk of Object.keys(p.forms)) {
    if (!fk.startsWith(site) || !fk.includes('|SV|')) continue
    const [subj, visit] = fk.split('|')
    if (value(p, `${fk}|VISOCCUR`) !== 'Y') continue
    const vd = p.forms[fk].visitDate ?? value(p, `${fk}|VISDAT`)
    if (!vd || addDays(vd, 14) > p.clock) continue
    const v = VISITS.find((x) => x.id === visit)!
    for (const f of v.forms) if (f !== 'EOS' && !p.forms[`${subj}|${visit}|${f}|1`]) n++
  }
  return n
}
export function dashboard(p: Project) {
  const ms = metrics(p)
  return SITES.map((s) => {
    const subs = new Set(Object.keys(p.forms).filter((k) => k.startsWith(s.id)).map((k) => k.slice(0, 7)))
    const rand = [...subs].filter((x) => p.forms[`${x}|D1|SV|1`]).length
    const m = ms.find((x) => x.site === s.id)!
    const over30 = p.queries.filter((q) => q.key.startsWith(s.id) && isActive(q) && ageOf(q, p.clock) > 30).length
    const uncoded = Object.values(p.coding).filter((r) => r.key.startsWith(s.id) && (r.status === 'uncoded' || r.status === 'query')).length
    const dv = p.deviations.filter((d) => d.subj.startsWith(s.id))
    return { site: s.id, screened: subs.size, rand, lag: m.entryLag, missing: missingPages(p, s.id), open: m.open + m.answered, over30, sdv: sdvProgress(p, s.id), uncoded, dv: dv.length, dvImportant: dv.filter((d) => d.important).length }
  })
}
export const studyCoding = codingStats
export { fieldOf }
