// Medical coding: adverse events and medical history to the Study Medical Dictionary,
// medications to the Study Drug Dictionary. Exact matches and the study synonym list
// code automatically; the coder codes the rest, queries verbatims that cannot be coded
// safely, and a reviewer approves with an electronic signature.

import type { CodingRecord, ItemKey, Project, Signature } from './types'
import { SMD, exactLlt, ptOf, path, type MedDict } from './dictmed'
import { drugById, exactDrug, atcPath } from './dictdrug'
import { formsOfSubject } from './engine'
import { audit, me, nowUtc, raiseManual, SYSTEM } from './project'
import { isActive } from './queries'

export const TERM_FIELD: Record<string, string> = { AE: 'AETERM', MH: 'MHTERM', CM: 'CMTRT' }
export const dictOf = (form: string) => (form === 'CM' ? 'SDD' : 'SMD') as 'SMD' | 'SDD'
export const smd = (p: Project): MedDict => SMD[p.smdVersion]
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

const hist = (r: CodingRecord, userId: string, action: string, detail: string, utc: string) => r.history.push({ utc, userId, action, detail })

// Bring coding records in line with the casebook: new terms appear, changed verbatims go back
// to uncoded, deleted records drop out. Then auto-code what can be coded without judgement.
export function syncCoding(p: Project, subjects: string[], utc = nowUtc(p)) {
  for (const subj of subjects) {
    const forms = formsOfSubject(p, subj, true)
    for (const fd of forms) {
      const field = TERM_FIELD[fd.form]; if (!field) continue
      const key = `${fd.subj}|${fd.visit}|${fd.form}|${fd.inst}|${field}`
      const verb = (fd.values[field] ?? '').trim()
      let r = p.coding[key]
      if (fd.deleted || !verb) { if (r) delete p.coding[key]; continue }
      if (!r) { r = p.coding[key] = { key, dict: dictOf(fd.form), verbatim: verb, status: 'uncoded', history: [] }; hist(r, 'system', 'created', verb, utc) }
      if (r.verbatim !== verb) {
        hist(r, 'system', 'verbatim changed', `${r.verbatim} → ${verb}`, utc)
        if (r.code) r.previous = { code: r.code, version: r.version ?? '', reason: 'Verbatim changed at the site' }
        Object.assign(r, { verbatim: verb, status: 'uncoded', code: undefined, atc: undefined, method: undefined, approvedBy: undefined, approvedUtc: undefined, queryId: undefined })
      }
      if (r.status === 'query' && r.queryId && !p.queries.some((q) => q.id === r!.queryId && isActive(q))) { r.status = 'uncoded'; hist(r, 'system', 'query closed', r.queryId, utc); r.queryId = undefined }
      if (r.status === 'uncoded' && !(p.noAutoAe && fd.form === 'AE')) autoCode(p, r, fd.values.CMINDC ?? '', utc)
    }
  }
}

function autoCode(p: Project, r: CodingRecord, _indication: string, utc: string) {
  const syn = p.synonyms[`${r.dict}:${norm(r.verbatim)}`]
  if (syn) { setCode(p, r, syn.code, syn.atc, 'synonym', SYSTEM.id, utc); return }
  if (r.dict === 'SMD') {
    const t = exactLlt(smd(p), r.verbatim)
    if (t) setCode(p, r, t.code, undefined, 'auto', SYSTEM.id, utc)
  } else {
    const d = exactDrug(r.verbatim)
    if (d && d.atc.length === 1) setCode(p, r, d.id, d.atc[0], 'auto', SYSTEM.id, utc)
  }
}
function setCode(p: Project, r: CodingRecord, code: string, atc: string | undefined, method: CodingRecord['method'], userId: string, utc: string) {
  Object.assign(r, { code, atc, method, status: 'coded', version: r.dict === 'SMD' ? p.smdVersion : 'SDD', codedBy: userId, codedUtc: utc, approvedBy: undefined, approvedUtc: undefined, review: false })
  hist(r, userId, method === 'manual' ? 'coded' : method === 'synonym' ? 'auto-coded from synonym list' : 'auto-coded (exact match)', describe(p, r), utc)
}

export function describe(p: Project, r: CodingRecord): string {
  if (!r.code) return ''
  if (r.dict === 'SMD') return path(smd(p), r.code).map((t) => t.name).join(' › ') || `(code ${r.code} not in version ${p.smdVersion})`
  const d = drugById.get(r.code)
  return d ? `${d.name} [${d.id}] · ${d.ingredients.join(' + ')} · ${r.atc ? atcPath(r.atc).map((a) => `${a.code} ${a.name}`).join(' › ') : 'class not chosen'}` : r.code
}

