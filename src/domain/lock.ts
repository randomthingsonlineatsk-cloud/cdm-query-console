// Database lock: the checklist with evidence, soft lock, hard lock, the unlock procedure,
// re-lock and the archive package (ICH E6(R3) 4.2.6 to 4.2.8).

import type { Project, Role, Signature, UnlockRequest, User } from './types'
import { ROLE_LABEL } from './types'
import { seedStudy, CLOSE_OUT } from './seed'
import { audit, me, nowUtc, advance, closeQuery, requery, raiseManual, value, goLive, SYSTEM } from './project'
import { isActive } from './queries'
import { sdvProgress, sdvRequired, sdvState, verify, missingPages, classify, expectedImportant, deviationFromQuery } from './oversight'
import { discrepancies, decide, link, pairs, reconReady, setCutoff, statusOf, inScope } from './safety'
import { transferLog, shouldAccept, decideTransfer, extDiscrepancies, decideExt, addRule, VENDOR_IDS, latestLoaded } from './external'
import { codeTerm, codingQuery, expected, smd } from './coding'
import { ptOf } from './dictmed'
import { DRUGS } from './dictdrug'
import { FORMS, SITES, STUDY, VISITS } from './study'
import { addDays, hash } from './util'
import { preparedStartup } from './missions'

export const LPLV = () => seedStudy().entries.filter((e) => e.form === 'SV').map((e) => e.visitDate).sort().pop()!

// ---------- checklist ----------

const lastChangeSeq = (p: Project, subj?: string) => {
  for (let i = p.audit.length - 1; i >= 0; i--) {
    const a = p.audit[i]
    if (!/^(item|form)\./.test(a.action)) continue
    if (!subj || a.entity.startsWith(subj + '|')) return a.seq
  }
  return 0
}
export const randomised = (p: Project) => [...new Set(Object.keys(p.forms).filter((k) => k.includes('|D1|SV|')).map((k) => k.slice(0, 7)))].sort()
export const piCurrent = (p: Project, subj: string) => { const s = p.lock.piSign[subj]; return !!s && s.auditSeq >= lastChangeSeq(p, subj) }

const PII = /\b\d{5}\s?\d{5}\b|\+\d{6,}|[\w.]+@\w+\.\w+|\b(Mr|Mrs|Ms|Miss|Wife|Husband|Son|Daughter|Mother|Father|Spouse)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/
export function privacyFindings(p: Project) {
  const out: { key: string; text: string }[] = []
  for (const [k, it] of Object.entries(p.items)) {
    if (!/\|(AECOM|CMINDC|AETERM|CMTRT|MHTERM)$/.test(k)) continue
    const v = it.versions.at(-1)!.value
    if (v && PII.test(v)) out.push({ key: k, text: v })
  }
  return out
}

