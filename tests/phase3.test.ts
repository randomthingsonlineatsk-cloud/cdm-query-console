import { describe, expect, test } from 'vitest'
import { createProject, advance, sign, closeQuery, value, editValue } from '../src/domain/project'
import { preparedStartup, startMission, scoreM9, scoreM10 } from '../src/domain/missions'
import { sdvRequired, sdvState, verify, sdvProgress, sourceValue, signals, expectedFinding, decideSignal, qtlStatus, recordBreach, addDeviation, classify, dashboard } from '../src/domain/oversight'
import { safetyDb } from '../src/domain/safety'
import { daysBetween } from '../src/domain/util'
import type { Project, Signature } from '../src/domain/types'

const live = (days: number) => { const p = createProject(); preparedStartup(p); advance(p, days); return p }
const sig = (p: Project, uid: string, pin: string, roles: Signature['role'][]) => sign(p, uid, pin, 'Approved', 'test', roles) as Signature

describe('SDV', () => {
  test('targeted SDV covers critical fields; a later change voids it', () => {
    const p = live(60)
    const fk = Object.keys(p.forms).find((k) => k.includes('|SCR|VS|'))!
    expect(sdvRequired(p, fk).sort()).toEqual(['DIABP', 'SYSBP'])
    expect(() => verify(p, `${fk}|SYSBP`)).toThrow(/CRA/)
    p.currentUserId = 'mlind'
    verify(p, `${fk}|SYSBP`); verify(p, `${fk}|DIABP`)
    expect(p.forms[fk].status).toBe('sdv')
    expect(sourceValue(fk, 'SYSBP')).toBeDefined()
    p.currentUserId = 'pkulk'
    editValue(p, `${fk}|SYSBP`, String(Number(value(p, `${fk}|SYSBP`)) + 1), 'Transcription error')
    expect(sdvState(p, `${fk}|SYSBP`)).toBe('changed')
    expect(sdvProgress(p).changed).toBe(1)
  })
})

describe('deviations', () => {
  test('closing a confirmed protocol-check query logs a deviation to classify', () => {
    const p = live(120)
    p.currentUserId = 'arao'
    const q = p.queries.find((x) => x.checkId === 'SV-04' && x.status === 'answered') ?? p.queries.find((x) => x.checkId === 'IC-04' && x.status === 'answered')
    expect(q).toBeDefined()
    closeQuery(p, q!.id)
    const dv = p.deviations.find((d) => d.key === q!.key)!
    expect(dv.status).toBe('to classify')
    expect(() => classify(p, dv.id, true, '')).toThrow(/rationale/)
    classify(p, dv.id, dv.category !== 'Visit window', 'Per the deviation plan')
    expect(p.deviations[0].status).toBe('classified')
  })
})

describe('centralised monitoring', () => {
  test('M9: right calls, a for-cause visit and the missing AEs arrive', () => {
    const p = live(10)
    const run = startMission(p, 'M9')
    const flags = signals(p).filter((s) => s.flagged)
    expect(flags.map((s) => s.id)).toEqual(expect.arrayContaining(['104:ae', '106:digit']))
    p.currentUserId = 'mlind'
    const aeBefore = Object.keys(p.forms).filter((k) => k.startsWith('104-') && k.includes('|AE|')).length
    for (const s of flags) { const e = expectedFinding(s); decideSignal(p, s.id, e.finding === 'explained' ? { finding: 'explained', note: e.why } : { finding: 'action', action: e.actions![0], note: e.why }) }
    advance(p, 8)
    expect(Object.keys(p.forms).filter((k) => k.startsWith('104-') && k.includes('|AE|')).length).toBeGreaterThan(aeBefore)
    scoreM9(p, run)
    expect(run.score).toBe(100)
  })
})

describe('QTLs', () => {
  test('M10: late SAE reporting breaches QTL 3', () => {
    const p = live(10)
    const run = startMission(p, 'M10')
    const st = qtlStatus(p)
    expect(st.find((x) => x.id === 'Q3')!.state).toBe('breached')
    expect(st.filter((x) => x.state === 'breached')).toHaveLength(1)
    p.currentUserId = 'jweber'
    expect(() => recordBreach(p, 'Q3', 'x', 'y', sig(p, 'jweber', '2222', ['dmlead']))).toThrow()
    recordBreach(p, 'Q3', 'Two sites sent SAE reports after 24 hours: staff did not know the weekend contact.', 'Retrain sites 103 and 106 on SAE reporting; add the 24-hour safety line to the site binder by 30 October.', sig(p, 'jweber', '2222', ['dmlead']))
    for (const c of safetyDb(p).filter((x) => daysBetween(x.aware, x.received) > 1)) {
      const d = addDeviation(p, { subj: c.subj, category: 'Safety reporting', description: `SAE ${c.caseId} reported ${daysBetween(c.aware, c.received)} days after awareness`, source: 'QTL 3 review' })
      classify(p, d.id, true, 'Late SAE reporting affects subject safety')
    }
    scoreM10(p, run)
    expect(run.score).toBe(100)
    expect(dashboard(p).find((r) => r.site === '103')!.dvImportant).toBeGreaterThan(0)
  })
})
