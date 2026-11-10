import { describe, expect, test } from 'vitest'
import { createProject } from '../src/domain/project'
import { startMission, scoreM13, MISSIONS } from '../src/domain/missions'
import { EXTRACT, tagsFor, scoreExtract } from '../src/domain/alcoa'

describe('M13 audit the trail', () => {
  test('twenty entries, twelve violations; perfect answers score 100, all "no issue" fails', () => {
    expect(EXTRACT).toHaveLength(20)
    expect(EXTRACT.filter((r) => r.answer !== 'none')).toHaveLength(12)
    expect(new Set(EXTRACT.filter((r) => r.answer !== 'none').map((r) => r.answer)).size).toBe(9)
    const p = createProject()
    const run = startMission(p, 'M13'); run.answers = Object.fromEntries(EXTRACT.map((r) => [r.seq, r.answer])); scoreM13(p, run)
    expect(run.score).toBe(100)
    expect(scoreExtract(Object.fromEntries(EXTRACT.map((r) => [r.seq, 'none']))).score).toBe(40)
    expect(MISSIONS).toHaveLength(20)
  })
  test('own audit trail entries are labelled', () => {
    const p = createProject()
    expect(tagsFor(p.audit[0])).toContain('Attributable')
  })
})

import { progress, scoreM1 } from '../src/domain/missions'
import { preparedStartup } from '../src/domain/missions'
import { DMP } from '../src/domain/dmp'
describe('levels', () => {
  test('deadlines scale with the level, expert doubles penalties, progress does not finish the run', () => {
    const g = createProject(); preparedStartup(g); g.missionLevel = 'guided'
    const rg = startMission(g, 'M3')
    expect(rg.level).toBe('guided')
    expect(Date.parse(rg.answers!.deadline) - Date.parse(rg.answers!.start)).toBe(63 * 86400000)
    const before = g.audit.length
    const pr = progress(g, rg)!
    expect(pr.score).toBeGreaterThanOrEqual(0)
    expect(rg.score).toBeUndefined(); expect(g.audit.length).toBe(before)
    const e = createProject(); e.missionLevel = 'expert'
    for (const st of DMP.flatMap((s) => s.statements)) p1(e, st)
    const re = startMission(e, 'M1'); scoreM1(e, re)
    const s = createProject()
    for (const st of DMP.flatMap((x) => x.statements)) p1(s, st)
    const rs = startMission(s, 'M1'); scoreM1(s, rs)
    expect(re.score!).toBeLessThan(rs.score!)
  })
})
function p1(p: ReturnType<typeof createProject>, st: { id: string; error?: { correct: string } }) { if (st.error) p.startup.dmpFlags[st.id] = st.error.correct; else if (st.id === '1.1' || st.id === '2.1') p.startup.dmpFlags[st.id] = 'x1' }

import { prepareMission as prep, MISSION_PROJECT, M4_SCENARIOS, scoreM4 } from '../src/domain/missions'
import { upgradeImpact } from '../src/domain/coding'
const noLock = { lock: () => {}, locked: () => {} }
describe('prepared projects and spec sizes', () => {
  test('every mission has a project plan', () => { expect(Object.keys(MISSION_PROJECT)).toHaveLength(20) })
  test('M5: 30 AE verbatims, auto-coding off for AEs', () => {
    const p = prep(createProject(), 'M5', createProject, noLock)
    const run = p.missions.at(-1)!
    const scope: string[] = JSON.parse(run.answers!.scope)
    expect(scope).toHaveLength(30)
    expect(scope.every((k) => p.coding[k].status === 'uncoded' && k.includes('|AE|'))).toBe(true)
    expect(Object.values(p.coding).some((r) => r.key.includes('|CM|') && r.method === 'auto')).toBe(true)
  })
  test('M8: the prepared project has coded terms the upgrade affects', () => {
    const p = prep(createProject(), 'M8', createProject, noLock)
    expect(upgradeImpact(p).some((i) => i.kind === 'recode')).toBe(true)
  })
  test('M4: ten drafts; an unchanged draft scores zero', () => {
    expect(M4_SCENARIOS).toHaveLength(10)
    const p = createProject(); const run = startMission(p, 'M4')
    run.answers = Object.fromEntries(M4_SCENARIOS.map((s) => [s.id, s.poor])); scoreM4(p, run)
    expect(run.score).toBe(0)
  })
})