export interface CheckItem { id: string; label: string; ok: boolean; evidence: string; view: string }
export function checklist(p: Project): CheckItem[] {
  const seed = seedStudy().entries
  const due = seed.filter((e) => e.entryDate <= p.clock)
  const notIn = due.filter((e) => !p.enteredSeed[`${e.subj}|${e.visit}|${e.form}|${e.inst}`]).length
  const allVisits = p.clock > addDays(LPLV(), 0)
  const miss = SITES.reduce((s, x) => s + missingPages(p, x.id), 0)
  const active = p.queries.filter(isActive).length
  const sdv = sdvProgress(p)
  const cod = Object.values(p.coding)
  const notApproved = cod.filter((r) => r.status !== 'approved' || r.review).length
  const saeOk = !!p.sae.signoffDm && !!p.sae.signoffSafety && reconReady(p)
  const extOpen = VENDOR_IDS.reduce((s, v) => s + extDiscrepancies(p, v).filter((d) => !p.ext.decisions[d.id]).length, 0)
  const extOk = !!p.ext.signoff && extOpen === 0 && VENDOR_IDS.every((v) => latestLoaded(p, v))
  const dvOpen = p.deviations.filter((d) => d.status !== 'classified').length
  const subs = randomised(p)
  const piMissing = subs.filter((s) => !piCurrent(p, s)).length
  const ar = p.lock.auditReview
  const arOk = !!ar && ar.upToSeq >= lastChangeSeq(p)
  const priv = privacyFindings(p)
  return [
    { id: 'data', label: 'All data entered', ok: allVisits && notIn === 0 && miss === 0, evidence: `${allVisits ? 'Last subject last visit has passed' : `Last subject last visit is ${LPLV()}`}; ${notIn} expected forms not entered; ${miss} missing pages`, view: 'oversight' },
    { id: 'queries', label: 'All queries closed', ok: active === 0, evidence: `${active} open or answered queries`, view: 'queries' },
    { id: 'sdv', label: `SDV complete (${p.sdvPlan.mode} plan)`, ok: sdv.req > 0 && sdv.done === sdv.req && sdv.changed === 0, evidence: `${sdv.done} of ${sdv.req} required fields verified; ${sdv.changed} changed since SDV`, view: 'oversight' },
    { id: 'coding', label: 'Coding complete and approved', ok: cod.length > 0 && notApproved === 0, evidence: `${cod.length - notApproved} of ${cod.length} terms approved`, view: 'coding' },
    { id: 'sae', label: 'SAE reconciliation signed', ok: saeOk, evidence: saeOk ? `Signed by ${p.sae.signoffDm!.userId} and ${p.sae.signoffSafety!.userId}, cut-off ${p.sae.cutoff}` : 'Not signed by both, or discrepancies remain', view: 'recon' },
    { id: 'ext', label: 'Vendor reconciliations signed', ok: extOk, evidence: extOk ? `Signed by ${p.ext.signoff!.userId}` : `${extOpen} vendor discrepancies unclassed${p.ext.signoff ? '' : '; not signed'}`, view: 'recon' },
    { id: 'dv', label: 'Protocol deviations reviewed and classified', ok: dvOpen === 0, evidence: `${p.deviations.length - dvOpen} of ${p.deviations.length} classified`, view: 'oversight' },
    { id: 'pi', label: 'Investigator casebook signatures current', ok: subs.length > 0 && piMissing === 0, evidence: `${subs.length - piMissing} of ${subs.length} randomised subjects signed after their last change`, view: 'lock' },
    { id: 'audit', label: 'Audit trail review done', ok: arOk, evidence: ar ? `Reviewed by ${ar.userId} up to entry ${ar.upToSeq}${arOk ? '' : '; data changed since'}` : 'Not done', view: 'lock' },
    { id: 'privacy', label: 'Privacy check passed', ok: !!p.lock.privacy && priv.length === 0, evidence: priv.length ? `${priv.length} free-text values look like personal data` : p.lock.privacy ? `Confirmed by ${p.lock.privacy.userId}` : 'Scan clean; not yet confirmed', view: 'lock' },
  ]
}

const lockEvent = (p: Project, u: User, action: string, detail: string) => { p.lock.events.push({ utc: nowUtc(p), userId: u.id, action, detail }); audit(p, u, `lock.${action}`, STUDY.protocol, undefined, p.lock.status, detail) }

export function signCasebooks(p: Project, s: Signature, subjects = randomised(p)) {
  for (const subj of subjects) p.lock.piSign[subj] = { userId: s.userId, utc: s.utc, auditSeq: p.audit.length }
  audit(p, SYSTEM, 'casebook.sign', `${subjects.length} casebooks`, undefined, 'signed', `Investigator signature by ${s.userId}: ${s.meaning}`, s.utc)
  p.lock.piSign = { ...p.lock.piSign }
  for (const subj of subjects) p.lock.piSign[subj].auditSeq = p.audit.length
}
export function recordAuditReview(p: Project, findings: string) {
  const u = me(p)
  if (u.role !== 'dm' && u.role !== 'dmlead') throw new Error('Data management records the audit trail review.')
  if (findings.trim().length < 30) throw new Error('Summarise what you reviewed and found (a sentence or two).')
  p.lock.auditReview = { userId: u.id, utc: nowUtc(p), findings: findings.trim(), upToSeq: p.audit.length + 1 }
  audit(p, u, 'audit.review', 'Audit trail', undefined, `up to ${p.audit.length + 1}`, findings.trim())
}
export function confirmPrivacy(p: Project, note: string) {
  const u = me(p)
  if (u.role !== 'dm' && u.role !== 'dmlead') throw new Error('Data management confirms the privacy check.')
  const f = privacyFindings(p)
  if (f.length) throw new Error(`${f.length} free-text values still look like personal data. Query the site to remove them.`)
  p.lock.privacy = { userId: u.id, utc: nowUtc(p), note: note.trim() || 'No direct identifiers in the database; subject IDs only' }
  audit(p, u, 'privacy.check', 'Privacy check', undefined, 'passed', p.lock.privacy.note)
}

