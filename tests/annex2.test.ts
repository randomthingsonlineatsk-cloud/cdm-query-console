import { describe, test, expect } from 'vitest'
import { createProject } from '../src/domain/project'
import { startMission, scoreM18, MISSIONS, MISSION_PROJECT } from '../src/domain/missions'
import { ROWS, SOURCES, scoreAnnex2, STREAM_NAMES, HEADS } from '../src/domain/annex2'

describe('M18 decentralised data (ICH E6(R3) Annex 2)', () => {
  test('is listed and runs without a prepared project', () => {
    expect(MISSIONS.some((m) => m.id === 'M18')).toBe(true)
    expect(MISSION_PROJECT.M18).toBe('none')
  })
  test('thirty records, six per stream, every action used, every row cites Annex 2 and explains', () => {
    expect(ROWS).toHaveLength(30)
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(30)
    for (let i = 0; i < STREAM_NAMES.length; i++) {
      const rs = ROWS.filter((r) => r.stream === i)
      expect(rs).toHaveLength(6)
      for (const r of rs) expect(r.cells).toHaveLength(HEADS[i].length)
    }
    expect(new Set(ROWS.map((r) => r.answer))).toEqual(new Set(['none', 'site', 'provider', 'investigator', 'deviation', 'escalate', 'limitation']))
    for (const r of ROWS) { expect(r.section).toMatch(/\d/); expect(r.why.length).toBeGreaterThan(30) }
    expect(SOURCES).toHaveLength(5)
  })
  test('perfect answers score 100; marking everything fine fails', () => {
    const p = createProject(); const run = startMission(p, 'M18')
    run.answers = Object.fromEntries(ROWS.map((r) => [r.id, r.answer])); scoreM18(p, run)
    expect(run.score).toBe(100); expect(run.passed).toBe(true)
    const lazy = scoreAnnex2(Object.fromEntries(ROWS.map((r) => [r.id, 'none'])))
    expect(lazy.score).toBeLessThan(70); expect(lazy.missed).toBe(ROWS.filter((r) => r.answer !== 'none').length)
  })
  test('expert level costs extra for missed problems', () => {
    const p = createProject(); p.missionLevel = 'expert'; const run = startMission(p, 'M18')
    run.answers = Object.fromEntries(ROWS.map((r, i) => [r.id, i === 1 ? 'none' : r.answer])); scoreM18(p, run)
    expect(run.score).toBe(Math.round(29 / 30 * 100) - 5)
  })
})
