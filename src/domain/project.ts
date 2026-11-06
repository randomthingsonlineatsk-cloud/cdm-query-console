// Project state and every operation that changes it. Each operation writes the audit trail.
// Data values are append-only: a change adds a version with who, when, why and the old value.

import type { AuditEntry, Item, ItemKey, Project, Query, Role, Signature, User } from './types'
import { formKeyOf, parseKey } from './types'
import { freshChecks, SHIPPED_CHECKS } from './checks'
import { runChecksOnSubject, formsOfSubject } from './engine'
import { seedStudy, RESPONSE_DAYS, SEED_VERSION, type Entry, type Issue } from './seed'
import { FORMS, SITES, VISITS } from './study'
import { addDays, hash, simUtc, nowMinutes } from './util'
import { scoreQuery, isActive } from './queries'
import { syncCoding } from './coding'
import { processSafety } from './safety'
import { processVendors } from './external'
import { deviationFromQuery, processMonitoring } from './oversight'

export const DEFAULT_USERS: User[] = [
  { id: 'arao', name: 'Asha Rao', role: 'dm', pin: '1111', trained: true },
  { id: 'jweber', name: 'Jonas Weber', role: 'dmlead', pin: '2222', trained: true },
  { id: 'mlind', name: 'Maya Lindqvist', role: 'cra', pin: '3333', trained: true },
  { id: 'pkulk', name: 'Priya Kulkarni', role: 'site', pin: '4444', trained: false },
  { id: 'emarsh', name: 'Dr Elena Marsh', role: 'pi', pin: '5555', trained: true },
  { id: 'tibarra', name: 'Tomás Ibarra', role: 'coder', pin: '6666', trained: true },
  { id: 'rmenon', name: 'Dr Ravi Menon', role: 'safety', pin: '7777', trained: true },
]
export const SYSTEM: User = { id: 'system', name: 'System', role: 'system', pin: '', trained: true }
export const simSiteUser = (site: string): User => ({ id: `site${site}`, name: `Site ${site} coordinator (simulated)`, role: 'site', siteId: site, pin: '', trained: true })
export const PRE_GO_LIVE = '2026-02-23'

export function createProject(userId = 'local-user', classId = 'none'): Project {
  const now = new Date().toISOString()
  const p: Project = {
    schema: 1, id: `prj-${Date.now().toString(36)}`, name: 'HLV-204-201 data management', classId, userId,
    createdUtc: now, updatedUtc: now,
    users: DEFAULT_USERS.map((u) => ({ ...u })), currentUserId: 'arao',
    clock: PRE_GO_LIVE, live: false, checks: freshChecks(),
    items: {}, forms: {}, queries: [], nextQuery: 1, coderTasks: [], enteredSeed: {},
    startup: { dmpFlags: {}, uat: [], risk: {}, qtl: {} },
    audit: [], signatures: [], missions: [],
    seedVersion: SEED_VERSION, coding: {}, synonyms: {}, smdVersion: '1.0',
    sae: { links: {}, decisions: {}, safetyFixes: {}, createdCases: [] },
    ext: { transfers: {}, decisions: {}, rules: [], vendorFixes: {} },
    sdv: {}, sdvPlan: { mode: 'targeted' }, deviations: [], monitoring: { decisions: {}, forCause: {} }, qtlLog: [],
  }
  audit(p, SYSTEM, 'project.create', p.id, undefined, p.name, 'New project from the study template', simUtc(p.clock, 9 * 60))
  return p
}

// Bring a project saved by an earlier version up to the current data model.
export function migrate(p: Project): Project {
  p.coderTasks ??= []; p.enteredSeed ??= {}; p.missions ??= []; p.signatures ??= []
  p.coding ??= {}; p.synonyms ??= {}; p.smdVersion ??= '1.0'
  p.sae ??= { links: {}, decisions: {}, safetyFixes: {}, createdCases: [] }
  p.ext ??= { transfers: {}, decisions: {}, rules: [], vendorFixes: {} }
  p.sdv ??= {}; p.sdvPlan ??= { mode: 'targeted' }; p.deviations ??= []; p.monitoring ??= { decisions: {}, forCause: {} }; p.qtlLog ??= []
  for (const u of DEFAULT_USERS) if (!p.users.some((x) => x.id === u.id)) p.users.push({ ...u })
  for (const c of SHIPPED_CHECKS) if (!p.checks.some((x) => x.id === c.id)) p.checks.push({ ...c, tests: c.tests.map((t) => ({ ...t })) })
  return p
}
export const outdatedSeed = (p: Project) => (p.seedVersion ?? 1) < SEED_VERSION

