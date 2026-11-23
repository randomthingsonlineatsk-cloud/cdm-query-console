import { describe, expect, test } from 'vitest'
import { createProject, createOnkProject, enterForm, SYSTEM } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { ONK_CHECKS } from '../src/domain/onk/checks'
import { ONK_FORMS } from '../src/domain/onk/study'
import { onkSeed } from '../src/domain/onk/seed'
import { runTest, runChecksOnSubject } from '../src/domain/engine'
import { validate } from '../src/domain/expr'
import { CTX_FNS } from '../src/domain/checks'
import { FORMS, SITES, STUDY } from '../src/domain/study'
import { VENDOR_IDS, DTAS } from '../src/domain/external'
import type { Project } from '../src/domain/types'

const fkOf = (e: { subj: string; visit: string; form: string; inst: number }) => `${e.subj}|${e.visit}|${e.form}|${e.inst}`
function casebook(which: 'truth' | 'values'): Project {
  const p = createOnkProject(); applyStudy(p); p.clock = '2026-12-31'
  for (const e of onkSeed().entries) enterForm(p, e.subj, e.visit, e.form, e.inst, e[which], SYSTEM, `${e.entryDate}T09:00:00Z`, e.visitDate)
  return p
}
const firings = (p: Project) => [...new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))].flatMap((s) => runChecksOnSubject(p, s)).filter((f) => f.action === 'query')

describe('Oncology trial ONK-44-302 (MERIDIAN-2)', () => {
  test('every check parses and passes its own tests; IDs are unique', () => {
    for (const c of ONK_CHECKS) {
      expect(validate(c.expr, ONK_FORMS[c.form].fields.map((f) => f.id), CTX_FNS), c.id).toBe('')
      expect(c.tests.length, c.id).toBeGreaterThanOrEqual(2)
      for (const t of c.tests) expect(runTest(c, t), `${c.id} ${t.name}`).toBe(t.fire)
    }
    expect(new Set(ONK_CHECKS.map((c) => c.id)).size).toBe(ONK_CHECKS.length)
  })
  test('switching study swaps the definition and the vendor', () => {
    applyStudy(createOnkProject())
    expect(STUDY.protocol).toBe('ONK-44-302'); expect(SITES.map((s) => s.id)).toEqual(['401', '402']); expect(FORMS.TRM).toBeTruthy()
    expect(VENDOR_IDS).toEqual(['IRC']); expect(DTAS.IRC.file).toMatch(/^ONK44302_/)
    applyStudy(createProject())
    expect(FORMS.TRM).toBeUndefined(); expect(VENDOR_IDS).toEqual(['CL', 'ECG', 'IRT'])
  })
  test('the seed holds 48 screened and 42 randomised participants', () => {
    const s = onkSeed()
    expect(s.subjects).toHaveLength(48)
    expect(s.subjects.filter((x) => x.d1)).toHaveLength(42)
    expect(s.issues.filter((i) => i.kind === 'true-value')).toHaveLength(4)
    expect(s.issues.filter((i) => i.kind === 'error')).toHaveLength(13)
  })
  test('on the source records only the four true-value findings fire', () => {
    const p = casebook('truth')
    const got = firings(p).map((f) => `${f.checkId}@${f.key.split('|').slice(0, 4).join('|')}`).sort()
    const want = onkSeed().issues.filter((i) => i.kind === 'true-value').map((i) => `${'check' in i.find ? i.find.check : ''}@${fkOf(i)}`).sort()
    expect(got).toEqual(want)
    applyStudy(createProject())
  })
  test('each planted error fires its check on the entered values', () => {
    const p = casebook('values')
    const got = new Set(firings(p).map((f) => `${f.checkId}@${f.key.split('|').slice(0, 4).join('|')}`))
    for (const i of onkSeed().issues) expect(got.has(`${'check' in i.find ? i.find.check : ''}@${fkOf(i)}`), `${i.id} ${i.note}`).toBe(true)
    applyStudy(createProject())
  })
})

import { prepareLocked } from '../src/domain/lock'
import { value } from '../src/domain/project'
import { extDiscrepancies } from '../src/domain/external'
describe('ONK-44-302 locked database', () => {
  test('cleaned and hard-locked, the casebook equals the source records', () => {
    const p = createOnkProject(); applyStudy(p)
    prepareLocked(p)
    expect(p.lock.status).toBe('hard')
    const diffs: string[] = []
    for (const e of onkSeed().entries) {
      const fk = fkOf(e)
      if (!p.forms[fk] || p.forms[fk].deleted) { diffs.push(`${fk} missing`); continue }
      for (const [f, v] of Object.entries(e.truth)) if (value(p, `${fk}|${f}`) !== v) diffs.push(`${fk}|${f}: ${value(p, `${fk}|${f}`)} ≠ ${v}`)
    }
    expect(diffs).toEqual([])
    const extra = Object.keys(p.forms).filter((k) => !p.forms[k].deleted && !k.includes('|DV|') && !onkSeed().entries.some((e) => fkOf(e) === k))
    expect(extra).toEqual([])
    expect(extDiscrepancies(p, 'IRC').filter((d) => !p.ext.decisions[d.id])).toEqual([])
    applyStudy(createProject())
  }, 120000)
})