export function softLock(p: Project, s: Signature) {
  if (p.lock.status !== 'open') throw new Error('The database is not open.')
  if (!checklist(p).find((c) => c.id === 'data')!.ok) throw new Error('Soft lock needs all data entered.')
  p.lock.status = 'soft'; p.lock.softSig = s
  lockEvent(p, userOf(p, s), 'soft', 'Soft lock: data frozen; changes only through open queries')
}
const userOf = (p: Project, s: Signature): User => p.users.find((u) => u.id === s.userId) ?? SYSTEM
export function addHardSignature(p: Project, s: Signature) {
  const relock = p.lock.status === 'unlocked'
  if (p.lock.status !== 'soft' && !relock) throw new Error(p.lock.status === 'open' ? 'Soft-lock the database first.' : 'The database is already hard-locked.')
  const failing = checklist(p).filter((c) => !c.ok)
  if (failing.length) throw new Error(`Not ready: ${failing.map((c) => c.label).join('; ')}.`)
  p.lock.hardSigs = [...p.lock.hardSigs.filter((x) => x.role !== s.role), s]
  audit(p, userOf(p, s), 'lock.approve', STUDY.protocol, undefined, s.role, `${s.meaning} (${ROLE_LABEL[s.role]})`, s.utc)
  if (p.lock.hardSigs.some((x) => x.role === 'dmlead') && p.lock.hardSigs.some((x) => x.role === 'sponsor')) {
    p.lock.status = 'hard'
    if (relock) { const r = p.lock.unlocks.find((x) => x.status === 'approved')!; r.status = 'relocked'; r.relockedUtc = s.utc }
    lockEvent(p, userOf(p, s), relock ? 'relock' : 'hard', relock ? 'Re-locked after the approved change' : 'Hard lock: database read-only')
  }
}
export function requestUnlock(p: Project, justification: string, subjects: string[]) {
  const u = me(p)
  if (u.role !== 'dm' && u.role !== 'dmlead') throw new Error('Data management requests an unlock.')
  if (p.lock.status !== 'hard') throw new Error('Only a hard-locked database is unlocked.')
  if (justification.trim().length < 40) throw new Error('Justify the unlock: what was found, by whom, and why it matters.')
  const subs = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))]
  if (!subs.length || subs.some((s) => !/^10[1-6]-\d{3}$/.test(s))) throw new Error('Name the subjects to unlock, such as 105-007.')
  const r: UnlockRequest = { id: `UL-${p.lock.unlocks.length + 1}`, justification: justification.trim(), subjects: subs, requestedBy: u.id, utc: nowUtc(p), approvals: [], status: 'requested' }
  p.lock.unlocks.push(r)
  lockEvent(p, u, 'unlock-request', `${r.id} for ${subs.join(', ')}: ${r.justification}`)
}
export function approveUnlock(p: Project, s: Signature) {
  const r = p.lock.unlocks.find((x) => x.status === 'requested'); if (!r) throw new Error('No unlock request is waiting.')
  r.approvals = [...r.approvals.filter((x) => x.role !== s.role), s]
  audit(p, userOf(p, s), 'unlock.approve', r.id, undefined, s.role, s.meaning, s.utc)
  if (r.approvals.some((x) => x.role === 'dmlead') && r.approvals.some((x) => x.role === 'sponsor')) {
    r.status = 'approved'; p.lock.status = 'unlocked'; p.lock.hardSigs = []
    lockEvent(p, userOf(p, s), 'unlocked', `Unlocked for ${r.subjects.join(', ')} under ${r.id}`)
  }
}

