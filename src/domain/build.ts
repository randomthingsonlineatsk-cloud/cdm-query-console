// Study build files: the hand-over between a build tool (the planned EDC Study Build Lab) and
// this console. A build holds the visit schedule, the eCRF forms, the codelists, the edit
// checks and the CRF completion guidelines. The format is documented in
// docs/study-build-format.md.
//
// The simulated sites follow protocol HLV-204-201, so an imported build may amend the study
// (labels, required flags, windows, new fields, codelist values, new or changed checks, new
// guideline text) but may not remove a visit, form or field the protocol uses.

import type { Check, Project, Signature } from './types'
import { FORMS, VISITS, CODELISTS, STUDY, type FormDef, type Visit } from './study'
import { CCG_GENERAL, CCG_FORM, CCG_FIELD } from './dmp'
import { SHIPPED_CHECKS, CTX_FNS } from './checks'
import { validate } from './expr'
import { runTest } from './engine'
import { audit, me, nowUtc } from './project'
import { seedStudy } from './seed'

export const BUILD_FORMAT = 'cdm-study-build'
export interface StudyBuild {
  format: typeof BUILD_FORMAT; version: 1
  study: { protocol: string; title: string; buildVersion: string; source: string }
  visits: Visit[]
  forms: Record<string, FormDef>
  codelists: Record<string, { value: string; label: string }[]>
  checks: Check[]
  ccg: { general: string[]; forms: Record<string, string[]>; fields?: Record<string, string> }
}

// The built-in study as shipped, kept so a project without an imported build gets it back.
const DEFAULT = structuredClone({ visits: VISITS, forms: FORMS, codelists: CODELISTS, general: CCG_GENERAL, ccgForms: CCG_FORM, ccgFields: CCG_FIELD })

export function exportBuild(p: Project): StudyBuild {
  return {
    format: BUILD_FORMAT, version: 1,
    study: { protocol: STUDY.protocol, title: STUDY.title, buildVersion: p.build?.study.buildVersion ?? '1.0', source: 'CDM Query & Edit-Check Console' },
    visits: structuredClone(VISITS), forms: structuredClone(FORMS), codelists: structuredClone(CODELISTS),
    checks: structuredClone(p.checks), ccg: { general: [...CCG_GENERAL], forms: structuredClone(CCG_FORM), fields: { ...CCG_FIELD } },
  }
}

