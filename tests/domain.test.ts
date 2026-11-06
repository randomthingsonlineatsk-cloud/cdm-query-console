import 'fake-indexeddb/auto'
import { describe, expect, test } from 'vitest'
import { parse, evaluate, validate, BUILTINS } from '../src/domain/expr'
import { SHIPPED_CHECKS, CHECK_BUGS, freshChecks } from '../src/domain/checks'
import { runTest } from '../src/domain/engine'
import { generateStudy } from '../src/domain/seed'
import { createProject, advance, writeValue, verifyAudit, raiseManual, respond, closeQuery, requery, cancelQuery, value, SYSTEM, enterForm, runChecks, editValue } from '../src/domain/project'
import { preparedStartup, startMission, scoreM1, scoreM2, scoreM4, scoreM3, M4_SCENARIOS } from '../src/domain/missions'
import { DMP } from '../src/domain/dmp'
import { scoreQuery, metrics } from '../src/domain/queries'
import { exportFile, importFile, saveProject, loadProject } from '../src/domain/store'

const ctx = (vals: Record<string, string>) => ({ get: (n: string) => vals[n] ?? '', fn: {} })

describe('expression language', () => {
  test('arithmetic, comparison and logic', () => {
    expect(evaluate(parse('SYSBP < 80 or SYSBP > 220'), ctx({ SYSBP: '1480' }))).toBe(true)
    expect(evaluate(parse('SYSBP < 80 or SYSBP > 220'), ctx({ SYSBP: '148' }))).toBe(false)
    expect(evaluate(parse('round(80 / (1.75 * 1.75), 1)'), ctx({}))).toBe(26.1)
    expect(evaluate(parse("X in ('A', 'b')"), ctx({ X: 'B' }))).toBe(true)
    expect(evaluate(parse('not present(X)'), ctx({ X: '' }))).toBe(true)
  })
  test('blank never satisfies a range comparison', () => {
    expect(evaluate(parse('K < 2 or K > 7'), ctx({ K: '' }))).toBe(false)
  })
  test('dates', () => {
    expect(evaluate(parse("days('2026-03-02', '2026-02-25')"), ctx({}))).toBe(-5)
    expect(BUILTINS.isdate('2026-02-30')).toBe(false)
    expect(BUILTINS.isdate('2026-02-28')).toBe(true)
    expect(BUILTINS.pattern('K1234', 'K####')).toBe(true)
    expect(BUILTINS.pattern('1234', 'K####')).toBe(false)
  })
  test('no escape to JavaScript', () => {
    expect(() => evaluate(parse('constructor(1)'), ctx({}))).toThrow(/Unknown function/)
    expect(() => parse('a; alert(1)')).toThrow()
    expect(validate('FOO > 1', ['SYSBP'], [])).toMatch(/Unknown field/)
  })
})

describe('data validation specification', () => {
  test('every shipped check parses and has test cases', () => {
    expect(SHIPPED_CHECKS.length).toBeGreaterThanOrEqual(80)
    for (const c of SHIPPED_CHECKS) { expect(() => parse(c.expr)).not.toThrow(); expect(c.tests.length).toBeGreaterThanOrEqual(2) }
    expect(new Set(SHIPPED_CHECKS.map((c) => c.id)).size).toBe(SHIPPED_CHECKS.length)
  })
  test('only the three planted bugs fail UAT, and the corrections pass', () => {
    const failing = new Set(SHIPPED_CHECKS.filter((c) => c.tests.some((t) => runTest(c, t) !== t.fire)).map((c) => c.id))
    expect([...failing].sort()).toEqual(Object.keys(CHECK_BUGS).sort())
    const fixed = freshChecks().map((c) => (CHECK_BUGS[c.id] ? { ...c, expr: CHECK_BUGS[c.id].correct } : c))
    for (const c of fixed) for (const t of c.tests) expect(runTest(c, t), `${c.id} ${t.name}`).toBe(t.fire)
  })
})

describe('seeded study', () => {
  test('is deterministic', () => {
    const a = generateStudy(), b = generateStudy()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.subjects.length).toBe(60)
    expect(a.issues.length).toBeGreaterThan(100)
    expect(a.subjects.filter((s) => s.fate === 'screen-fail').length).toBe(4)
  })
  test('subject IDs follow SITE-NNN', () => {
    for (const s of generateStudy().subjects) expect(s.id).toMatch(/^10[1-6]-\d{3}$/)
  })
})

