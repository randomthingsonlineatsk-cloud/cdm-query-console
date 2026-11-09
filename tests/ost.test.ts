import { describe, expect, test } from 'vitest'
import { createProject, createOstProject, advance, value } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { OST_CHECKS } from '../src/domain/ost/checks'
import { OST_FORMS } from '../src/domain/ost/study'
import { ostSeed, OST_SCREEN_FAIL } from '../src/domain/ost/seed'
import { runTest } from '../src/domain/engine'
import { validate } from '../src/domain/expr'
import { CTX_FNS } from '../src/domain/checks'
import { FORMS, SITES, STUDY } from '../src/domain/study'
import { expected } from '../src/domain/coding'
import { VENDOR_IDS, DTAS } from '../src/domain/external'
import { safetyBase } from '../src/domain/safety'
import { checklist, prepareLocked } from '../src/domain/lock'

describe('Ostrevia trial HRP-301 (VERDANT-1)', () => {
  test('every check parses and passes its own tests; IDs are unique', () => {
    for (const c of OST_CHECKS) {
      expect(validate(c.expr, OST_FORMS[c.form].fields.map((f) => f.id), CTX_FNS), c.id).toBe('')
      expect(c.tests.length, c.id).toBeGreaterThanOrEqual(2)
      for (const t of c.tests) expect(runTest(c, t), `${c.id} ${t.name}`).toBe(t.fire)
    }
    expect(new Set(OST_CHECKS.map((c) => c.id)).size).toBe(OST_CHECKS.length)
  })
  test('switching study swaps the definition, vendors and back', () => {
    const o = createOstProject(); applyStudy(o)
    expect(STUDY.protocol).toBe('HRP-301'); expect(SITES.map((s) => s.id)).toEqual(['301', '302', '303', '304']); expect(FORMS.HEA).toBeTruthy()
    expect(VENDOR_IDS).toEqual(['CL', 'IRT']); expect(DTAS.CL.file).toMatch(/^HRP301_/)
    applyStudy(createProject())
    expect(STUDY.protocol).toBe('HLV-204-201'); expect(FORMS.HEA).toBeUndefined(); expect(VENDOR_IDS).toEqual(['CL', 'ECG', 'IRT']); expect(DTAS.CL.file).toMatch(/^HLV204201_/)
  })
  test('seed: 48 participants, 3 screen failures, every AE and medication codable', () => {
    const s = ostSeed()
    expect(s.subjects).toHaveLength(48)
    expect(s.subjects.filter((x) => x.fate === 'screen-fail').map((x) => x.id).sort()).toEqual(Object.keys(OST_SCREEN_FAIL).sort())
    expect(s.issues.length).toBeGreaterThanOrEqual(18)
    for (const e of s.entries.filter((x) => x.form === 'AE' || x.form === 'MH')) expect(expected(e.form, e.truth[e.form === 'AE' ? 'AETERM' : 'MHTERM']), `${e.subj} ${e.truth.AETERM ?? e.truth.MHTERM}`).toBeTruthy()
    for (const e of s.entries.filter((x) => x.form === 'CM')) expect(expected('CM', e.truth.CMTRT, e.truth.CMINDC), e.truth.CMTRT).toBeTruthy()
  })
  test('every planted issue is found by its check once the data are in', () => {
    const p = createOstProject(); applyStudy(p)
    advance(p, 180)
    const missed: string[] = []
    for (const i of ostSeed().issues) {
      if (!('check' in i.find)) continue
      const key = `${i.subj}|${i.visit}|${i.form}|${i.inst}|`
      const hit = p.queries.some((q) => q.checkId === (i.find as { check: string }).check && q.key.startsWith(key))
      if (!hit) missed.push(`${i.id} ${i.subj} ${i.visit} ${i.form}.${i.field} ${(i.find as { check: string }).check}`)
    }
    expect(missed).toEqual([])
    expect(value(p, '301-001|D1|EX|1|EXDISP')).toBe('Y')
    expect(safetyBase().cases.length).toBe(3)
    applyStudy(createProject())
  }, 300000)
  test('the study can be taken to hard lock with every checklist item met', () => {
    const p = createOstProject(); applyStudy(p)
    prepareLocked(p)
    const open = checklist(p).filter((c) => !c.ok).map((c) => `${c.id}: ${c.evidence}`)
    expect(p.lock.status, open.join('\n')).toBe('hard')
    applyStudy(createProject())
  }, 600000)
})

describe('mission M20: lock the Ostrevia trial', () => {
  test('prepares an HRP-301 project just before lock, and scores a learner who finishes', async () => {
    const { prepareMission, latestRun, SCORERS } = await import('../src/domain/missions')
    const { prepareForLock, signCasebooks, softLock, addHardSignature, recordAuditReview, confirmPrivacy, privacyFindings } = await import('../src/domain/lock')
    const { classify, expectedImportant } = await import('../src/domain/oversight')
    const base = createProject()
    const p = prepareMission(base, 'M20', createProject, { lock: prepareForLock, locked: () => {} })
    expect(p.study).toBe('HRP-301'); expect(STUDY.protocol).toBe('HRP-301')
    const left = p.deviations.filter((d) => d.status !== 'classified')
    expect(left.length).toBe(2)
    p.currentUserId = 'arao'
    for (const d of left) classify(p, d.id, expectedImportant(d) ?? false, 'Per the deviation plan')
    void privacyFindings; void recordAuditReview; void confirmPrivacy; void signCasebooks; void softLock; void addHardSignature
    const run = latestRun(p, 'M20')!
    SCORERS.M20(p, run)
    expect(run.score).toBe(15) // deviations right; not yet locked, no review, no investigator signature
    applyStudy(createProject())
  }, 300000)
})
