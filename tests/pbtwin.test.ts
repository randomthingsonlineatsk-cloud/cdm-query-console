import { describe, expect, test } from 'vitest'
import file from './fixtures/HRP-301.protocol-builder.json?raw'
import { createOstProject, createProject } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { STUDY, SITES, VISITS, LOG_FORMS, FORMS, CODELISTS, HLV_DEF } from '../src/domain/study'
import { fromProtocolBuilder, formFor } from '../src/domain/pbImport'
import { allFindings, twin, M11, generatedChecks, protocolBurden, buildBurden, DEFAULT_ASSUMPTIONS } from '../src/domain/m11'

const live = () => ({ study: STUDY, sites: SITES, visits: VISITS, logForms: LOG_FORMS, forms: FORMS, codelists: CODELISTS }) as unknown as typeof HLV_DEF

describe('twin from a Protocol Builder protocol', () => {
  test('HRP-301 from the Protocol Builder traces to the Ostrevia build with no gaps', () => {
    applyStudy(createOstProject('u', 'none'))
    const def = live(), proto = fromProtocolBuilder(file, def)
    expect(proto.procedures.map((p) => p.form)).toEqual(['IC', 'DM', 'IE', 'MH', 'VS', 'HBV', 'LBC', 'PREG', 'HEA', 'HEA', 'HEA', 'EX', 'AE', 'CM', 'EOS'])
    const f = twin(def, proto)
    // the worked example and the console's HRP-301 build are the same trial
    expect(f.filter((x) => x.kind === 'form-missing' || x.kind === 'not-collected' || x.kind === 'window' || x.kind === 'criterion').map((x) => x.id)).toEqual([])
    expect(allFindings(def, proto).some((x) => x.kind === 'protocol')).toBe(false)
    expect(generatedChecks(proto.procedures, proto, def).some((c) => c.id === 'E-EX01')).toBe(true)
    expect(protocolBurden(def, DEFAULT_ASSUMPTIONS, proto.procedures, proto).perParticipant).toBeGreaterThan(0)
    expect(buildBurden(def, DEFAULT_ASSUMPTIONS, undefined, proto).perParticipant).toBeGreaterThan(0)
  })
  test('a change in the protocol shows up as a gap in the build', () => {
    applyStudy(createOstProject('u', 'none'))
    const j = JSON.parse(file); const d = j.project.versions[0].data
    d.procedures.find((p: { id: string }) => p.id === 'P05').visits.push('W12')
    d.visits.find((v: { id: string }) => v.id === 'W8').hi = 63
    const f = twin(live(), fromProtocolBuilder(JSON.stringify(j), live()))
    expect(f.map((x) => x.id)).toEqual(expect.arrayContaining(['T-miss-VS-W12', 'T-window-W8']))
  })
  test('a protocol for another study is refused; the shipped twin is unchanged', () => {
    applyStudy(createProject('u', 'none'))
    expect(() => fromProtocolBuilder(file, live())).toThrow(/running HLV-204-201/)
    expect(() => fromProtocolBuilder('{}', live())).toThrow(/not a Protocol Builder project/)
    expect(allFindings().length).toBe(allFindings(HLV_DEF, M11).length)
    expect(formFor({ form: 'LB', name: 'Local safety laboratory' }, HLV_DEF as never)).toBe('LB')
  })
})