describe('audit trail and versions', () => {
  test('values are append-only and the chain detects tampering', () => {
    const p = createProject()
    writeValue(p, '101-001|SCR|VS|1|SYSBP', '150', SYSTEM, 'Initial entry')
    writeValue(p, '101-001|SCR|VS|1|SYSBP', '151', SYSTEM, 'Transcription error')
    expect(p.items['101-001|SCR|VS|1|SYSBP'].versions.map((v) => v.value)).toEqual(['150', '151'])
    expect(verifyAudit(p)).toBe(-1)
    p.audit[1].new = '999'
    expect(verifyAudit(p)).toBe(1)
  })
  test('site edits need a reason; data management cannot edit', () => {
    const p = createProject()
    enterForm(p, '101-001', 'SCR', 'VS', 1, { SYSBP: '150' }, SYSTEM, '2026-03-02T10:00:00Z')
    expect(() => editValue(p, '101-001|SCR|VS|1|SYSBP', '151', 'x')).toThrow(/site staff/)
    p.currentUserId = 'pkulk'
    expect(() => editValue(p, '101-001|SCR|VS|1|SYSBP', '151', '')).toThrow(/reason/)
    editValue(p, '101-001|SCR|VS|1|SYSBP', '151', 'Transcription error')
    expect(value(p, '101-001|SCR|VS|1|SYSBP')).toBe('151')
  })
})

describe('query life cycle', () => {
  test('raise, answer, re-query, close, cancel, with role rules', () => {
    const p = createProject()
    enterForm(p, '101-001', 'SCR', 'VS', 1, { SYSBP: '150' }, SYSTEM, '2026-03-02T10:00:00Z')
    const key = '101-001|SCR|VS|1|SYSBP'
    p.currentUserId = 'pkulk'
    expect(() => raiseManual(p, key, 'x')).toThrow()
    p.currentUserId = 'arao'
    const q = raiseManual(p, key, 'Systolic BP is 150 mmHg at screening. Please verify against the source document.')
    expect(q.status).toBe('open')
    expect(() => closeQuery(p, q.id)).toThrow(/after the site has answered/)
    p.currentUserId = 'pkulk'; respond(p, q.id, 'Confirmed per source.')
    p.currentUserId = 'arao'; requery(p, q.id, 'Please confirm the value was taken seated after 5 minutes of rest?')
    expect(q.requeries).toBe(1)
    p.currentUserId = 'pkulk'; respond(p, q.id, 'Yes, seated.')
    p.currentUserId = 'arao'; closeQuery(p, q.id)
    expect(q.status).toBe('closed')
    const q2 = raiseManual(p, '101-001|SCR|VS|1|PULSE', 'Pulse is blank. Please verify.')
    expect(() => cancelQuery(p, q2.id, '')).toThrow(/reason/)
    cancelQuery(p, q2.id, 'Raised in error')
    expect(q2.status).toBe('cancelled')
  })
  test('auto-queries are raised by checks and closed by the system when data are fixed', () => {
    const p = createProject()
    enterForm(p, '101-001', 'SCR', 'VS', 1, { VSDAT: '2026-03-02', SYSBP: '1480', DIABP: '90', PULSE: '70', WEIGHT: '80', HEIGHT: '175' }, SYSTEM, '2026-03-02T10:00:00Z')
    runChecks(p, ['101-001'])
    const q = p.queries.find((x) => x.checkId === 'VS-07')!
    expect(q.status).toBe('open')
    expect(q.text).toContain('1480')
    p.currentUserId = 'pkulk'
    editValue(p, '101-001|SCR|VS|1|SYSBP', '148', 'Transcription error')
    expect(q.status).toBe('closed')
    expect(value(p, '101-001|SCR|VS|1|BMI')).toBe('26.1') // derived by VS-14 auto-fix
  })
  test('query writing rules', () => {
    expect(scoreQuery('Potassium at Week 4 is 45 mmol/L. Please verify against the laboratory report.', ['potassium']).score).toBe(100)
    expect(scoreQuery('Please change potassium to 4.5', ['potassium']).score).toBeLessThan(70)
    expect(scoreQuery('WRONG VALUE AGAIN!!').score).toBeLessThan(50)
  })
})

