import { describe, test, expect } from 'vitest'
import { createProject } from '../src/domain/project'
import { startMission, scoreM19, MISSION_PROJECT } from '../src/domain/missions'
import { allFindings, TWIN_ANSWERS, scoreTwin, buildBurden, protocolBurden, WHAT_IFS, M11, generatedChecks, twin } from '../src/domain/m11'
import { HLV_DEF } from '../src/domain/study'

describe('Protocol-to-Database Twin (ICH M11)', () => {
  test('the twin finds exactly the planted differences, each with an answer', () => {
    const f = allFindings()
    expect(f).toHaveLength(12)
    for (const x of f) expect(TWIN_ANSWERS[x.id], x.id).toBeTruthy()
    expect(Object.keys(TWIN_ANSWERS).sort()).toEqual(f.map((x) => x.id).sort())
  })
  test('a build that follows the protocol leaves only the justified items and the protocol conflicts', () => {
    const d = structuredClone(HLV_DEF)
    d.visits.find((v) => v.id === 'W4')!.forms.push('EG')
    d.visits.find((v) => v.id === 'W8')!.lo = 50; d.visits.find((v) => v.id === 'W8')!.hi = 64
    d.codelists.IETEST.push({ value: 'EX04', label: 'EX04' })
    ;(d.forms as Record<string, unknown>).PREG = { id: 'PREG', name: 'Pregnancy test', domain: 'LB', fields: [{ id: 'PREGDAT', label: 'Date', type: 'date' }, { id: 'PREGRES', label: 'Result', type: 'text' }] }
    for (const v of ['SCR', 'D1', 'W12']) d.visits.find((x) => x.id === v)!.forms.push('PREG')
    d.forms.LB.fields = d.forms.LB.fields.filter((x) => !['GLUC', 'GLUCU'].includes(x.id))
    const left = twin(d).map((x) => x.id)
    expect(left).not.toContain('T-miss-EG-W4'); expect(left).not.toContain('T-window-W8'); expect(left).not.toContain('T-crit-EX04'); expect(left).not.toContain('T-form-PREG'); expect(left).not.toContain('T-extra-LB-GLUC-GLUCU')
  })
  test('burden: the build collects more than the protocol needs; changes move the numbers', () => {
    const b = buildBurden(), p = protocolBurden()
    expect(b.perParticipant).toBeGreaterThan(100)
    expect(b.total).toBe(b.perParticipant * 120)
    const dropW2 = protocolBurden(undefined, undefined, WHAT_IFS.find((w) => w.id === 'dropW2')!.apply(M11.procedures))
    expect(dropW2.perParticipant).toBeLessThan(p.perParticipant)
    const qol = protocolBurden(undefined, undefined, WHAT_IFS.find((w) => w.id === 'qol')!.apply(M11.procedures))
    expect(qol.perParticipant - p.perParticipant).toBe(39)
    expect(generatedChecks().length).toBeGreaterThan(40)
  })
  test('M19 scores: perfect 100, everything kept fails', () => {
    expect(MISSION_PROJECT.M19).toBe('none')
    const p = createProject(); const run = startMission(p, 'M19')
    run.answers = Object.fromEntries(allFindings().map((f) => [f.id, TWIN_ANSWERS[f.id].answer])); scoreM19(p, run)
    expect(run.score).toBe(100)
    expect(scoreTwin(Object.fromEntries(allFindings().map((f) => [f.id, 'none']))).score).toBeLessThan(70)
  })
})