import { advance as adv, closeQuery as closeQ, value as val } from '../src/domain/project'
import { addDeviation, classify as classifyDv } from '../src/domain/oversight'
import { prepareLocked, interimChecklist, interimLock } from '../src/domain/lock'
import { sign as signFn } from '../src/domain/project'
describe('form gaps and interim lock', () => {
  test('drug accountability derives compliance and flags the non-compliant subject; unscheduled visits arrive', () => {
    const p = createProject(); preparedStartup(p); adv(p, 160)
    const c = val(p, '101-001|W4|EX|1|EXCOMPL')
    expect(Number(c)).toBeGreaterThan(80)
    expect(p.queries.some((q) => q.checkId === 'EX-10' && q.key.startsWith('104-007|W8'))).toBe(true)
    expect(Object.keys(p.forms).some((k) => k.includes('|UNS|SV|'))).toBe(true)
    expect(p.queries.some((q) => q.checkId === 'SV-08')).toBe(true)
  })
  test('a deviation is recorded on the DV form and its classification too', () => {
    const p = createProject(); preparedStartup(p); adv(p, 40); p.currentUserId = 'arao'
    const d = addDeviation(p, { subj: '101-001', category: 'Visit window', description: 'Week 2 visit two days late', source: 'Manual' })
    expect(d.dvForm).toBeDefined()
    classifyDv(p, d.id, false, 'Not the primary endpoint visit')
    expect(val(p, `${d.dvForm}|DVIMPT`)).toBe('N')
  })
  test('interim lock takes a snapshot of clean data up to a cut-off', () => {
    const p = createProject(); prepareLocked(p)
    expect(interimChecklist(p, '2026-06-01').every((i) => i.ok)).toBe(true)
    const s = signFn(p, 'jweber', '2222', 'Interim', 'x', ['dmlead']) as never
    const z = interimLock(p, '2026-06-01', s)
    expect(z[0]).toBe(0x50)
    expect(p.lock.interims).toHaveLength(1)
    void closeQ
  })
})

import { exportBuild, checkBuild, importBuild, applyStudy } from '../src/domain/build'
import { FORMS as F, VISITS as V } from '../src/domain/study'
describe('study build files', () => {
  test('export, amend, check, import, and back to the shipped build', () => {
    const p = createProject()
    const b = exportBuild(p)
    expect(checkBuild(JSON.stringify(b)).errors).toEqual([])
    b.study.buildVersion = '1.1'; b.study.source = 'EDC Study Build Lab'
    b.visits.find((v) => v.id === 'W4')!.hi = 34
    b.forms.VS.fields.push({ id: 'VSPOS', label: 'Position', type: 'text' })
    b.checks.find((c) => c.id === 'VS-07')!.expr = 'SYSBP < 70 or SYSBP > 230'
    const r = checkBuild(JSON.stringify(b))
    expect(r.errors).toEqual([])
    expect(r.changes.join(' ')).toMatch(/W4 window.*New field VS.VSPOS.*VS-07 changed/s)
    const bad = structuredClone(b); bad.forms.VS.fields = bad.forms.VS.fields.filter((f) => f.id !== 'SYSBP')
    expect(checkBuild(JSON.stringify(bad)).errors[0]).toMatch(/SYSBP is missing/)
    const preg = structuredClone(b)
    preg.forms.PREG = { id: 'PREG', name: 'Pregnancy test', domain: 'LB', fields: [{ id: 'PREGRES', label: 'Result', type: 'text' }] }
    preg.visits.find((v) => v.id === 'SCR')!.forms.push('PREG')
    const rp = checkBuild(JSON.stringify(preg))
    expect(rp.errors).toEqual([])
    expect(rp.changes.join(' ')).toMatch(/New form PREG \(Pregnancy test\) at SCR/)
    expect(rp.warnings.join(' ')).toMatch(/simulated sites do not enter it/)
    preg.forms.PREG.fields = []
    expect(checkBuild(JSON.stringify(preg)).errors[0]).toMatch(/at least one field/)
    p.currentUserId = 'jweber'
    importBuild(p, r.build!, { meaning: 'x', userId: 'jweber', role: 'dmlead', utc: '', what: '' })
    expect(V.find((v) => v.id === 'W4')!.hi).toBe(34)
    expect(F.VS.fields.some((f) => f.id === 'VSPOS')).toBe(true)
    applyStudy(createProject())
    expect(V.find((v) => v.id === 'W4')!.hi).toBe(32)
    expect(F.VS.fields.some((f) => f.id === 'VSPOS')).toBe(false)
  })
})

import { CCG_FIELD, fieldGuide } from '../src/domain/dmp'
describe('field-level completion guidelines', () => {
  test('every eCRF field has its own instruction, and none is for a field that does not exist', () => {
    applyStudy(createProject())
    const all = Object.values(F).flatMap((fm) => fm.fields.map((x) => `${fm.id}.${x.id}`))
    expect(all.filter((k) => !CCG_FIELD[k])).toEqual([])
    expect(Object.keys(CCG_FIELD).filter((k) => !all.includes(k))).toEqual([])
    const g = fieldGuide('VS', F.VS.fields.find((x) => x.id === 'SYSBP')!)
    expect(g.rules).toContain('Unit: mmHg')
    expect(fieldGuide('VS', F.VS.fields.find((x) => x.id === 'BMI')!).rules[0]).toBe('Derived by the system')
  })
  test('the build file carries them, and an amended line is reported', () => {
    const p = createProject()
    const b = exportBuild(p)
    expect(Object.keys(b.ccg.fields!).length).toBe(Object.keys(CCG_FIELD).length)
    b.ccg.fields!['VS.WEIGHT'] = 'Weigh on the calibrated clinic scale, one decimal place.'
    const r = checkBuild(JSON.stringify(b))
    expect(r.errors).toEqual([])
    expect(r.changes.some((c) => c.includes('Field-level completion guidelines: 1'))).toBe(true)
    importBuild(p, r.build!, { meaning: 'x', userId: 'jweber', role: 'dmlead', utc: '', what: '' })
    expect(CCG_FIELD['VS.WEIGHT']).toContain('calibrated')
    applyStudy(createProject())
    expect(CCG_FIELD['VS.WEIGHT']).not.toContain('calibrated')
  })
})