export const userById = (p: Project, id: string): User => p.users.find((u) => u.id === id) ?? (id === 'system' ? SYSTEM : id.startsWith('site') ? simSiteUser(id.slice(4)) : SYSTEM)
export const me = (p: Project) => userById(p, p.currentUserId)
export const nowUtc = (p: Project) => simUtc(p.clock, nowMinutes())

export function audit(p: Project, u: User, action: string, entity: string, old?: string, nw?: string, reason?: string, utc = nowUtc(p)) {
  const prev = p.audit[p.audit.length - 1]?.hash ?? '0'
  const e: Omit<AuditEntry, 'hash'> = { seq: p.audit.length + 1, utc, userId: u.id, role: u.role, action, entity, old, new: nw, reason }
  p.audit.push({ ...e, hash: hash(prev + JSON.stringify(e)) })
  p.updatedUtc = new Date().toISOString()
}
// Index of the first entry whose hash does not match, or -1 when the chain is intact.
export function verifyAudit(p: Project): number {
  let prev = '0'
  for (let i = 0; i < p.audit.length; i++) {
    const { hash: h, ...e } = p.audit[i]
    if (hash(prev + JSON.stringify(e)) !== h) return i
    prev = h
  }
  return -1
}

export const value = (p: Project, key: ItemKey) => { const it = p.items[key]; return it ? it.versions[it.versions.length - 1].value : '' }

export function writeValue(p: Project, key: ItemKey, v: string, u: User, reason: string, utc = nowUtc(p)): boolean {
  const it: Item = p.items[key] ?? (p.items[key] = { key, versions: [] })
  const old = it.versions.length ? it.versions[it.versions.length - 1].value : undefined
  if (old === v) return false
  it.versions.push({ value: v, userId: u.id, role: u.role, utc, reason })
  audit(p, u, old === undefined ? 'item.create' : 'item.update', key, old, v, reason, utc)
  return true
}

export function enterForm(p: Project, subj: string, visit: string, form: string, inst: number, values: Record<string, string>, u: User, utc: string, visitDate?: string) {
  const fk = `${subj}|${visit}|${form}|${inst}`
  const isNew = !p.forms[fk]
  if (isNew) {
    p.forms[fk] = { key: fk, status: 'entered', enteredUtc: utc, enteredBy: u.id, visitDate }
    audit(p, u, 'form.create', fk, undefined, FORMS[form].name, 'Form opened for data entry', utc)
  }
  for (const f of FORMS[form].fields) {
    if (f.derived) { if (isNew) writeValue(p, `${fk}|${f.id}`, '', SYSTEM, 'Derived field created', utc); continue }
    const v = values[f.id] ?? ''
    if (isNew) writeValue(p, `${fk}|${f.id}`, v, u, 'Initial entry', utc)
  }
}

export function deleteForm(p: Project, fk: string, u: User, reason: string, utc = nowUtc(p)) {
  const fs = p.forms[fk]; if (!fs || fs.deleted) return
  fs.deleted = true; fs.deletedReason = reason
  audit(p, u, 'form.delete', fk, 'active', 'deleted', reason, utc)
  for (const q of p.queries) if (isActive(q) && formKeyOf(q.key) === fk) closeQ(p, q, SYSTEM, 'autoclose', 'Form deleted; query closed by the system.', utc)
}

// ---------- queries ----------

const respondDays = (q: Query) => {
  const prof = SITES.find((s) => s.id === q.key.slice(0, 3))!.profile
  const [lo, hi] = RESPONSE_DAYS[prof]
  const d = lo + (parseInt(hash(q.id + q.requeries).slice(-6), 16) % (hi - lo + 1))
  // Safety-related queries are chased by the CRA, so even slow sites answer within a week.
  return q.text.startsWith('SAE reconciliation') ? Math.min(d, 7) : d
}

function newQuery(p: Project, key: ItemKey, source: Query['source'], text: string, u: User, utc: string, checkId?: string): Query {
  const q: Query = { id: `Q-${String(p.nextQuery++).padStart(5, '0')}`, key, source, checkId, status: 'open', raisedBy: u.id, raisedUtc: utc, text, requeries: 0, msgs: [{ utc, userId: u.id, role: u.role, kind: 'raise', text }] }
  if (source === 'manual') q.quality = scoreQuery(text).score
  q.dueDate = addDays(utc.slice(0, 10), respondDays(q))
  p.queries.push(q)
  audit(p, u, 'query.raise', `${q.id} on ${key}`, undefined, 'open', text, utc)
  return q
}

