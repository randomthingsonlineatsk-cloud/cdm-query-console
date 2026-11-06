import { describe, expect, test } from 'vitest'
import { createProject, createVaxProject, advance, value } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { VAX_CHECKS } from '../src/domain/vax/checks'
import { runTest } from '../src/domain/engine'
import { validate } from '../src/domain/expr'
import { CTX_FNS } from '../src/domain/checks'
import { VAX_FORMS, gradeMm, gradeTemp } from '../src/domain/vax/study'
import { vaxSeed } from '../src/domain/vax/seed'
import { compliance, reconRows, transfers, immRows } from '../src/domain/vax/diary'
import { FORMS, SITES, STUDY } from '../src/domain/study'

describe('vaccine study ALV-3-301', () => {
  test('every vaccine check parses and passes its own tests', () => {
    for (const c of VAX_CHECKS) {
      expect(validate(c.expr, VAX_FORMS[c.form].fields.map((f) => f.id), CTX_FNS), c.id).toBe('')
      expect(c.tests.length, c.id).toBeGreaterThanOrEqual(2)
      for (const t of c.tests) expect(runTest(c, t), `${c.id} ${t.name}`).toBe(t.fire)
    }
  })
  test('FDA 2007 grading edges', () => {
    expect([24, 25, 50, 51, 100, 101].map(gradeMm)).toEqual([0, 1, 1, 2, 2, 3])
    expect([37.9, 38.0, 38.4, 38.5, 38.9, 39.0, 40.0, 40.1].map(gradeTemp)).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
  })
  test('switching study swaps the definition and back', () => {
    const v = createVaxProject(); applyStudy(v)
    expect(STUDY.protocol).toBe('ALV-3-301'); expect(SITES.map((s) => s.id)).toEqual(['201', '202', '203', '204']); expect(FORMS.VAX).toBeTruthy()
    applyStudy(createProject())
    expect(STUDY.protocol).toBe('HLV-204-201'); expect(SITES).toHaveLength(6); expect(FORMS.VAX).toBeUndefined(); expect(FORMS.EX).toBeTruthy()
  })
  test('seed: 60 participants, 3 screen failures, diaries for both doses', () => {
    const s = vaxSeed()
    expect(s.subjects).toHaveLength(60)
    expect(s.subjects.filter((x) => x.fate === 'screen-fail')).toHaveLength(3)
    expect(s.vax.requests).toHaveLength(6)
    expect(s.vax.diary.length).toBeGreaterThan(700)
  })
  test('the study runs: entry, checks, diary compliance', () => {
    const p = createVaxProject(); applyStudy(p)
    advance(p, 20)
    expect(Object.keys(p.forms).length).toBeGreaterThan(50)
    const c = compliance(p)
    expect(c.due).toBeGreaterThan(40)
    expect(c.pct).toBeGreaterThan(75); expect(c.pct).toBeLessThan(97)
    expect(transfers(p).length).toBeGreaterThan(5)
    expect(value(p, '201-001|D1|VAX|1|EXOCCUR')).toBe('Y')
  }, 60000)
  test('reconciliation and lab rows appear after dose 2', () => {
    const p = createVaxProject(); applyStudy(p)
    advance(p, 78)
    const rows = reconRows(p)
    const exp = (id: string) => rows.find((r) => r.id.startsWith(id))?.expected
    expect(exp('react|201-005|1|REDNESS')).toBe('site')
    expect(exp('device|201-007')).toBe('vendor')
    expect(exp('medvisit|202-005|1')).toBe('site')
    expect(rows.some((r) => r.expected === 'match')).toBe(true)
    expect(immRows(p).length).toBeGreaterThan(10)
    applyStudy(createProject())
  }, 120000)
})

import { prepareMission, startMission, scoreM14, scoreM15, scoreM16, scoreM17, latestRun } from '../src/domain/missions'
import { TRAIL } from '../src/domain/vax/missions'
import { decideDcf, markRecon, sendAlert, viewOf } from '../src/domain/vax/diary'
import { submissionPayload, verifySubmission } from '../src/domain/classroom'
import { ROLE_LABEL } from '../src/domain/types'

const prepVax = (id: string) => prepareMission(createProject(), id, createProject, { lock: () => {}, locked: () => {} })
describe('vaccine missions', () => {
  test('M15: the right decisions score 100; sending everything fails', () => {
    const p = prepVax('M15')
    const run = latestRun(p, 'M15')!
    for (const r of vaxSeed().vax.requests) decideDcf(p, r.id, r.expected, 'Reason recorded', r.to)
    scoreM15(p, run); expect(run.score).toBe(100)
    const q = prepVax('M15'); const r2 = latestRun(q, 'M15')!
    for (const r of vaxSeed().vax.requests) decideDcf(q, r.id, 'send', 'Send all', r.to)
    scoreM15(q, r2); expect(r2.passed).toBe(false)
  }, 120000)
  test('M16: marking every row as its key says scores 100', () => {
    const p = prepVax('M16')
    const run = latestRun(p, 'M16')!
    const key: { id: string; expected: 'match' | 'site' | 'vendor' }[] = JSON.parse(run.answers!.key)
    expect(key.filter((x) => x.expected !== 'match').length).toBeGreaterThan(3)
    for (const x of key) markRecon(p, x.id, x.expected)
    scoreM16(p, run); expect(run.score).toBe(100)
  }, 120000)
  test('M14: alerting every open day beats ignoring them', () => {
    const play = (alert: boolean) => {
      const p = prepVax('M14'); const run = latestRun(p, 'M14')!
      for (let i = 0; i < 16; i++) {
        advance(p, 1)
        if (alert) for (const x of vaxSeed().vax.diary) if (viewOf(p, x) === 'open') sendAlert(p, `${x.subj}|${x.dose}|${x.day}`, '')
      }
      scoreM14(p, run); return run.score!
    }
    const good = play(true), bad = play(false)
    expect(good).toBeGreaterThanOrEqual(70); expect(bad).toBeLessThan(70); expect(good).toBeGreaterThan(bad)
  }, 240000)
  test('M17: perfect answers score 100', () => {
    const p = createProject(); const run = startMission(p, 'M17')
    run.answers = Object.fromEntries(TRAIL.map((r) => [r.seq, r.answer])); scoreM17(p, run)
    expect(run.score).toBe(100)
    expect(TRAIL.filter((r) => r.answer !== 'none').length).toBeGreaterThanOrEqual(8)
  })
})

describe('blinding and classroom', () => {
  test('only the vaccine project has the unblinded pharmacist', () => {
    expect(createVaxProject().users.some((u) => u.role === 'pharm')).toBe(true)
    expect(createProject().users.some((u) => u.role === 'pharm')).toBe(false)
    expect(ROLE_LABEL.pharm).toMatch(/Unblinded/)
  })
  test('a vaccine submission re-scores to the same score, and the open study is restored', async () => {
    const p = prepVax('M15'); const run = latestRun(p, 'M15')!
    for (const r of vaxSeed().vax.requests.slice(0, 4)) decideDcf(p, r.id, r.expected, 'Reason', r.to)
    scoreM15(p, run)
    const pl = await submissionPayload(p, run)
    const home = createProject(); applyStudy(home)
    const v = await verifySubmission(pl.project, home)
    expect(v.score).toBe(run.score)
    expect(STUDY.protocol).toBe('HLV-204-201')
  }, 120000)
})
