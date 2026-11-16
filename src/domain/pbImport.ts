// The twin from a Protocol Builder protocol. The Protocol Builder (a separate app) writes ICH M11
// protocols as data; its project file holds them. This turns the current version of one into the
// twin's shape for the study the console is running, so the twin traces that protocol to this
// build. Procedures are matched to eCRF forms by their CDASH form code; a procedure collects every
// field of its form, so the twin compares forms, visits, windows and criteria (field-level
// differences need the console's own HLV-204-201 protocol, which names its fields).
// Keep in step with protocol-builder/src/domain/types.ts (ProtocolData, schema 1).
import type { TwinProtocol, Procedure } from './m11'

interface PbData {
  title: Record<string, string>; design: Record<string, string>
  objectives: { id: string; level: string; text: string; endpointIds: string[] }[]
  endpoints: { id: string; text: string }[]
  estimands: { objectiveId: string; population: string; summary: string; intercurrentEvents: { name: string; strategy: string }[] }[]
  criteria: { code: string; category: 'Inclusion' | 'Exclusion'; text: string }[]
  visits: { id: string; name: string; lo: number; hi: number }[]
  procedures: { id: string; name: string; section: string; form: string; concept?: string; visits: string[] | 'continuous'; footnote?: string }[]
  narrative: Record<string, string>; statements: Record<string, string>
}
type Def = { study: { protocol: string }; forms: Record<string, { name: string; domain: string; fields: { id: string; derived?: boolean }[] }> }
const STRUCTURAL = new Set(['VISOCCUR', 'VISDAT', 'UNSREAS'])

export function formFor(p: { form: string; name: string; concept?: string }, def: Def): string {
  const has = (f: string) => !!def.forms[f]
  if (p.form === 'LB') {
    if (/hepatitis b/i.test(p.name) && has('HBV')) return 'HBV'
    if (/central/i.test(p.name) && has('LBC')) return 'LBC'
    if (has('LB')) return 'LB'
    if (has('LBC')) return 'LBC'
  }
  if (p.form === 'DS' && !has('DS') && has('EOS')) return 'EOS'
  if (has(p.form)) return p.form
  return Object.entries(def.forms).find(([, f]) => f.domain === p.form)?.[0] ?? p.form
}

export function fromProtocolBuilder(text: string, def: Def): TwinProtocol {
  let j: { format?: string; project?: { name: string; versions: { number: string; status: string; data: PbData }[] } }
  try { j = JSON.parse(text) } catch { throw new Error('The file is not JSON.') }
  if (j.format !== 'protocol-builder-project' || !j.project?.versions?.length) throw new Error('This is not a Protocol Builder project file. Export one from the Protocol Builder: Export, Project file.')
  const v = j.project.versions[j.project.versions.length - 1], d = v.data
  const id = d.title['Sponsor Protocol Identifier'] ?? ''
  if (id !== def.study.protocol) throw new Error(`The protocol is ${id || 'unnamed'}; the console is running ${def.study.protocol}. Open a ${id} project here, or a ${def.study.protocol} protocol in the Protocol Builder.`)
  const procs: Procedure[] = d.procedures.map((p) => {
    const form = formFor(p, def)
    const fields = (def.forms[form]?.fields ?? []).filter((f) => !f.derived && !STRUCTURAL.has(f.id)).map((f) => f.id)
    return { id: p.id, name: p.name, section: p.section, form, fields, visits: p.visits, ...(p.footnote ? { note: p.footnote } : {}) }
  })
  const obj = d.objectives.filter((o) => o.level !== 'Exploratory').map((o, i) => {
    const e = d.estimands.find((x) => x.objectiveId === o.id)
    return { section: `${o.level === 'Primary' ? '3.1' : '3.2'}.${i + 1}`, kind: o.level, objective: o.text, endpoint: d.endpoints.filter((x) => o.endpointIds.includes(x.id)).map((x) => x.text).join('; '), estimand: e ? `Population: ${e.population}. ${e.intercurrentEvents.map((x) => `${x.name}: ${x.strategy || '(no strategy)'}`).join('; ')}. Summary: ${e.summary || '(none)'}` : 'Not applicable (descriptive).' }
  })
  const design = Object.fromEntries(['Intervention Model', 'Population Type', 'Population Diagnosis or Condition', 'Population Age (Minimum and Maximum)', 'Control Type', 'Intervention Assignment Method', 'Number of Arms', 'Trial Blind Schema', 'Blinded Roles', 'Target/Maximum Number of Participants', 'Total Planned Duration of Trial Participation', 'Site Geographic Scope', 'Independent Committees'].filter((k) => d.design[k]).map((k) => [k, d.design[k]]))
  return {
    version: 'ICH M11 CeSHarP (from the Protocol Builder)', source: `${j.project.name}, version ${v.number} (${v.status})`,
    title: Object.fromEntries(['Full Title', 'Trial Acronym', 'Sponsor Protocol Identifier', 'Version Number', 'Version Date', 'Trial Phase', 'Sponsor Name and Address'].filter((k) => d.title[k]).map((k) => [k, d.title[k]])),
    design, objectives: obj,
    inclusion: d.criteria.filter((c) => c.category === 'Inclusion').map((c) => ({ code: c.code, text: c.text })),
    exclusion: d.criteria.filter((c) => c.category === 'Exclusion').map((c) => ({ code: c.code, text: c.text })),
    visits: d.visits.map((x) => ({ id: x.id, name: x.name, lo: x.lo, hi: x.hi })), procedures: procs,
    statements: Object.entries(d.statements ?? {}).map(([section, text]) => ({ section, text })),
  }
}