const CAN_RAISE: Role[] = ['dm', 'dmlead', 'cra', 'coder']
const CAN_CLOSE: Role[] = ['dm', 'dmlead']

export function raiseManual(p: Project, key: ItemKey, text: string, u = me(p)): Query {
  if (!CAN_RAISE.includes(u.role)) throw new Error('Only data management, monitoring or coding staff raise queries.')
  if (!text.trim()) throw new Error('Write the query text.')
  if (p.queries.some((q) => isActive(q) && q.key === key && q.source === 'manual')) throw new Error('This data point already has an open manual query.')
  return newQuery(p, key, 'manual', text.trim(), u, nowUtc(p))
}

export function respond(p: Project, id: string, text: string, u = me(p), utc = nowUtc(p)) {
  const q = p.queries.find((x) => x.id === id)!
  if (u.role !== 'site' && u.role !== 'pi') throw new Error('Only site staff answer queries.')
  if (q.status !== 'open') throw new Error('Only an open query can be answered.')
  q.status = 'answered'; q.answeredUtc = utc; q.dueDate = undefined
  q.msgs.push({ utc, userId: u.id, role: u.role, kind: 'response', text })
  audit(p, u, 'query.answer', q.id, 'open', 'answered', text, utc)
}

function closeQ(p: Project, q: Query, u: User, kind: 'close' | 'autoclose' | 'cancel', text: string, utc: string) {
  const from = q.status
  q.status = kind === 'cancel' ? 'cancelled' : 'closed'; q.closedUtc = utc; q.dueDate = undefined
  q.valueAtClose = value(p, q.key)
  q.msgs.push({ utc, userId: u.id, role: u.role, kind, text })
  audit(p, u, kind === 'cancel' ? 'query.cancel' : 'query.close', q.id, from, q.status, text, utc)
}
export function closeQuery(p: Project, id: string, text = 'Response accepted.', u = me(p)) {
  const q = p.queries.find((x) => x.id === id)!
  if (!CAN_CLOSE.includes(u.role) && !(u.role === 'cra' && q.raisedBy === u.id)) throw new Error('Data management closes queries.')
  if (q.status !== 'answered') throw new Error('Close a query after the site has answered it.')
  closeQ(p, q, u, 'close', text, nowUtc(p))
  if (q.checkId) deviationFromQuery(p, q.checkId, q.key, q.id)
}
export function cancelQuery(p: Project, id: string, reason: string, u = me(p)) {
  const q = p.queries.find((x) => x.id === id)!
  if (!CAN_CLOSE.includes(u.role) && q.raisedBy !== u.id) throw new Error('Data management cancels queries.')
  if (!isActive(q)) throw new Error('This query is no longer active.')
  if (!reason.trim()) throw new Error('A reason is required to cancel a query.')
  closeQ(p, q, u, 'cancel', reason.trim(), nowUtc(p))
}
export function requery(p: Project, id: string, text: string, u = me(p)) {
  const q = p.queries.find((x) => x.id === id)!
  if (!CAN_CLOSE.includes(u.role) && q.raisedBy !== u.id) throw new Error('Data management re-queries.')
  if (q.status !== 'answered') throw new Error('Re-query after the site has answered.')
  if (!text.trim()) throw new Error('Write the re-query text.')
  const utc = nowUtc(p)
  q.status = 'open'; q.requeries++; q.answeredUtc = undefined
  q.quality = scoreQuery(text).score
  q.msgs.push({ utc, userId: u.id, role: u.role, kind: 'requery', text: text.trim() })
  q.dueDate = addDays(p.clock, respondDays(q))
  audit(p, u, 'query.requery', q.id, 'answered', 'open', text.trim(), utc)
}

// ---------- edit-check run ----------