const coderOnly = (p: Project) => { const u = me(p); if (u.role !== 'coder') throw new Error('Switch to the medical coder to code terms.'); return u }

export function codeTerm(p: Project, key: ItemKey, code: string, atc?: string, addSynonym = true) {
  const u = coderOnly(p)
  const r = p.coding[key]; if (!r) throw new Error('No coding record for this term.')
  if (r.dict === 'SMD') {
    const t = smd(p).terms.get(code)
    if (!t || t.level !== 'LLT') throw new Error('Code to a lowest-level term.')
    if (!t.current) throw new Error(`"${t.name}" is not current in version ${p.smdVersion}. Choose a current term.`)
  } else {
    const d = drugById.get(code); if (!d) throw new Error('Unknown drug record.')
    if (!atc || !d.atc.includes(atc)) throw new Error(d.atc.length > 1 ? 'This drug has more than one class. Choose the class that fits the indication.' : 'Choose the class.')
  }
  const utc = nowUtc(p)
  setCode(p, r, code, atc, 'manual', u.id, utc)
  if (addSynonym) p.synonyms[`${r.dict}:${norm(r.verbatim)}`] = { dict: r.dict, code, atc, userId: u.id, utc }
  audit(p, u, 'coding.code', key, r.previous?.code, `${code}${atc ? ' ' + atc : ''}`, `Coded "${r.verbatim}"`)
}

export function codingQuery(p: Project, key: ItemKey, text: string) {
  const u = coderOnly(p)
  const r = p.coding[key]; if (!r) throw new Error('No coding record for this term.')
  const q = raiseManual(p, key, text, u)
  r.status = 'query'; r.queryId = q.id; r.code = undefined; r.atc = undefined
  hist(r, u.id, 'query raised', `${q.id}: ${text}`, nowUtc(p))
}

export function approveCoding(p: Project, keys: ItemKey[], s: Signature) {
  for (const k of keys) {
    const r = p.coding[k]; if (!r || r.status !== 'coded' || r.review) continue
    r.status = 'approved'; r.approvedBy = s.userId; r.approvedUtc = s.utc
    hist(r, s.userId, 'approved', s.meaning, s.utc)
  }
  audit(p, SYSTEM, 'coding.approve', `${keys.length} terms`, undefined, 'approved', `Approved by ${s.userId}`, s.utc)
}

export function removeSynonym(p: Project, id: string) {
  const u = coderOnly(p)
  const s = p.synonyms[id]; if (!s) return
  delete p.synonyms[id]
  audit(p, u, 'coding.synonym.remove', id, s.code, undefined, 'Removed from the study synonym list')
}

// ---------- dictionary upgrade ----------

export interface Impact { key: ItemKey; verbatim: string; kind: 'recode' | 'hierarchy' | 'none'; from: string; to: string }
export function upgradeImpact(p: Project, toVersion = '1.1'): Impact[] {
  const from = smd(p), to = SMD[toVersion]
  return Object.values(p.coding).filter((r) => r.dict === 'SMD' && r.code).map((r) => {
    const a = path(from, r.code!), t = to.terms.get(r.code!)
    if (!t || !t.current) return { key: r.key, verbatim: r.verbatim, kind: 'recode' as const, from: a.map((x) => x.name).join(' › '), to: t ? `LLT "${t.name}" not current in ${toVersion}` : 'not in the new version' }
    const b = path(to, r.code!)
    const changed = a.map((x) => x.code).join('>') !== b.map((x) => x.code).join('>')
    return { key: r.key, verbatim: r.verbatim, kind: changed ? 'hierarchy' as const : 'none' as const, from: a.map((x) => x.name).join(' › '), to: b.map((x) => x.name).join(' › ') }
  })
}
export function applyUpgrade(p: Project, s: Signature, note: string) {
  if (p.smdVersion === '1.1') throw new Error('Already on version 1.1.')
  const impact = upgradeImpact(p)
  const utc = s.utc
  p.smdVersion = '1.1'
  for (const i of impact) {
    const r = p.coding[i.key]
    if (i.kind === 'recode') { r.previous = { code: r.code!, version: '1.0', reason: 'LLT not current in 1.1' }; Object.assign(r, { status: 'uncoded', code: undefined, method: undefined, approvedBy: undefined, approvedUtc: undefined }); hist(r, s.userId, 'upgrade: needs recoding', i.to, utc) }
    if (i.kind === 'hierarchy') { r.review = true; r.version = '1.1'; if (r.status === 'approved') r.status = 'coded'; hist(r, s.userId, 'upgrade: hierarchy changed', `${i.from} → ${i.to}`, utc) }
    if (i.kind === 'none') r.version = '1.1'
  }
  // Synonyms that point to retired terms are no longer safe to apply.
  for (const [k, syn] of Object.entries(p.synonyms)) if (syn.dict === 'SMD' && !SMD['1.1'].terms.get(syn.code)?.current) delete p.synonyms[k]
  p.smdUpgrade = { utc, userId: s.userId, note, reviewed: [], signature: s }
  audit(p, SYSTEM, 'coding.upgrade', 'Study Medical Dictionary', '1.0', '1.1', `${impact.filter((i) => i.kind === 'recode').length} to recode, ${impact.filter((i) => i.kind === 'hierarchy').length} hierarchy changes. ${note}`, utc)
}
export function reviewHierarchy(p: Project, key: ItemKey) {
  const u = me(p)
  if (u.role !== 'coder' && u.role !== 'dmlead') throw new Error('The coder or the coding reviewer reviews hierarchy changes.')
  const r = p.coding[key]; if (!r?.review) return
  r.review = false; p.smdUpgrade?.reviewed.push(key)
  hist(r, u.id, 'hierarchy change reviewed', describe(p, r), nowUtc(p))
  audit(p, u, 'coding.review', key, undefined, 'reviewed', 'Hierarchy change after upgrade reviewed; code kept')
}