export interface BuildReport { errors: string[]; changes: string[]; warnings: string[]; build?: StudyBuild }
export function checkBuild(text: string): BuildReport {
  const errors: string[] = [], changes: string[] = [], warnings: string[] = []
  let b: StudyBuild
  try { b = JSON.parse(text) } catch { return { errors: ['The file is not valid JSON.'], changes, warnings } }
  if (b?.format !== BUILD_FORMAT || b.version !== 1) return { errors: [`This is not a ${BUILD_FORMAT} version 1 file.`], changes, warnings }
  if (b.study?.protocol !== STUDY.protocol) errors.push(`The build is for protocol ${b.study?.protocol ?? '(none)'}; this console runs ${STUDY.protocol}.`)
  if (!Array.isArray(b.visits) || typeof b.forms !== 'object' || typeof b.codelists !== 'object' || !Array.isArray(b.checks)) errors.push('The build needs visits, forms, codelists and checks.')
  if (errors.length) return { errors, changes, warnings }
  // Visits: all protocol visits kept, windows may move.
  for (const v of DEFAULT.visits) {
    const n = b.visits.find((x) => x.id === v.id)
    if (!n) { errors.push(`Visit ${v.id} is missing; the protocol needs it.`); continue }
    for (const f of v.forms) if (!n.forms.includes(f)) errors.push(`Visit ${v.id} no longer has form ${f}.`)
    if (n.lo !== v.lo || n.hi !== v.hi) changes.push(`Visit ${v.id} window: days ${v.lo} to ${v.hi} → ${n.lo} to ${n.hi}`)
    if (n.name !== v.name) changes.push(`Visit ${v.id} renamed “${n.name}”`)
    for (const f of n.forms) if (!v.forms.includes(f)) changes.push(`Visit ${v.id} gains form ${f}`)
  }
  for (const n of b.visits) if (!DEFAULT.visits.some((v) => v.id === n.id)) changes.push(`New visit ${n.id} (${n.name}): the simulated sites will not enter it`)
  // Forms and fields.
  for (const [id, f] of Object.entries(DEFAULT.forms)) {
    const n = b.forms[id]
    if (!n) { errors.push(`Form ${id} is missing.`); continue }
    for (const fld of f.fields) {
      const m = n.fields?.find((x) => x.id === fld.id)
      if (!m) { errors.push(`Field ${id}.${fld.id} is missing.`); continue }
      if (m.type !== fld.type) errors.push(`Field ${id}.${fld.id} changes type from ${fld.type} to ${m.type}.`)
      if (m.label !== fld.label) changes.push(`${id}.${fld.id} label → “${m.label}”`)
      if (!!m.required !== !!fld.required) changes.push(`${id}.${fld.id} ${m.required ? 'now required' : 'no longer required'}`)
      if (!!m.ctq !== !!fld.ctq) changes.push(`${id}.${fld.id} ${m.ctq ? 'now critical to quality (targeted SDV)' : 'no longer critical to quality'}`)
    }
    for (const m of n.fields ?? []) if (!f.fields.some((x) => x.id === m.id)) { changes.push(`New field ${id}.${m.id} (${m.label})`); if (m.required) warnings.push(`${id}.${m.id} is new and required: forms already entered will have it blank.`) }
  }
  for (const id of Object.keys(b.forms)) if (!DEFAULT.forms[id]) { errors.push(`New form ${id}: add new forms in a later build version of the console; this one only amends HLV-204-201.`) }
  // Codelists: values may be added, not removed (entered data would no longer be valid).
  for (const [id, list] of Object.entries(DEFAULT.codelists)) {
    const n = b.codelists[id]; if (!n) { errors.push(`Codelist ${id} is missing.`); continue }
    for (const v of list) if (!n.some((x) => x.value === v.value)) errors.push(`Codelist ${id} drops the value ${v.value}.`)
    for (const v of n) if (!list.some((x) => x.value === v.value)) changes.push(`Codelist ${id} gains ${v.value}`)
  }
  // Checks: every one must parse against its form and pass its own test cases.
  const ids = new Set<string>()
  for (const c of b.checks) {
    if (!c.id || ids.has(c.id)) { errors.push(`Check ${c.id || '(no id)'} is missing an id or repeats one.`); continue }
    ids.add(c.id)
    const form = b.forms[c.form]
    if (!form) { errors.push(`Check ${c.id} is on unknown form ${c.form}.`); continue }
    if (!form.fields.some((f) => f.id === c.field)) errors.push(`Check ${c.id} targets unknown field ${c.form}.${c.field}.`)
    const err = validate(c.expr, form.fields.map((f) => f.id), CTX_FNS)
    if (err) { errors.push(`Check ${c.id}: ${err}`); continue }
    if (!Array.isArray(c.tests) || c.tests.length < 2) warnings.push(`Check ${c.id} has fewer than two test cases.`)
    const failing = (c.tests ?? []).filter((t) => runTest(c, t) !== t.fire)
    if (failing.length) warnings.push(`Check ${c.id}: ${failing.length} test case(s) fail (${failing.map((t) => t.name).join(', ')}). UAT will show it.`)
    const old = SHIPPED_CHECKS.find((x) => x.id === c.id)
    if (!old) changes.push(`New check ${c.id} (${c.title})`)
    else if (old.expr !== c.expr || old.message !== c.message || old.active !== c.active) changes.push(`Check ${c.id} changed`)
  }
  for (const c of SHIPPED_CHECKS) if (!ids.has(c.id)) changes.push(`Check ${c.id} removed`)
  if (b.ccg && JSON.stringify(b.ccg.forms) !== JSON.stringify(DEFAULT.ccgForms)) changes.push('CRF completion guidelines updated')
  if (b.ccg?.fields) {
    const n = Object.keys(b.ccg.fields).filter((k) => b.ccg.fields![k] !== DEFAULT.ccgFields[k]).length
    if (n) changes.push(`Field-level completion guidelines: ${n} changed or added`)
    for (const k of Object.keys(b.ccg.fields)) { const [fm, fd] = k.split('.'); if (!b.forms[fm]?.fields.some((x) => x.id === fd)) warnings.push(`Completion guideline ${k} is for a field that is not in the build.`) }
  }
  return { errors, changes, warnings, build: errors.length ? undefined : b }
}

// Put the study definition in force: the project's imported build, or the shipped study.
export function applyStudy(p: Project) {
  seedStudy() // the simulated study is always generated from the shipped build
  const src = p.build ?? { visits: DEFAULT.visits, forms: DEFAULT.forms, codelists: DEFAULT.codelists, ccg: { general: DEFAULT.general, forms: DEFAULT.ccgForms, fields: DEFAULT.ccgFields } }
  VISITS.splice(0, VISITS.length, ...structuredClone(src.visits))
  for (const k of Object.keys(FORMS)) delete FORMS[k]
  Object.assign(FORMS, structuredClone(src.forms))
  for (const k of Object.keys(CODELISTS)) delete CODELISTS[k]
  Object.assign(CODELISTS, structuredClone(src.codelists))
  CCG_GENERAL.splice(0, CCG_GENERAL.length, ...src.ccg.general)
  for (const k of Object.keys(CCG_FORM)) delete CCG_FORM[k]
  Object.assign(CCG_FORM, structuredClone(src.ccg.forms))
  for (const k of Object.keys(CCG_FIELD)) delete CCG_FIELD[k]
  Object.assign(CCG_FIELD, { ...DEFAULT.ccgFields, ...(src.ccg.fields ?? {}) })
}

export function importBuild(p: Project, b: StudyBuild, s: Signature) {
  const u = me(p)
  if (p.lock?.status === 'soft' || p.lock?.status === 'hard') throw new Error('The database is locked: a new build cannot go in.')
  p.build = structuredClone(b)
  p.checks = structuredClone(b.checks)
  applyStudy(p)
  // A change to production checks needs new UAT before it counts as validated.
  if (p.startup.uatSigned) p.startup.uatSigned = undefined
  audit(p, u, 'build.import', `Study build ${b.study.buildVersion}`, undefined, `${b.checks.length} checks, ${Object.keys(b.forms).length} forms`, `Imported from ${b.study.source}; approved by ${s.userId}`, s.utc)
  p.signatures.push(s)
}
export function resetBuild(p: Project) {
  const u = me(p)
  p.build = undefined
  applyStudy(p)
  audit(p, u, 'build.reset', 'Study build', undefined, 'shipped build', 'Returned to the build shipped with the console', nowUtc(p))
}