export function runChecks(p: Project, subjects: string[], utc = nowUtc(p)) {
  for (const subj of subjects) {
    const firings = runChecksOnSubject(p, subj)
    const live = new Set<string>()
    for (const f of firings) {
      live.add(`${f.checkId}@${f.key}`)
      if (f.action === 'autofix') {
        if (f.fixValue !== undefined && p.items[f.key]) writeValue(p, f.key, f.fixValue, SYSTEM, `Derived by edit check ${f.checkId}`, utc)
        continue
      }
      if (f.action === 'coder') {
        if (!p.coderTasks.some((t) => t.key === f.key && t.checkId === f.checkId && t.status === 'pending')) {
          p.coderTasks.push({ id: `CT-${p.coderTasks.length + 1}`, key: f.key, checkId: f.checkId, utc, status: 'pending', text: f.text })
          audit(p, SYSTEM, 'coder.task', f.key, undefined, f.checkId, f.text, utc)
        }
        continue
      }
      const cur = value(p, f.key)
      const known = p.queries.some((q) => q.checkId === f.checkId && q.key === f.key && (isActive(q) || q.valueAtClose === cur))
      if (!known) newQuery(p, f.key, 'auto', f.text, SYSTEM, utc, f.checkId)
    }
    for (const q of p.queries) {
      if (q.source !== 'auto' || !isActive(q) || !q.key.startsWith(subj + '|')) continue
      if (!live.has(`${q.checkId}@${q.key}`)) closeQ(p, q, SYSTEM, 'autoclose', 'Data changed and the edit check no longer fires; closed by the system.', utc)
    }
    for (const t of p.coderTasks) if (t.status === 'pending' && t.key.startsWith(subj + '|') && !live.has(`${t.checkId}@${t.key}`)) t.status = 'done'
  }
  syncCoding(p, subjects, utc)
}
export const allSubjects = () => seedStudy().subjects.map((s) => s.id)

// ---------- simulated sites and the study clock ----------

const seedByForm = () => {
  const m = new Map<string, Entry>()
  for (const e of seedStudy().entries) m.set(`${e.subj}|${e.visit}|${e.form}|${e.inst}`, e)
  return m
}
let seedIndex: Map<string, Entry> | null = null
export const seedEntry = (fk: string) => (seedIndex ??= seedByForm()).get(fk)
export function issueFor(key: ItemKey): Issue | undefined {
  const k = parseKey(key)
  const same = seedStudy().issues.filter((i) => i.subj === k.subj && i.visit === k.visit && i.form === k.form && i.inst === k.inst)
  return same.find((i) => i.field === k.field) ?? same[0]
}

function siteRespond(p: Project, q: Query, date: string) {
  const site = q.key.slice(0, 3)
  const u = simSiteUser(site)
  const utc = simUtc(date, 10 * 60 + (parseInt(q.id.slice(-3), 10) % 360))
  const fk = formKeyOf(q.key)
  const k = parseKey(q.key)
  const lastText = q.msgs.filter((m) => m.kind === 'raise' || m.kind === 'requery').pop()?.text ?? ''
  if (q.source === 'manual' && (q.quality ?? scoreQuery(lastText).score) < 50) { respond(p, q.id, 'We are not sure what is being asked. Please clarify which value should be checked and against what.', u, utc); return }
  const prof = SITES.find((s) => s.id === site)!.profile
  const issue = issueFor(q.key)
  const seed = seedEntry(fk)
  // A new coordinator sometimes confirms an error on the first pass; a re-query gets it fixed.
  if (prof === 'new-coordinator' && q.requeries === 0 && issue?.kind === 'error' && parseInt(hash(q.id).slice(-4), 16) % 10 < 4) { respond(p, q.id, 'Data entered as per source.', u, utc); return }
  if (issue?.find && 'listing' in issue.find && issue.find.listing === 'ae-dup') {
    respond(p, q.id, 'This is a duplicate entry of the same event. The duplicate record has been deleted.', u, utc)
    deleteForm(p, fk, u, `Duplicate entry deleted in response to ${q.id}`, utc); return
  }
  if (issue?.find && 'listing' in issue.find && issue.find.listing === 'sae-missing') {
    const h = seedStudy().hidden.find((e) => e.subj === k.subj && e.inst === issue.inst)
    if (h && !p.forms[`${k.subj}|LOG|AE|${h.inst}`]) enterForm(p, k.subj, 'LOG', 'AE', h.inst, h.values, u, utc)
    respond(p, q.id, 'The SAE was reported to drug safety on the SAE form but not entered in the EDC. The AE record has now been entered.', u, utc)
    runChecks(p, [k.subj], utc); return
  }
  if (issue?.find && 'listing' in issue.find && issue.find.listing === 'cm-ae') {
    const inst = Math.max(0, ...Object.keys(p.forms).filter((x) => x.startsWith(`${k.subj}|LOG|AE|`)).map((x) => Number(x.split('|')[3]))) + 1
    const cm = seed?.truth ?? {}
    enterForm(p, k.subj, 'LOG', 'AE', inst, { AETERM: 'Knee pain', AESTDAT: cm.CMSTDAT ?? date, AEONGO: 'N', AEENDAT: cm.CMENDAT ?? '', AESEV: 'MILD', AESER: 'N', AEREL: 'NOT RELATED', AEACN: 'DOSE NOT CHANGED', AEOUT: 'RECOVERED/RESOLVED' }, u, utc)
    respond(p, q.id, 'The investigator reviewed this: the knee pain was an adverse event. An AE record has been added.', u, utc)
    runChecks(p, [k.subj], utc); return
  }
  let changed = false
  if (seed && (!issue || issue.kind === 'error')) {
    for (const [field, tv] of Object.entries(seed.truth)) {
      const key = `${fk}|${field}`
      if (p.items[key] && FORMS[k.form].fields.find((f) => f.id === field && !f.derived) && value(p, key) !== tv) {
        writeValue(p, key, tv, u, `Transcription error; corrected per source document (${q.id})`, utc); changed = true
      }
    }
  }
  const text = changed ? 'Corrected per source document.'
    : issue?.kind === 'true-value' ? (issue.find && 'check' in issue.find && issue.find.check === 'IC-04' ? 'Confirmed: the subject signed v1.0. The subject was re-consented on v2.0 and a protocol deviation has been filed.' : 'Value confirmed as per source document.')
    : 'The value is correct as per the source document. No change made.'
  respond(p, q.id, text, u, utc)
  if (changed) runChecks(p, [k.subj], utc)
}

