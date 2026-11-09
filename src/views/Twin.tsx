import { useMemo, useState } from 'react'
import { Panel, Table, Stat, Btn, Pill } from './ui'
import { HLV_DEF } from '../domain/study'
import { M11, allFindings, buildBurden, protocolBurden, generatedChecks, WHAT_IFS, DEFAULT_ASSUMPTIONS, LOG_RECORDS, type Assumptions } from '../domain/m11'
import { useNav } from '../App'

const KIND: Record<string, { label: string; tone: 'red' | 'amber' | 'blue' | 'grey' }> = {
  'form-missing': { label: 'Not collected', tone: 'red' }, 'not-collected': { label: 'Not collected', tone: 'red' },
  'not-needed': { label: 'Not needed', tone: 'amber' }, window: { label: 'Window', tone: 'blue' }, criterion: { label: 'Criterion', tone: 'blue' }, protocol: { label: 'Protocol conflict', tone: 'grey' },
}
const n = (x: number) => x.toLocaleString('en-GB')

// The Protocol-to-Database Twin: the ICH M11 protocol beside the database build.
export default function Twin() {
  const { go } = useNav()
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)
  const [on, setOn] = useState<string[]>([])
  const findings = useMemo(() => allFindings(), [])
  const build = buildBurden(HLV_DEF, a)
  const proto = protocolBurden(HLV_DEF, a)
  const procs = WHAT_IFS.filter((w) => on.includes(w.id)).reduce((ps, w) => w.apply(ps), M11.procedures)
  const changed = protocolBurden(HLV_DEF, a, procs)
  const notNeeded = findings.filter((f) => f.kind === 'not-needed').reduce((s, f) => s + f.points, 0)
  const notCollected = findings.filter((f) => f.kind === 'not-collected' || f.kind === 'form-missing').reduce((s, f) => s + f.points, 0)
  const checks = generatedChecks(procs)
  const delta = (x: number, y: number) => { const d = x - y; return d === 0 ? '±0' : `${d > 0 ? '+' : ''}${n(d)}` }
  const visits = M11.visits.map((v) => v.id)
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ standard: M11.version, ...M11, procedures: procs }, null, 2)], { type: 'application/json' })
    const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = 'HLV-204-201-protocol-m11.json'; el.click(); URL.revokeObjectURL(u)
  }
  return (
    <div className="space-y-4">
      <Panel title="Protocol-to-Database Twin" sub={`HLV-204-201 protocol version ${M11.title['Version Number']} in the ICH M11 structure (${M11.version}), held as data and traced to the database build field by field. Practise it in mission M19.`}
        right={<div className="flex gap-2"><Btn tone="grey" onClick={downloadJson}>Download structured protocol (JSON)</Btn><Btn onClick={() => go('missions', 'M19')}>Mission M19</Btn></div>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Findings" value={findings.length} tone="amber" />
          <Stat label="Data points per participant, build" value={n(build.perParticipant)} tone="blue" />
          <Stat label="Of which no procedure needs" value={n(notNeeded)} tone="amber" />
          <Stat label="Protocol asks, build misses" value={n(notCollected)} tone="red" />
        </div>
      </Panel>

      <Panel title="1.1.2 Overall design and title page" sub="The M11 synopsis fields, structured so a system can read them.">
        <Table head={['Field', 'Value']} rows={[...Object.entries(M11.title).slice(0, 6), ...Object.entries(M11.design)].map(([k, v]) => [k, v])} />
      </Panel>

      <Panel title="3 Objectives and estimands" sub="Every endpoint needs data: the twin uses these to tell needed fields from extra ones.">
        <Table head={['Section', 'Objective', 'Endpoint', 'Estimand']} rows={M11.objectives.map((o) => [o.section, `${o.kind}: ${o.objective}`, o.endpoint, o.estimand])} />
      </Panel>

      <Panel title="1.3 Schedule of activities, traced to the eCRF" sub="✓ the build collects it at that visit · ✗ the protocol asks but the build does not · ○ the build collects the form there for another procedure. Continuous procedures are log forms.">
        <Table head={['Procedure', 'M11', 'eCRF', ...visits, 'Note']} rows={M11.procedures.map((p) => {
          const bv = HLV_DEF.visits
          const has = (v: string) => bv.find((x) => x.id === v)?.forms.includes(p.form) ?? false
          const exists = !!HLV_DEF.forms[p.form as keyof typeof HLV_DEF.forms]
          return [p.name, p.section, exists ? <span className="font-mono">{p.form}</span> : <span className="font-mono text-lab-red">{p.form} (none)</span>,
            ...visits.map((v) => p.visits === 'continuous' ? <span className="text-lab-text-muted">log</span> : p.visits.includes(v) ? (exists && has(v) ? <span className="text-lab-cdsco">✓</span> : <span className="text-lab-red font-bold">✗</span>) : (exists && has(v) ? <span className="text-lab-text-muted">○</span> : '')),
            <span className="text-[11px]">{p.note ?? ''}</span>]
        })} />
        <p className="text-[11px] text-lab-text-muted">Windows (study day): {M11.visits.map((v) => `${v.id} ${v.lo === v.hi ? v.lo : `${v.lo} to ${v.hi}`}`).join(' · ')}.</p>
      </Panel>

      <Panel title="What the twin finds" sub="Read with the protocol sections it cites. Points are data points per participant.">
        <Table head={['Type', 'Where', 'Finding', 'M11', 'Points']} rows={findings.map((f) => [<Pill tone={KIND[f.kind].tone}>{KIND[f.kind].label}</Pill>, f.where, f.text, f.section, f.points || ''])} />
      </Panel>

      <Panel title="Data burden: what each protocol change costs" sub="Estimates for planning, from the build and the protocol as data. Change the assumptions to your organisation’s figures.">
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1">Participants <input type="number" min={1} className="w-20 rounded border border-lab-line bg-lab-panel-strong px-1" value={a.participants} onChange={(e) => setA({ ...a, participants: Math.max(1, Number(e.target.value) || 1) })} /></label>
          <label className="flex items-center gap-1">Queries per 100 data points <input type="number" min={0} step={0.5} className="w-16 rounded border border-lab-line bg-lab-panel-strong px-1" value={a.queryRate} onChange={(e) => setA({ ...a, queryRate: Math.max(0, Number(e.target.value) || 0) })} /></label>
          <label className="flex items-center gap-1">Data-management minutes per query <input type="number" min={0} className="w-16 rounded border border-lab-line bg-lab-panel-strong px-1" value={a.minutesPerQuery} onChange={(e) => setA({ ...a, minutesPerQuery: Math.max(0, Number(e.target.value) || 0) })} /></label>
        </div>
        <fieldset className="space-y-1 text-xs"><legend className="font-semibold">Proposed changes to the protocol</legend>
          {WHAT_IFS.map((w) => <label key={w.id} className="flex items-center gap-2"><input type="checkbox" checked={on.includes(w.id)} onChange={(e) => setOn(e.target.checked ? [...on, w.id] : on.filter((x) => x !== w.id))} />{w.label} <span className="text-lab-text-muted">(M11 {w.section})</span></label>)}
        </fieldset>
        <Table head={['', 'Data points per participant', 'Data points, study', 'Form instances per participant', 'Core edit checks', 'Expected queries', 'Query hours']} rows={[
          ['The build today', n(build.perParticipant), n(build.total), build.forms, build.checks, n(build.queries), n(build.hours)],
          ['What the protocol asks', n(proto.perParticipant), n(proto.total), proto.forms, proto.checks, n(proto.queries), n(proto.hours)],
          ...(on.length ? [[<b>With the proposed changes</b>, <b>{n(changed.perParticipant)} ({delta(changed.perParticipant, proto.perParticipant)})</b>, <b>{n(changed.total)} ({delta(changed.total, proto.total)})</b>, <b>{changed.forms} ({delta(changed.forms, proto.forms)})</b>, <b>{changed.checks} ({delta(changed.checks, proto.checks)})</b>, <b>{n(changed.queries)} ({delta(changed.queries, proto.queries)})</b>, <b>{n(changed.hours)} ({delta(changed.hours, proto.hours)})</b>]] : []),
        ]} />
        <p className="text-[11px] text-lab-text-muted">Counting: every non-derived field on every scheduled form; a conditional field counts as half; log forms at {Object.entries(LOG_RECORDS).map(([k, v]) => `${k} ${v}`).join(', ')} records per participant. Edit checks: for the build, the checks in its specification; for the protocol, the core checks generated from it (below). Query rate and time are planning assumptions, not benchmarks. The burden only counts the eCRF: site time, monitoring and vendor data add to it.</p>
      </Panel>

      <Panel title="Core edit checks generated from the protocol" sub={`${checks.length} checks: visit windows from 1.3, eligibility from 5.2 and 5.3, ranges from 8.4, and a missing-data check for every required field. Specify them in full in the edit check specification; the twin keeps each traced to its section.`}>
        <details className="text-xs"><summary className="cursor-pointer">Show all {checks.length}</summary><Table head={['ID', 'M11', 'Check']} rows={checks.map((c) => [<span className="font-mono">{c.id}</span>, c.source, c.text])} /></details>
      </Panel>
    </div>
  )
}
