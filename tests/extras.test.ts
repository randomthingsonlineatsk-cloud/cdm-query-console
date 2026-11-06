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
