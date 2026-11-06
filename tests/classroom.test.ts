import { describe, expect, test } from 'vitest'
import { createProject } from '../src/domain/project'
import { startMission, scoreM13, scoreM1 } from '../src/domain/missions'
import { EXTRACT } from '../src/domain/alcoa'
import { submissionPayload, verifySubmission, SUBMISSION_KIND } from '../src/domain/classroom'

describe('classroom submissions', () => {
  test('a submitted run is compressed, and re-scoring it gives the same score', async () => {
    const p = createProject()
    const run = startMission(p, 'M13'); run.answers = Object.fromEntries(EXTRACT.map((r, i) => [r.seq, i < 15 ? r.answer : 'none'])); scoreM13(p, run)
    const pl = await submissionPayload(p, run)
    expect(pl.project.kind).toBe(SUBMISSION_KIND)
    expect(pl.project.gz.length).toBeLessThan(JSON.stringify(p).length / 3)
    const v = await verifySubmission(pl.project)
    expect(v.score).toBe(run.score)
  })
  test('a reported score that was edited is caught by re-scoring', async () => {
    const p = createProject()
    const run = startMission(p, 'M1'); scoreM1(p, run)
    const pl = await submissionPayload(p, run)
    pl.project.score = 100
    const v = await verifySubmission(pl.project)
    expect(v.score).toBe(run.score)
    expect(v.score).toBeLessThan(100)
  })
  test('an unfinished run cannot be submitted', async () => {
    const p = createProject()
    await expect(submissionPayload(p, startMission(p, 'M13'))).rejects.toThrow(/Finish/)
  })
})