// ---------- interim lock ----------

// The date a form belongs to: its visit date, or for log forms the start date of the record.
export function formDate(p: Project, fk: string): string {
  const [subj, visit, form] = fk.split('|')
  if (visit !== 'LOG') return p.forms[fk]?.visitDate ?? value(p, `${subj}|${visit}|SV|1|VISDAT`) ?? ''
  return value(p, `${fk}|${{ AE: 'AESTDAT', CM: 'CMSTDAT', DV: 'DVSTDAT' }[form] ?? 'AESTDAT'}`) || '9999'
}
export function interimChecklist(p: Project, cutoff: string): CheckItem[] {
  const due = seedStudy().entries.filter((e) => e.visitDate <= cutoff)
  const notIn = due.filter((e) => !p.enteredSeed[`${e.subj}|${e.visit}|${e.form}|${e.inst}`]).length
  const forms = Object.keys(p.forms).filter((k) => !p.forms[k].deleted && formDate(p, k) <= cutoff)
  const fset = new Set(forms)
  const q = p.queries.filter((x) => isActive(x) && fset.has(x.key.split('|').slice(0, 4).join('|'))).length
  let req = 0, done = 0
  for (const fk of forms) for (const f of sdvRequired(p, fk)) { req++; if (sdvState(p, `${fk}|${f}`) === 'verified') done++ }
  const cod = Object.values(p.coding).filter((r) => fset.has(r.key.split('|').slice(0, 4).join('|')))
  const notAppr = cod.filter((r) => r.status !== 'approved').length
  const saeOk = !!p.sae.signoffDm && !!p.sae.signoffSafety && (p.sae.cutoff ?? '') >= cutoff
  return [
    { id: 'data', label: `Data up to ${cutoff} entered`, ok: cutoff <= p.clock && notIn === 0, evidence: cutoff > p.clock ? 'The cut-off is in the future' : `${notIn} forms from visits up to the cut-off not entered`, view: 'oversight' },
    { id: 'queries', label: 'Queries on that data closed', ok: q === 0, evidence: `${q} active queries`, view: 'queries' },
    { id: 'sdv', label: 'SDV complete for that data', ok: req > 0 && done === req, evidence: `${done} of ${req} required fields verified`, view: 'oversight' },
    { id: 'coding', label: 'Terms in that data coded and approved', ok: notAppr === 0, evidence: `${cod.length - notAppr} of ${cod.length} approved`, view: 'coding' },
    { id: 'sae', label: 'SAE reconciliation signed at or after the cut-off', ok: saeOk, evidence: saeOk ? `Signed, cut-off ${p.sae.cutoff}` : 'Not signed for this cut-off', view: 'recon' },
  ]
}
// An interim lock freezes a copy of the data up to a cut-off (for an interim analysis or a
// DSMB) while the live database stays open.
export function interimLock(p: Project, cutoff: string, s: Signature): Uint8Array {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error('Give the cut-off as YYYY-MM-DD.')
  const failing = interimChecklist(p, cutoff).filter((c) => !c.ok)
  if (failing.length) throw new Error(`Not ready for the interim lock: ${failing.map((c) => c.label).join('; ')}.`)
  const files = formCsvs(p, cutoff)
  files.unshift({ name: 'README.txt', content: `Interim snapshot of ${STUDY.protocol} (fictional training study): data with visit or start dates up to ${cutoff}, taken ${s.utc}. The live database remains open.\r\n` })
  const checksum = hash(files.map((f) => f.name + f.content).join('\n'))
  p.lock.interims = [...(p.lock.interims ?? []), { cutoff, utc: s.utc, signature: s, checksum, forms: files.length - 1 }]
  lockEvent(p, userOf(p, s), 'interim', `Interim lock at cut-off ${cutoff}; snapshot checksum ${checksum}`)
  return zip(files)
}

// ---------- archive ----------

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