// ---------- answer key ----------

const MED_KEY: Record<string, string | 'query'> = {
  headace: 'Head pain', dizzyness: 'Light-headedness', tierd: 'Fatigue',
  'fever, cough, sore throat - urti': 'Upper respiratory tract infection',
  cold: 'query', 'headache and nausea': 'query', 'severe dizziness with fall': 'query',
}
const DRUG_KEY: Record<string, string> = { atorvastatine: 'atorvastatin', 'lipidra 20 mg': 'atorvastatin', 'metformin xr': 'metformin', omeprazol: 'omeprazole' }

export type Expected = { kind: 'pt'; pt: string } | { kind: 'drug'; ingredient: string; atc: string } | { kind: 'query' }
export function expected(form: string, verbatim: string, indication = '', version: '1.0' | '1.1' = '1.0'): Expected | undefined {
  const v = norm(verbatim)
  if (form === 'CM') {
    const d = exactDrug(verbatim)
    const ing = d ? d.ingredients.join('+') : DRUG_KEY[v]
    if (!ing) return undefined
    const rec = [...drugById.values()].find((x) => x.ingredients.join('+') === ing)!
    const atc = rec.atc.length === 1 ? rec.atc[0] : /prevent|heart|stroke|cardio|thromb/i.test(indication) ? 'W01AC' : 'K02BA'
    return { kind: 'drug', ingredient: ing, atc }
  }
  const k = MED_KEY[v]
  if (k === 'query') return { kind: 'query' }
  const d = SMD[version]
  if (k) return { kind: 'pt', pt: k }
  const t = (d.byName.get(v) ?? []).find((x) => x.level === 'LLT') ?? (SMD['1.0'].byName.get(v) ?? []).find((x) => x.level === 'LLT')
  if (!t) return undefined
  const pt = ptOf(d, t.code) ?? ptOf(SMD['1.0'], t.code)
  return pt ? { kind: 'pt', pt: pt.name } : undefined
}
export function isCorrect(p: Project, r: CodingRecord, indication = ''): boolean | undefined {
  const e = expected(r.key.split('|')[2], r.verbatim, indication, p.smdVersion)
  if (!e) return undefined
  if (e.kind === 'query') return r.status === 'query'
  if (!r.code || (r.status !== 'coded' && r.status !== 'approved')) return false
  if (e.kind === 'pt') return ptOf(smd(p), r.code)?.name === e.pt
  const d = drugById.get(r.code)
  return !!d && d.ingredients.join('+') === e.ingredient && r.atc === e.atc
}
export const codingStats = (p: Project) => {
  const rs = Object.values(p.coding)
  const by = (s: string) => rs.filter((r) => r.status === s).length
  return { total: rs.length, uncoded: by('uncoded'), coded: by('coded'), query: by('query'), approved: by('approved'), review: rs.filter((r) => r.review).length, auto: rs.filter((r) => r.method === 'auto' || r.method === 'synonym').length }
}
