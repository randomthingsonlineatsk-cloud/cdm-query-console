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
    expect(MISSIONS).toHaveLength(13)
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
  test('every mission has a project plan', () => { expect(Object.keys(MISSION_PROJECT)).toHaveLength(13) })
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