// CDASH-style CSV per form: one row per form instance, one column per CDASH variable.
export function formCsvs(p: Project, cutoff?: string): { name: string; content: string }[] {
  return Object.values(FORMS).map((f) => {
    const keys = Object.keys(p.forms).filter((k) => k.split('|')[2] === f.id && !p.forms[k].deleted && (!cutoff || formDate(p, k) <= cutoff)).sort()
    const head = ['STUDYID', 'SITEID', 'SUBJID', 'VISIT', 'INSTANCE', ...f.fields.map((x) => x.id)]
    const rows = keys.map((k) => { const [subj, visit, , inst] = k.split('|'); return [STUDY.protocol, subj.slice(0, 3), subj, visit, inst, ...f.fields.map((x) => value(p, `${k}|${x.id}`))] })
    return { name: `data/${f.id.toLowerCase()}.csv`, content: csv([head, ...rows]) }
  })
}
export function archiveFiles(p: Project) {
  const files = formCsvs(p)
  files.push({ name: 'audit/audit_trail.csv', content: csv([['SEQ', 'UTC', 'USERID', 'ROLE', 'ACTION', 'ENTITY', 'OLD', 'NEW', 'REASON', 'HASH'], ...p.audit.map((a) => [a.seq, a.utc, a.userId, a.role, a.action, a.entity, a.old, a.new, a.reason, a.hash])]) })
  files.push({ name: 'audit/item_versions.csv', content: csv([['ITEM', 'VERSION', 'VALUE', 'USERID', 'ROLE', 'UTC', 'REASON'], ...Object.values(p.items).flatMap((it) => it.versions.map((v, i) => [it.key, i + 1, v.value, v.userId, v.role, v.utc, v.reason]))]) })
  files.push({ name: 'metadata/edit_checks.csv', content: csv([['ID', 'TITLE', 'CATEGORY', 'ACTION', 'FORM', 'FIELD', 'VISITS', 'LOGIC', 'MESSAGE'], ...p.checks.map((c) => [c.id, c.title, c.category, c.action, c.form, c.field, c.visits?.join(' ') ?? 'all', c.expr, c.message])]) })
  files.push({ name: 'metadata/forms.csv', content: csv([['FORM', 'DOMAIN', 'VARIABLE', 'LABEL', 'TYPE', 'UNIT', 'CODELIST', 'REQUIRED'], ...Object.values(FORMS).flatMap((f) => f.fields.map((x) => [f.id, f.domain, x.id, x.label, x.type, x.unit, x.codelist, x.required ? 'Y' : 'N']))]) })
  files.push({ name: 'metadata/coding.csv', content: csv([['ITEM', 'DICTIONARY', 'VERSION', 'VERBATIM', 'CODE', 'CLASS', 'STATUS', 'CODEDBY', 'APPROVEDBY'], ...Object.values(p.coding).map((r) => [r.key, r.dict, r.version, r.verbatim, r.code, r.atc, r.status, r.codedBy, r.approvedBy])]) })
  files.push({ name: 'metadata/queries.csv', content: csv([['QUERY', 'ITEM', 'SOURCE', 'CHECK', 'STATUS', 'RAISED', 'CLOSED', 'REQUERIES', 'TEXT'], ...p.queries.map((q) => [q.id, q.key, q.source, q.checkId, q.status, q.raisedUtc, q.closedUtc, q.requeries, q.text])]) })
  files.push({ name: 'documents/deviations.csv', content: csv([['ID', 'SUBJID', 'CATEGORY', 'IMPORTANT', 'DESCRIPTION', 'SOURCE', 'RATIONALE'], ...p.deviations.map((d) => [d.id, d.subj, d.category, d.important ? 'Y' : 'N', d.description, d.source, d.rationale])]) })
  files.push({ name: 'documents/signatures.csv', content: csv([['MEANING', 'WHAT', 'USERID', 'ROLE', 'UTC'], ...p.signatures.map((s) => [s.meaning, s.what, s.userId, s.role, s.utc])]) })
  files.push({ name: 'documents/lock_record.csv', content: csv([['UTC', 'USERID', 'ACTION', 'DETAIL'], ...p.lock.events.map((e) => [e.utc, e.userId, e.action, e.detail])]) })
  const readme = [`Archive of ${STUDY.protocol} (fictional training study)`, `Created ${new Date().toISOString()} from project ${p.id}, study date ${p.clock}.`, 'Open formats only: CSV (UTF-8, comma-separated, RFC 4180 quoting) and this text file.', 'data/: one CDASH-style file per eCRF form. audit/: the audit trail and every item version. metadata/: edit checks, forms, coding, queries. documents/: deviations, signatures, lock record.', `Retain until ${retentionDate(p)} (25 years after lock, EU Clinical Trials Regulation Article 58).`]
  files.unshift({ name: 'README.txt', content: readme.join('\r\n') + '\r\n' })
  return files
}
const lockDate = (p: Project) => p.lock.events.filter((e) => e.action === 'hard' || e.action === 'relock').at(-1)?.utc.slice(0, 10) ?? p.clock
export const retentionDate = (p: Project) => `${Number(lockDate(p).slice(0, 4)) + 25}${lockDate(p).slice(4)}`