describe('simulated study', () => {
  test('prepared start-up, then sites enter data and answer queries', () => {
    const p = createProject()
    expect(() => advance(p, 1)).toThrow(/not live/)
    preparedStartup(p)
    advance(p, 120)
    expect(Object.keys(p.forms).length).toBeGreaterThan(500)
    expect(p.queries.some((q) => q.source === 'auto' && q.status === 'closed')).toBe(true)
    expect(p.queries.some((q) => q.status === 'answered')).toBe(true)
    expect(verifyAudit(p)).toBe(-1)
    const m = metrics(p)
    expect(m).toHaveLength(6)
    expect(m.find((x) => x.site === '106')!.entryLag).toBeGreaterThan(m.find((x) => x.site === '101')!.entryLag)
  })
})

describe('missions', () => {
  test('M1 perfect review scores 100; flagging everything is penalised', () => {
    const p = createProject()
    for (const st of DMP.flatMap((s) => s.statements)) if (st.error) p.startup.dmpFlags[st.id] = st.error.correct
    scoreM1(p, startMission(p, 'M1'))
    expect(p.missions.at(-1)!.score).toBe(100)
    for (const st of DMP.flatMap((s) => s.statements)) p.startup.dmpFlags[st.id] ??= 'x1'
    scoreM1(p, startMission(p, 'M1'))
    expect(p.missions.at(-1)!.passed).toBe(false)
  })
  test('M2 rewards finding the bugs', () => {
    const p = createProject()
    scoreM2(p, startMission(p, 'M2'))
    expect(p.missions.at(-1)!.score).toBe(0)
    preparedStartup(p)
    scoreM2(p, startMission(p, 'M2'))
    expect(p.missions.at(-1)!.score).toBe(100)
  })
  test('M3: closing blindly fails; working the queue properly passes', () => {
    const blind = createProject(); preparedStartup(blind)
    const r1 = startMission(blind, 'M3')
    expect(blind.clock).toBe('2026-06-29')
    advance(blind, 42)
    blind.currentUserId = 'arao'
    for (const q of blind.queries.filter((x) => x.key.startsWith('103-') && x.status === 'answered')) closeQuery(blind, q.id)
    scoreM3(blind, r1)
    expect(r1.passed).toBe(false)

    const p = createProject(); preparedStartup(p)
    const run = startMission(p, 'M3')
    p.currentUserId = 'arao'
    for (let w = 0; w < 6; w++) {
      if (w === 1) raiseManual(p, '103-008|W2|VS|1|SYSBP', 'Systolic BP is 150 mmHg at Day 1, Week 2, Week 4 and Week 8, with identical diastolic values. Please verify each reading against the source.')
      for (const q of p.queries.filter((x) => x.key.startsWith('103-') && x.status === 'answered')) {
        const last = q.msgs.at(-1)!.text
        if (/as per source\.$/.test(last) && q.source === 'auto' && last.startsWith('Data entered')) requery(p, q.id, 'The value is still outside the expected range. Please check the source document again and confirm?')
        else closeQuery(p, q.id)
      }
      advance(p, 7)
    }
    for (const q of p.queries.filter((x) => x.key.startsWith('103-') && x.status === 'answered')) closeQuery(p, q.id)
    scoreM3(p, run)
    expect(run.score!).toBeGreaterThan(r1.score!)
  })
  test('M4 scores written queries', () => {
    const p = createProject()
    const run = startMission(p, 'M4')
    run.answers = Object.fromEntries(M4_SCENARIOS.map((s) => [s.id, `The ${s.mention[0]} recorded is 45 at this visit. Please verify against the source document and confirm.`]))
    scoreM4(p, run)
    expect(run.passed).toBe(true)
  })
})

describe('persistence', () => {
  test('IndexedDB round trip and file export/import with tamper warning', async () => {
    const p = createProject('u1', 'class-a')
    await saveProject(p)
    expect((await loadProject(p.id))!.classId).toBe('class-a')
    const text = exportFile(p)
    expect(importFile(text).warnings).toEqual([])
    const f = JSON.parse(text); f.project.audit[0].reason = 'edited'
    expect(importFile(JSON.stringify(f)).warnings.length).toBe(2)
    expect(() => importFile('{"a":1}')).toThrow(/not a CDM/)
  })
})