export function goLive(p: Project) {
  p.live = true
  audit(p, SYSTEM, 'study.go-live', 'HLV-204-201', 'build', 'live', 'Production database released for data entry')
}

// Move the study clock forward. Sites enter visits as they happen (with their usual lag)
// and answer queries on their usual timetable.
export function advance(p: Project, days: number) {
  if (!p.live) throw new Error('The study is not live yet. Finish start-up first.')
  const entries = seedStudy().entries
  for (let d = 0; d < days; d++) {
    p.clock = addDays(p.clock, 1)
    const touched = new Set<string>()
    for (const e of entries) {
      if (e.entryDate > p.clock) break
      const fk = `${e.subj}|${e.visit}|${e.form}|${e.inst}`
      if (p.enteredSeed[fk]) continue
      p.enteredSeed[fk] = true
      enterForm(p, e.subj, e.visit, e.form, e.inst, e.values, simSiteUser(e.site), simUtc(e.entryDate, 9 * 60 + (e.inst * 7 + e.subj.charCodeAt(5) * 3) % 420), e.form === 'SV' ? e.visitDate : e.visit === 'LOG' ? undefined : e.visitDate)
      touched.add(e.subj)
    }
    if (touched.size) runChecks(p, [...touched], simUtc(p.clock, 18 * 60))
    for (const q of p.queries) if (q.status === 'open' && q.dueDate && q.dueDate <= p.clock) siteRespond(p, q, p.clock)
    processSafety(p); processVendors(p); processMonitoring(p)
  }
  audit(p, SYSTEM, 'clock.advance', 'study clock', undefined, p.clock, `Advanced ${days} day${days === 1 ? '' : 's'}`, simUtc(p.clock, 23 * 60))
}

// ---------- user edits in the casebook ----------

export function editValue(p: Project, key: ItemKey, v: string, reason: string, u = me(p)) {
  if (u.role !== 'site' && u.role !== 'pi') throw new Error('Only site staff change casebook data. Data management raises a query instead.')
  if (!reason.trim()) throw new Error('A reason for change is required.')
  const ch = writeValue(p, key, v, u, reason.trim())
  if (ch) runChecks(p, [parseKey(key).subj])
  return ch
}

// ---------- signatures (two parts: user ID and PIN) ----------

export function sign(p: Project, userId: string, pin: string, meaning: string, what: string, roles: Role[]): Signature | string {
  const u = p.users.find((x) => x.id === userId)
  if (!u || u.pin !== pin) { audit(p, u ?? SYSTEM, 'signature.fail', what, undefined, undefined, 'User ID or PIN not recognised'); return 'User ID or PIN not recognised.' }
  if (!roles.includes(u.role)) return `This signature needs the role: ${roles.join(' or ')}.`
  const s: Signature = { meaning, userId: u.id, role: u.role, utc: nowUtc(p), what }
  p.signatures.push(s)
  audit(p, u, 'signature', what, undefined, meaning, `Signed by ${u.name} (${u.id}) with user ID and PIN`, s.utc)
  return s
}

export const VISIT_NAME = Object.fromEntries([...VISITS.map((v) => [v.id, v.name]), ['LOG', 'Subject logs']])