// A minimal ZIP writer (stored, no compression) so the archive opens anywhere.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
export function zip(files: { name: string; content: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.content), crc = crc32(data)
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true)
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true)
    parts.push(new Uint8Array(h.buffer), name, data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true)
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true)
    central.push(new Uint8Array(c.buffer), name)
    offset += 30 + name.length + data.length
  }
  const size = central.reduce((s, x) => s + x.length, 0)
  const e = new DataView(new ArrayBuffer(22))
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(e.buffer)]
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let o = 0
  for (const x of all) { out.set(x, o); o += x.length }
  return out
}
export function createArchive(p: Project) {
  if (p.lock.status !== 'hard') throw new Error('Archive the database after hard lock.')
  const files = archiveFiles(p)
  const bytes = zip(files)
  const checksum = hash(files.map((f) => f.name + f.content).join('\n'))
  p.lock.archive = { utc: nowUtc(p), retention: retentionDate(p), checksum, files: files.length }
  audit(p, me(p), 'archive.create', `${STUDY.protocol} archive`, undefined, `${files.length} files`, `Checksum ${checksum}; retain until ${p.lock.archive.retention}`)
  return bytes
}

// ---------- prepared scenarios for missions M11 and M12 ----------

function asRole<T>(p: Project, role: Role, fn: () => T): T {
  const id = `scenario-${role}`
  if (!p.users.some((u) => u.id === id)) p.users.push({ id, name: `Training scenario (${ROLE_LABEL[role]})`, role, pin: '', trained: true })
  const prev = p.currentUserId
  p.currentUserId = id
  try { return fn() } finally { p.currentUserId = prev }
}
const sSig = (p: Project, role: Role, meaning: string, what: string): Signature => ({ meaning: `${meaning} (prepared scenario)`, userId: `scenario-${role}`, role, utc: nowUtc(p), what })

function codeFromKey(p: Project, key: string) {
  const r = p.coding[key]; const form = key.split('|')[2]
  const ind = form === 'CM' ? value(p, key.replace('|CMTRT', '|CMINDC')) : ''
  let e = expected(form, r.verbatim, ind, p.smdVersion)
  if (e?.kind === 'query' || !e) e = { kind: 'pt', pt: /dizz/i.test(r.verbatim) ? 'Light-headedness' : /head/i.test(r.verbatim) ? 'Head pain' : 'Upper respiratory tract infection' }
  if (e.kind === 'pt') { const pt = e.pt; const llt = [...smd(p).terms.values()].find((t) => t.level === 'LLT' && t.current && t.name.toLowerCase() === r.verbatim.toLowerCase() && ptOf(smd(p), t.code)?.name === pt) ?? [...smd(p).terms.values()].find((t) => t.level === 'LLT' && t.current && ptOf(smd(p), t.code)?.name === pt); if (llt) codeTerm(p, key, llt.code, undefined, false) }
  else if (e.kind === 'drug') { const ex = e; const d = DRUGS.find((x) => x.generic && x.ingredients.join('+') === ex.ingredient)!; codeTerm(p, key, d.id, ex.atc, false) }
}