describe('missions M22 to M24 on ONK-44-302', () => {
  test('M22 prepares the study at 21 September and scores the cleaning of both sites', async () => {
    const { prepareMission, latestRun, SCORERS } = await import('../src/domain/missions')
    const { advance, closeQuery } = await import('../src/domain/project')
    const p = prepareMission(createProject(), 'M22', createProject, { lock: () => {}, locked: () => {} })
    expect(p.study).toBe('ONK-44-302'); expect(p.clock).toBe('2026-09-21')
    p.currentUserId = 'arao'
    const { requery } = await import('../src/domain/project')
    for (let i = 0; i < 8; i++) {
      for (const q of p.queries.filter((x) => x.status === 'answered')) { const t = q.msgs.at(-1)!.text; if (t.startsWith('Data entered as per source')) requery(p, q.id, 'Please check the value against the source document again and confirm?'); else closeQuery(p, q.id) }
      advance(p, 7)
    }
    for (const q of p.queries.filter((x) => x.status === 'answered')) closeQuery(p, q.id)
    const run = latestRun(p, 'M22')!
    SCORERS.M22(p, run)
    expect(run.detail![0]).toBe('17 of 17 issues resolved')
    expect(run.score).toBeGreaterThanOrEqual(70)
    applyStudy(createProject())
  }, 300000)
  test('M23 prepares the reads at 9 November; correct decisions pass', async () => {
    const { prepareMission, latestRun, SCORERS } = await import('../src/domain/missions')
    const { transferLog, shouldAccept, decideTransfer, extDiscrepancies, decideExt, signExt } = await import('../src/domain/external')
    const p = prepareMission(createProject(), 'M23', createProject, { lock: () => {}, locked: () => {} })
    expect(p.clock).toBe('2026-11-09'); expect(VENDOR_IDS).toEqual(['IRC'])
    p.currentUserId = 'arao'
    const ts = transferLog(p.clock)
    expect(ts.filter((t) => !shouldAccept(p, t)).map((t) => t.id)).toEqual(['IRC-2026-05-04', 'IRC-2026-08-03'])
    for (const t of ts) decideTransfer(p, t, shouldAccept(p, t) ? 'accepted' : 'rejected', shouldAccept(p, t) ? '' : 'Fails the DTA')
    const ds = extDiscrepancies(p, 'IRC')
    const by = (c: string) => ds.filter((d) => d.expected === c).map((d) => d.id)
    expect(by('vendor').sort()).toEqual(['IRC:401-011|W12:missing-vendor', 'IRC:402-018|W18:date'])
    expect(by('acceptable').length).toBeGreaterThanOrEqual(8)
    for (const d of ds) decideExt(p, d, d.expected, 'Per the DTA')
    signExt(p, { meaning: 'Vendor reconciliation complete', userId: 'arao', role: 'dm', utc: `${p.clock}T10:00:00Z`, what: 'Vendor reconciliation' })
    const run = latestRun(p, 'M23')!
    SCORERS.M23(p, run)
    expect(run.score).toBe(100)
    applyStudy(createProject())
  }, 300000)
  test('M24 prepares the study just before lock', async () => {
    const { prepareMission, latestRun, SCORERS } = await import('../src/domain/missions')
    const { prepareForLock } = await import('../src/domain/lock')
    const { classify, expectedImportant } = await import('../src/domain/oversight')
    const p = prepareMission(createProject(), 'M24', createProject, { lock: prepareForLock, locked: () => {} })
    expect(p.study).toBe('ONK-44-302')
    const left = p.deviations.filter((d) => d.status !== 'classified')
    expect(left.length).toBeGreaterThanOrEqual(1)
    p.currentUserId = 'arao'
    for (const d of left) classify(p, d.id, expectedImportant(d) ?? false, 'Per the deviation plan')
    const run = latestRun(p, 'M24')!
    SCORERS.M24(p, run)
    expect(run.score).toBe(15)
    applyStudy(createProject())
  }, 300000)
})

describe('ONK-44-302 adverse events and SAE reconciliation', () => {
  test('M25 prepares the SAEs at 9 November with the planted safety database differences', async () => {
    const { prepareMission, latestRun } = await import('../src/domain/missions')
    const p = prepareMission(createProject(), 'M25', createProject, { lock: () => {}, locked: () => {} })
    expect(p.clock).toBe('2026-11-09')
    const key: { id: string; expected: string }[] = JSON.parse(latestRun(p, 'M25')!.answers!.key)
    const kinds = key.map((k) => `${k.id.split('|')[0]} ${k.id.split('#')[1]} ${k.expected}`)
    expect(kinds).toContain('402-036 missing-safety not-reported')
    expect(kinds).toContain('401-010 onset safety')
    expect(kinds).toContain('401-032 outcome safety')
    expect(Object.values(p.coding).filter((r) => r.key.includes('|AE|')).every((r) => r.status !== 'uncoded')).toBe(true)
    applyStudy(createProject())
  }, 300000)
})
