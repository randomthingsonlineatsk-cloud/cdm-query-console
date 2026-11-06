import { describe, expect, test } from 'vitest'
import { createProject, advance, closeQuery } from '../src/domain/project'
import { preparedStartup, startMission, scoreM5, scoreM6, scoreM7, scoreM8 } from '../src/domain/missions'
import { SMD_10, SMD_11, medStats, exactLlt, ptOf } from '../src/domain/dictmed'
import { DRUGS, atcPath, exactDrug } from '../src/domain/dictdrug'
import { codeTerm, codingQuery, approveCoding, upgradeImpact, applyUpgrade, reviewHierarchy, expected, smd } from '../src/domain/coding'
import { searchMed } from '../src/domain/dictmed'
import { discrepancies, decide, link, pairs, signoff, reconReady, statusOf } from '../src/domain/safety'
import { transferLog, shouldAccept, decideTransfer, extDiscrepancies, decideExt, addRule, standardise, conformance } from '../src/domain/external'
import { sign } from '../src/domain/project'
import type { Project, Signature } from '../src/domain/types'

const live = (days: number) => { const p = createProject(); preparedStartup(p); advance(p, days); return p }
const sig = (p: Project, uid: string, pin: string, roles: Signature['role'][]) => sign(p, uid, pin, 'Approved', 'test', roles) as Signature