// Bring a study to just before lock: everything done except a short list the learner finishes.
export function prepareForLock(p: Project) {
  if (!p.live) preparedStartup(p)
  const target = addDays(LPLV(), 20)
  if (p.clock < target) advance(p, Math.round((Date.parse(target) - Date.parse(p.clock)) / 86400000))
  const closeAll = () => asRole(p, 'dm', () => { for (const q of p.queries.filter((x) => x.status === 'answered')) { const last = q.msgs.at(-1)!.text; if (last.startsWith('Data entered as per source') || last.startsWith('We are not sure')) requery(p, q.id, 'Please check the value against the source document again and confirm?'); else closeQuery(p, q.id) } })
  // SAE and vendor reconciliation.
  asRole(p, 'dm', () => {
    setCutoff(p, p.clock)
    const e = pairs(p).find((x) => x.edc?.subj === '104-006' && !x.sc), c = pairs(p).find((x) => !x.edc && x.sc?.subj === '104-009')
    if (e && c) link(p, e.edc!.fk, c.sc!.caseId)
  })
  for (let round = 0; round < 6; round++) {
    asRole(p, 'dm', () => {
      for (const d of discrepancies(p)) if (inScope(p, d) && statusOf(p, d) === 'open' && d.expected !== 'link') decide(p, d, d.expected, d.expected === 'acceptable' ? 'Same event, same preferred term' : '')
      for (const t of transferLog(p.clock)) if (!p.ext.transfers[t.id]) decideTransfer(p, t, shouldAccept(p, t) ? 'accepted' : 'rejected', shouldAccept(p, t) ? '' : 'Fails the DTA checks')
      for (const v of VENDOR_IDS) for (const d of extDiscrepancies(p, v)) if (!p.ext.decisions[d.id]) { try { decideExt(p, d, d.expected, d.expected === 'acceptable' || d.expected === 'no-action' ? 'Per the DTA' : '') } catch { decideExt(p, d, 'vendor', 'Data clarification to the vendor') } }
      if (!p.ext.rules.length) addRule(p, { vendor: 'CL', test: 'GLUC', from: 'mg/dL', to: 'mmol/L', factor: 18 })
    })
    closeAll()
    advance(p, 8)
  }
  closeAll()
  p.sae.signoffDm ??= sSig(p, 'dm', 'SAE reconciliation complete', 'SAE reconciliation')
  p.sae.signoffSafety ??= sSig(p, 'safety', 'SAE reconciliation complete', 'SAE reconciliation')
  p.ext.signoff ??= sSig(p, 'dm', 'Vendor reconciliations complete', 'Vendor reconciliation')
  // Coding: everything coded and approved except three medications left for the learner.
  const leave = Object.values(p.coding).filter((r) => r.dict === 'SDD' && r.status === 'uncoded').slice(0, 3).map((r) => r.key)
  asRole(p, 'coder', () => { for (const r of Object.values(p.coding)) if ((r.status === 'uncoded' || r.status === 'query' || r.review) && !leave.includes(r.key)) { if (r.status === 'query') r.status = 'uncoded'; r.review = false; codeFromKey(p, r.key) } })
  for (const r of Object.values(p.coding)) if (r.status === 'coded') { r.status = 'approved'; r.approvedBy = 'scenario-dmlead'; r.approvedUtc = nowUtc(p) }
  // Deviations: log the confirmed findings, classify all but two.
  for (const q of p.queries) if (q.status === 'closed' && q.checkId) deviationFromQuery(p, q.checkId, q.key, q.id)
  asRole(p, 'dm', () => { p.deviations.filter((d) => d.status !== 'classified').slice(2).forEach((d) => classify(p, d.id, expectedImportant(d) ?? false, 'Per the deviation plan')) })
  // SDV: all but two subjects at site 106.
  const skip = ['106-008', '106-009']
  asRole(p, 'cra', () => { for (const fk of Object.keys(p.forms)) if (!p.forms[fk].deleted && !skip.includes(fk.slice(0, 7))) for (const f of sdvRequired(p, fk)) if (sdvState(p, `${fk}|${f}`) !== 'verified') verify(p, `${fk}|${f}`) })
  // Four fresh queries, as a last listing review might raise.
  asRole(p, 'dm', () => {
    const picks = ['101-006|W8|VS|1|PULSE', '101-008|W12|VS|1|WEIGHT', '104-010|W4|LB|1|ALT', '105-001|SCR|EG|1|QTCF'].filter((k) => p.items[k])
    for (const k of picks) raiseManual(p, k, `Final review: the value ${value(p, k)} is recorded here. Please confirm it against the source document?`)
  })
  audit(p, SYSTEM, 'scenario.prepare', 'Lock scenario', undefined, p.clock, 'Study prepared to just before lock by the training scenario')
  return p
}
// For M12: finish the lock as the scenario, then report the close-out finding.
export function prepareLocked(p: Project) {
  prepareForLock(p)
  asRole(p, 'dm', () => { for (const q of p.queries.filter(isActive)) if (q.status === 'answered') closeQuery(p, q.id) })
  advance(p, 10)
  asRole(p, 'dm', () => { for (const q of p.queries.filter((x) => x.status === 'answered')) closeQuery(p, q.id) })
  asRole(p, 'coder', () => { for (const r of Object.values(p.coding)) if (r.status !== 'approved') codeFromKey(p, r.key) })
  for (const r of Object.values(p.coding)) if (r.status === 'coded') { r.status = 'approved'; r.approvedBy = 'scenario-dmlead' }
  asRole(p, 'dm', () => { for (const d of p.deviations.filter((x) => x.status !== 'classified')) classify(p, d.id, expectedImportant(d) ?? false, 'Per the deviation plan') })
  asRole(p, 'cra', () => { for (const fk of Object.keys(p.forms)) if (!p.forms[fk].deleted) for (const f of sdvRequired(p, fk)) if (sdvState(p, `${fk}|${f}`) !== 'verified') verify(p, `${fk}|${f}`) })
  for (const f of privacyFindings(p)) asRole(p, 'dm', () => raiseManual(p, f.key, 'This comment appears to contain a name and phone number. Please remove personal identifiers and describe the information without them?'))
  for (let i = 0; i < 10 && p.queries.some(isActive); i++) {
    advance(p, 7)
    asRole(p, 'dm', () => { for (const q of p.queries.filter((x) => x.status === 'answered')) { const last = q.msgs.at(-1)!.text; if (q.requeries < 2 && (last.startsWith('Data entered as per source') || last.startsWith('We are not sure'))) requery(p, q.id, 'Please check the value against the source document again and confirm?'); else closeQuery(p, q.id) } })
  }
  asRole(p, 'coder', () => { for (const r of Object.values(p.coding)) if (r.status !== 'approved' && r.status !== 'coded') { if (r.status === 'query') r.status = 'uncoded'; codeFromKey(p, r.key) } })
  for (const r of Object.values(p.coding)) if (r.status === 'coded') { r.status = 'approved'; r.approvedBy = 'scenario-dmlead' }
  asRole(p, 'dm', () => { for (const d of p.deviations.filter((x) => x.status !== 'classified')) classify(p, d.id, expectedImportant(d) ?? false, 'Per the deviation plan') })
  asRole(p, 'cra', () => { for (const fk of Object.keys(p.forms)) if (!p.forms[fk].deleted) for (const f of sdvRequired(p, fk)) if (sdvState(p, `${fk}|${f}`) !== 'verified') verify(p, `${fk}|${f}`) })
  asRole(p, 'dm', () => { recordAuditReview(p, 'Prepared scenario: audit trail reviewed for unexplained changes, late entries and deletions; none open.'); confirmPrivacy(p, 'Prepared scenario') })
  signCasebooks(p, sSig(p, 'pi', 'I confirm the casebooks are complete and accurate', 'Casebooks'))
  softLock(p, sSig(p, 'dmlead', 'Soft lock approved', 'Soft lock'))
  addHardSignature(p, sSig(p, 'dmlead', 'Hard lock approved', 'Hard lock'))
  addHardSignature(p, sSig(p, 'sponsor', 'Hard lock approved', 'Hard lock'))
  return p
}
export const CLOSE_OUT_REPORT = `Close-out visit report, site 105 (CRA Maya Lindqvist): during the final review of source notes for subject ${CLOSE_OUT.subj}, the CRA found a nosebleed recorded by the investigator about two months after randomisation that was never entered in the EDC as an adverse event. The database is already hard-locked.`
export { VISITS, goLive }