describe('dictionaries', () => {
  test('medical dictionary: five levels, about 400 terms, unique codes, one parent each', () => {
    const s = medStats(SMD_10)
    expect(s.SOC + s.HLGT + s.HLT + s.PT + s.LLT).toBeGreaterThanOrEqual(400)
    const codes = [...SMD_10.terms.values()]
    for (const t of codes) if (t.level !== 'SOC') expect(SMD_10.terms.get(t.parent!), t.name).toBeDefined()
    const names = codes.filter((t) => t.level === 'LLT').map((t) => t.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    expect(codes.every((t) => /^9[1-5]\d{6}$/.test(t.code))).toBe(true)
  })
  test('drug dictionary: about 150 records, B3-style numbering, valid classes', () => {
    expect(DRUGS.length).toBeGreaterThanOrEqual(150)
    for (const d of DRUGS) { expect(d.id).toMatch(/^\d{6}-01-\d{3}$/); for (const a of d.atc) expect(atcPath(a)).toHaveLength(4) }
    expect(exactDrug('Aspirin')!.atc.length).toBe(2)
  })
  test('version 1.1 retires, moves and demotes as listed', () => {
    expect(exactLlt(SMD_11, 'Head ache')).toBeUndefined()
    const cramp = [...SMD_11.terms.values()].find((t) => t.level === 'LLT' && t.name === 'Muscle cramps')!
    expect(ptOf(SMD_11, cramp.code)!.name).toBe('Muscle pain')
    expect(ptOf(SMD_10, cramp.code)!.name).toBe('Muscle cramps')
  })
})

describe('coding', () => {
  test('auto-codes exact matches; the coder codes the rest; the synonym list learns', () => {
    const p = live(150)
    const rs = Object.values(p.coding)
    expect(rs.length).toBeGreaterThan(100)
    expect(rs.filter((r) => r.method === 'auto').length).toBeGreaterThan(rs.length / 2)
    const todo = rs.find((r) => r.status === 'uncoded' && r.dict === 'SMD' && expected('AE', r.verbatim)?.kind === 'pt')
    if (todo) {
      expect(() => codeTerm(p, todo.key, 'x')).toThrow(/medical coder/)
      p.currentUserId = 'tibarra'
      const e = expected('AE', todo.verbatim) as { pt: string }
      const llt = [...smd(p).terms.values()].find((t) => t.level === 'LLT' && t.current && ptOf(smd(p), t.code)?.name === e.pt)!
      codeTerm(p, todo.key, llt.code)
      expect(p.coding[todo.key].status).toBe('coded')
      expect(Object.keys(p.synonyms).length).toBe(1)
    }
    p.currentUserId = 'tibarra'
    const combo = rs.find((r) => r.verbatim === 'Headache and nausea')
    if (combo) { codingQuery(p, combo.key, 'The term "Headache and nausea" describes two events. Please record each event separately?'); expect(p.coding[combo.key].status).toBe('query') }
    const aspirin = rs.find((r) => r.verbatim === 'Aspirin')
    if (aspirin) expect(() => codeTerm(p, aspirin.key, exactDrug('Aspirin')!.id)).toThrow(/more than one class/)
    approveCoding(p, Object.values(p.coding).filter((r) => r.status === 'coded').map((r) => r.key), sig(p, 'jweber', '2222', ['dmlead']))
    expect(Object.values(p.coding).some((r) => r.status === 'approved')).toBe(true)
    expect(searchMed(smd(p), 'head').length).toBeGreaterThan(0)
  })
  test('M8: the upgrade flags retired terms for recoding and moved terms for review', () => {
    const p = live(150)
    const run = startMission(p, 'M8')
    const impact = upgradeImpact(p)
    expect(impact.some((i) => i.kind === 'recode')).toBe(true)
    expect(impact.some((i) => i.kind === 'hierarchy')).toBe(true)
    applyUpgrade(p, sig(p, 'jweber', '2222', ['dmlead']), 'Four LLTs retired; the affected terms are recoded. Leg swelling and cramps move; codes kept.')
    p.currentUserId = 'tibarra'
    for (const r of Object.values(p.coding)) {
      if (r.review) reviewHierarchy(p, r.key)
      if (r.status === 'uncoded' && r.previous?.reason === 'LLT not current in 1.1') {
        const e = expected('AE', r.verbatim, '', '1.1') as { pt: string }
        const llt = [...smd(p).terms.values()].find((t) => t.level === 'LLT' && t.current && ptOf(smd(p), t.code)?.name === e.pt)!
        codeTerm(p, r.key, llt.code, undefined, false)
      }
    }
    scoreM8(p, run)
    expect(run.score).toBe(100)
  })
  test('M5 scores the coder’s work', () => {
    const p = live(10)
    const run = startMission(p, 'M5')
    scoreM5(p, run)
    expect(run.passed).toBe(false)
  })
})

describe('SAE reconciliation', () => {
  test('M6: correct classes, links and sign-offs pass', () => {
    const p = live(10)
    const run = startMission(p, 'M6')
    expect(p.clock).toBe('2026-09-14')
    expect(pairs(p).filter((x) => x.edc).length).toBe(12)
    p.currentUserId = 'arao'
    // Link the misnumbered case first.
    const edcOnly = pairs(p).find((x) => x.edc && !x.sc && x.edc.subj === '104-006')!
    const caseOnly = pairs(p).find((x) => !x.edc && x.sc?.subj === '104-009')!
    link(p, edcOnly.edc!.fk, caseOnly.sc!.caseId)
    for (let i = 0; i < 9; i++) {
      for (const d of discrepancies(p)) if (statusOf(p, d) === 'open' && d.expected !== 'link') decide(p, d, d.expected, d.expected === 'acceptable' ? 'Same event, coded to the same preferred term' : '')
      for (const q of p.queries.filter((x) => x.status === 'answered')) closeQuery(p, q.id)
      advance(p, 2)
    }
    expect(reconReady(p)).toBe(true)
    signoff(p, sig(p, 'arao', '1111', ['dm']))
    signoff(p, sig(p, 'rmenon', '7777', ['safety']))
    scoreM6(p, run)
    expect(run.score).toBeGreaterThanOrEqual(90)
  })
  test('a wrong class gets a reply and nothing changes', () => {
    const p = live(10); startMission(p, 'M6'); p.currentUserId = 'arao'
    const d = discrepancies(p).find((x) => x.expected === 'edc')!
    decide(p, d, 'safety', 'Safety to update')
    advance(p, 4)
    expect(p.sae.decisions[d.id].reply).toMatch(/matches the SAE report/)
    expect(discrepancies(p).some((x) => x.id === d.id)).toBe(true)
  })
})

describe('external data', () => {
  test('DTA checks catch the planted transfer problems', () => {
    const p = live(220)
    const bad = transferLog(p.clock).filter((t) => !shouldAccept(p, t)).map((t) => t.id).sort()
    expect(bad).toEqual(['CL-2026-08-03', 'ECG-2026-06-01', 'IRT-2026-07-06'])
    const blind = conformance(p, transferLog(p.clock).find((t) => t.id === 'IRT-2026-07-06')!).checks.find((c) => c.id === 'blind')!
    expect(blind.ok).toBe(false)
  })
  test('M7: load correctly, class discrepancies, convert units', () => {
    const p = live(10)
    const run = startMission(p, 'M7')
    p.currentUserId = 'arao'
    for (const t of transferLog(p.clock).filter((x) => x.vendor === 'CL')) decideTransfer(p, t, shouldAccept(p, t) ? 'accepted' : 'rejected', shouldAccept(p, t) ? '' : 'Record count does not match the log')
    for (const d of extDiscrepancies(p, 'CL')) decideExt(p, d, d.expected, d.expected === 'acceptable' || d.expected === 'no-action' ? 'Per DTA' : '')
    addRule(p, { vendor: 'CL', test: 'GLUC', from: 'mg/dL', to: 'mmol/L', factor: 18 })
    const row = conformance(p, transferLog(p.clock).filter((x) => x.vendor === 'CL').pop()!).rows.find((r) => r.LBORRESU === 'mg/dL')!
    expect(standardise(p, row).converted).toBe(true)
    scoreM7(p, run)
    expect(run.score).toBe(100)
    // The vendor fixes its own errors in the next transfer.
    advance(p, 30)
    const next = transferLog(p.clock).filter((x) => x.vendor === 'CL').pop()!
    decideTransfer(p, next, 'accepted', '')
    expect(extDiscrepancies(p, 'CL').some((d) => d.id === 'CL:units:105:GLUC')).toBe(false)
  })
})
