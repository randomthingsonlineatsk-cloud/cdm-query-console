import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { dashboard, sdvProgress, sdvRequired, sdvState, sourceValue, verify, setSdvPlan, addDeviation, classify, DV_CATEGORIES, DV_PLAN, signals, KRI, decideSignal, qtlStatus, recordBreach, expectedImportant } from '../domain/oversight'
import { codingStats } from '../domain/coding'
import { discrepancies, statusOf, inScope } from '../domain/safety'
import { me, value } from '../domain/project'
import { FORMS, SITES, VISITS, CODELISTS } from '../domain/study'
import type { DvCategory, MonitoringDecision } from '../domain/types'
import { Panel, Pill, Btn, Table, Tabs, Select, SignBox, SigLine, Stat, ic, TextArea, fmtUtc } from './ui'
import { RaiseModal } from './Casebook'

const vIdx = (k: string) => { const i = VISITS.findIndex((v) => v.id === k.split('|')[1]); return i < 0 ? 99 : i }
type T = 'dash' | 'sdv' | 'dv' | 'cm' | 'qtl'
export default function Oversight() {
  const [t, setT] = useState<T>('dash')
  return (
    <div className="space-y-4">
      <Tabs value={t} onChange={setT} tabs={[{ id: 'dash', label: 'Study dashboard' }, { id: 'sdv', label: 'Source data verification' }, { id: 'dv', label: 'Protocol deviations' }, { id: 'cm', label: 'Centralised monitoring' }, { id: 'qtl', label: 'Quality tolerance limits' }]} />
      {t === 'dash' && <Dashboard />}
      {t === 'sdv' && <Sdv />}
      {t === 'dv' && <Deviations />}
      {t === 'cm' && <Monitoring />}
      {t === 'qtl' && <Qtl />}
    </div>
  )
}

// A single-series progress bar: one hue, the value always written beside it.
function Bar({ frac, label }: { frac: number; label: string }) {
  const pct = Math.max(0, Math.min(1, frac)) * 100
  return (
    <div className="flex items-center gap-2 min-w-32" title={label}>
      <div className="h-2 flex-1 rounded-full bg-lab-panel-strong overflow-hidden" role="img" aria-label={label}><div className="h-full rounded-full bg-lab-fda" style={{ width: `${pct}%` }} /></div>
      <span className="font-mono text-[11px] text-lab-text w-10 text-right">{Math.round(pct)}%</span>
    </div>
  )
}
const n = (x: number, d = 0) => (Number.isNaN(x) ? '–' : x.toFixed(d))

function Dashboard() {
  const { p, tick } = useStore()
  const rows = useMemo(() => dashboard(p), [tick])
  const q = useMemo(() => qtlStatus(p), [tick])
  const cs = codingStats(p)
  const sae = useMemo(() => discrepancies(p).filter((d) => inScope(p, d) && statusOf(p, d) !== 'accepted').length, [tick])
  const sdv = sdvProgress(p)
  const tot = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Stat label="Randomised" value={tot((r) => r.rand)} />
        <Stat label="Active queries" value={tot((r) => r.open)} tone="amber" />
        <Stat label="Queries over 30 days" value={tot((r) => r.over30)} tone={tot((r) => r.over30) ? 'red' : 'green'} />
        <Stat label="SDV complete" value={`${Math.round(sdv.pct * 100)}%`} tone="blue" />
        <Stat label="Coding backlog" value={cs.uncoded + cs.query} tone="purple" />
        <Stat label="SAE discrepancies open" value={sae} tone={sae ? 'amber' : 'green'} />
      </div>
      <Panel title="By site" sub="Missing pages: forms not entered for a visit that took place more than 14 days ago. Entry lag: median days from visit to entry.">
        <Table head={['Site', 'Screened', 'Randomised', 'Entry lag (d)', 'Missing pages', 'Active queries', 'Over 30 days', 'SDV progress', 'Coding backlog', 'Deviations (important)']} rows={rows.map((r) => [r.site, r.screened, r.rand, n(r.lag), r.missing || '', r.open, r.over30 ? <Pill tone="red">{r.over30}</Pill> : '', <Bar frac={r.sdv.pct} label={`${r.sdv.done} of ${r.sdv.req} required fields verified`} />, r.uncoded || '', `${r.dv} (${r.dvImportant})`])} />
      </Panel>
      <Panel title="Quality tolerance limits" sub="Study-level limits from the risk assessment. A warning shows at two thirds of the limit.">
        <Table head={['Parameter', 'Observed', 'Limit', 'Status']} rows={q.map((x) => [x.text, `${x.observed.toFixed(1)}% (${x.num} of ${x.den})`, `${x.limit}%`, x.state === 'breached' ? <Pill tone="red">▲ Breached</Pill> : x.state === 'warning' ? <Pill tone="amber">● Warning</Pill> : <Pill tone="green">✓ Within</Pill>])} />
      </Panel>
    </div>
  )
}

function Sdv() {
  const { p, act, tick } = useStore()
  const u = me(p)
  const subjects = useMemo(() => [...new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))].sort(), [tick])
  const [subj, setSubj] = useState(subjects[0] ?? '')
  const [fk, setFk] = useState<string | null>(null)
  const [raise, setRaise] = useState<{ key: string; label: string } | null>(null)
  const forms = Object.keys(p.forms).filter((k) => k.startsWith(subj + '|') && !p.forms[k].deleted).sort((a, b) => vIdx(a) - vIdx(b) || a.localeCompare(b))
  const cra = u.role === 'cra'
  return (
    <div className="space-y-4">
      <Panel title="SDV plan" sub="Targeted SDV verifies the critical-to-quality fields from the risk assessment, every field of an SAE and the eligibility form. Full SDV verifies every field." right={<SigLine s={p.sdvPlan.signature} />}>
        <p className="text-sm">Current plan: <b>{p.sdvPlan.mode === 'targeted' ? 'Targeted (risk-based)' : 'Full (100%)'}</b> · {Math.round(sdvProgress(p).pct * 100)}% of required fields verified{sdvProgress(p).changed ? ` · ${sdvProgress(p).changed} changed after SDV and need re-verifying` : ''}</p>
        {!p.sdvPlan.signature && <div className="grid md:grid-cols-2 gap-3">
          <SignBox meaning="Targeted SDV plan approved" what="SDV plan (targeted)" roles={['dmlead']} label="Approve targeted SDV" onSigned={(s) => act((pp) => setSdvPlan(pp, 'targeted', s))} />
          <SignBox meaning="Full SDV plan approved" what="SDV plan (full)" roles={['dmlead']} label="Approve full SDV" onSigned={(s) => act((pp) => setSdvPlan(pp, 'full', s))} />
        </div>}
      </Panel>
      <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
        <Panel title="Subject">
          <Select aria-label="Subject" value={subj} onChange={(e) => { setSubj(e.target.value); setFk(null) }} options={subjects.map((s) => ({ value: s, label: s }))} />
          <ul className="space-y-1">{forms.map((k) => { const req = sdvRequired(p, k); const done = req.filter((f) => sdvState(p, `${k}|${f}`) === 'verified').length; return (
            <li key={k}><button onClick={() => setFk(k)} className={`w-full text-left text-xs rounded border px-2 py-1 ${fk === k ? 'border-lab-fda' : 'border-lab-line'}`}>{k.split('|')[1]} · {FORMS[k.split('|')[2]].name}{k.split('|')[1] === 'LOG' ? ` #${k.split('|')[3]}` : ''} <span className="float-right font-mono">{req.length ? `${done}/${req.length}` : '—'}</span></button></li>
          ) })}</ul>
        </Panel>
        {fk ? (
          <Panel title={`${FORMS[fk.split('|')[2]].name} · ${fk.split('|').slice(0, 2).join(' · ')}`} sub={cra ? 'Compare each value with the source document, as at a monitoring visit. Verify only what matches; raise a query for anything that does not.' : 'Switch to Maya Lindqvist (CRA) to perform SDV and see the source documents.'}>
            <Table head={['Field', 'EDC value', cra ? 'Source document' : 'Source', 'SDV', '']} rows={sdvRequired(p, fk).map((f) => {
              const key = `${fk}|${f}`, def = FORMS[fk.split('|')[2]].fields.find((x) => x.id === f)!
              const lbl = (v?: string) => (def.codelist ? CODELISTS[def.codelist].find((o) => o.value === v)?.label ?? v : v) || 'blank'
              const st = sdvState(p, key)
              return [def.label, <span className="font-mono">{lbl(value(p, key))}</span>, cra ? <span className="font-mono">{lbl(sourceValue(fk, f))}</span> : <span className="text-lab-text-muted">hidden</span>, <Pill tone={st === 'verified' ? 'green' : st === 'changed' ? 'red' : 'amber'}>{st}</Pill>,
                cra ? <div className="flex gap-1"><Btn tone="green" className="py-0.5" disabled={st === 'verified'} onClick={() => act((pp) => verify(pp, key))}>Verify</Btn><Btn tone="amber" className="py-0.5" onClick={() => setRaise({ key, label: def.label })}>Query</Btn></div> : '']
            })} empty="Nothing on this form needs SDV under the current plan." />
          </Panel>
        ) : <Panel title="Select a form"><p className="text-sm text-lab-text-muted">Pick a form to verify it.</p></Panel>}
      </div>
      {raise && <RaiseModal itemKey={raise.key} label={raise.label} onClose={() => setRaise(null)} />}
    </div>
  )
}

function Deviations() {
  const { p, act } = useStore()
  const { go } = useNav()
  const [f, setF] = useState({ subj: '', category: 'Other' as DvCategory, description: '' })
  const can = ['dm', 'dmlead', 'cra'].includes(me(p).role)
  return (
    <div className="space-y-4">
      <Panel title="Protocol deviation log (DV)" sub="Deviations come from confirmed edit-check findings (logged automatically when a query on a deviation-type check closes with the data confirmed), from listings, monitoring and reconciliation. Each is classed as important or not, with a rationale.">
        <ul className="list-disc pl-5 text-xs text-lab-text-muted">{DV_PLAN.map((x) => <li key={x}>{x}</li>)}</ul>
        <Table head={['ID', 'Subject', 'Category', 'Description', 'Source', 'Identified', 'Classification', '']} rows={p.deviations.map((d) => [d.id, d.subj, d.category, d.description, <span className="text-[11px]">{d.source}</span>, d.identified,
          d.status === 'classified' ? <span className="text-xs">{d.important ? <Pill tone="red">Important</Pill> : <Pill>Not important</Pill>} <span className="text-lab-text-muted">{d.rationale}</span></span> : can ? <Classifier id={d.id} /> : <Pill tone="amber">to classify</Pill>,
          d.key ? <Btn tone="grey" className="py-0.5" onClick={() => go('casebook', d.key)}>Open</Btn> : ''])} empty="No deviations logged yet." />
      </Panel>
      {can && <Panel title="Log a deviation">
        <div className="flex flex-wrap gap-2">
          <input aria-label="Subject" className={ic('w-28')} value={f.subj} onChange={(e) => setF({ ...f, subj: e.target.value.trim() })} placeholder="103-004" />
          <Select aria-label="Category" className="w-56" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DvCategory })} options={DV_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <input aria-label="Description" className={ic('flex-1 min-w-64')} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What happened, when, and how it was found" />
          <Btn tone="solid" onClick={() => { if (act((pp) => { addDeviation(pp, { ...f, source: 'Logged manually' }) })) setF({ subj: '', category: 'Other', description: '' }) }}>Log</Btn>
        </div>
      </Panel>}
      <Panel title="Deviations by site">
        <Table head={['Site', 'Total', 'Important', 'Not important', 'To classify']} rows={SITES.map((s) => { const d = p.deviations.filter((x) => x.subj.startsWith(s.id)); return [s.id, d.length, d.filter((x) => x.important).length, d.filter((x) => x.status === 'classified' && !x.important).length, d.filter((x) => x.status !== 'classified').length] })} />
      </Panel>
    </div>
  )
}
function Classifier({ id }: { id: string }) {
  const { act } = useStore()
  const [why, setWhy] = useState('')
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <input aria-label={`Rationale for ${id}`} className={ic('w-48 py-0.5 text-xs')} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Rationale" />
      <Btn tone="red" className="py-0.5" onClick={() => act((pp) => classify(pp, id, true, why))}>Important</Btn>
      <Btn tone="grey" className="py-0.5" onClick={() => act((pp) => classify(pp, id, false, why))}>Not important</Btn>
    </div>
  )
}
export { expectedImportant }

function Monitoring() {
  const { p, tick } = useStore()
  const sigs = useMemo(() => signals(p), [tick])
  const flagged = sigs.filter((s) => s.flagged)
  return (
    <div className="space-y-4">
      <Panel title="Centralised monitoring (ICH E6(R3) 3.11.4.2)" sub="Key risk indicators per site, each compared with the median of the other sites. A flag is a question, not a finding: review it, then act or record why no action is needed. Small sites flag by chance.">
        <Table head={['Indicator', ...SITES.map((s) => `Site ${s.id}`)]} rows={(Object.keys(KRI) as (keyof typeof KRI)[]).map((k) => [<span title={KRI[k].why}>{KRI[k].label}</span>, ...SITES.map((s) => { const x = sigs.find((y) => y.id === `${s.id}:${k}`); return x ? <span className={x.flagged ? 'text-lab-red font-mono' : 'font-mono'}>{n(x.value, k === 'ae' ? 2 : 0)}{x.flagged ? ' ▲' : ''}</span> : '–' })])} />
        <p className="text-[11px] text-lab-text-muted">▲ flagged. Planned for-cause visits: {Object.entries(p.monitoring.forCause).map(([s, d]) => `site ${s} (${d})`).join(', ') || 'none'}.</p>
      </Panel>
      <Panel title={`${flagged.length} flags to review`}>
        <div className="space-y-2">{flagged.map((s) => <SignalRow key={s.id} id={s.id} />)}</div>
        {!flagged.length && <p className="text-sm text-lab-text-muted">Nothing flagged. Advance the clock: signals need data.</p>}
      </Panel>
    </div>
  )
}
function SignalRow({ id }: { id: string }) {
  const { p, act } = useStore()
  const s = signals(p).find((x) => x.id === id)!
  const dec = p.monitoring.decisions[id]
  const [finding, setFinding] = useState<'' | 'action' | 'explained'>('')
  const [action, setAction] = useState<MonitoringDecision['action'] | ''>('')
  const [note, setNote] = useState('')
  const can = ['dm', 'dmlead', 'cra'].includes(me(p).role)
  return (
    <div className="rounded border border-lab-line p-2 space-y-1.5">
      <p className="text-sm"><span className="font-mono">Site {s.site}</span> · {KRI[s.kri].label}: <b>{n(s.value, s.kri === 'ae' ? 2 : 1)}</b> against {n(s.reference, s.kri === 'ae' ? 2 : 1)} at the other sites. <span className="text-[11px] text-lab-text-muted">{KRI[s.kri].why}</span></p>
      {dec ? <p className="text-xs text-lab-text-muted">{dec.finding === 'action' ? `Action: ${dec.action}` : 'Explained, no action'} · {dec.note} · {dec.userId} {fmtUtc(dec.utc)} UTC</p> : can && (
        <div className="flex flex-wrap gap-2">
          <Select aria-label={`Finding for ${id}`} className="w-52 py-1 text-xs" value={finding} onChange={(e) => setFinding(e.target.value as typeof finding)} options={[{ value: '', label: 'Finding…' }, { value: 'action', label: 'Real issue: act' }, { value: 'explained', label: 'Explained: no action' }]} />
          {finding === 'action' && <Select aria-label="Action" className="w-48 py-1 text-xs" value={action ?? ''} onChange={(e) => setAction(e.target.value as MonitoringDecision['action'])} options={[{ value: '', label: 'Action…' }, { value: 'for-cause visit', label: 'For-cause visit' }, { value: 'site retraining', label: 'Site retraining' }, { value: 'escalate to sponsor', label: 'Escalate to sponsor' }]} />}
          <input aria-label="Note" className={ic('flex-1 min-w-48 py-1 text-xs')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked and found" />
          <Btn tone="solid" disabled={!finding} onClick={() => finding && act((pp) => decideSignal(pp, id, { finding, action: action || undefined, note }))}>Record</Btn>
        </div>
      )}
    </div>
  )
}

function Qtl() {
  const { p, act, tick } = useStore()
  const q = useMemo(() => qtlStatus(p), [tick])
  const [sel, setSel] = useState('')
  const [root, setRoot] = useState('')
  const [fix, setFix] = useState('')
  return (
    <div className="space-y-4">
      <Panel title="Quality tolerance limits (ICH E6(R3) 3.10)" sub="A breach of a QTL is investigated, its root cause and corrective action recorded, and reported in the clinical study report. Limits come from the start-up risk assessment.">
        <Table head={['QTL', 'Parameter', 'Observed', 'Warning at', 'Limit', 'Status']} rows={q.map((x) => [x.id, x.text, `${x.observed.toFixed(1)}% (${x.num}/${x.den})`, `${x.warn.toFixed(1)}%`, `${x.limit}%`, x.state === 'breached' ? <Pill tone="red">▲ Breached</Pill> : x.state === 'warning' ? <Pill tone="amber">● Warning</Pill> : <Pill tone="green">✓ Within</Pill>])} />
        <p className="text-[11px] text-lab-text-muted">QTL 3 compares each SAE’s site-awareness date with the date drug safety received it (24-hour rule). QTL 1 counts eligibility deviations classed important.</p>
      </Panel>
      <Panel title="Record a breach investigation">
        <Select aria-label="QTL" className="w-80" value={sel} onChange={(e) => setSel(e.target.value)} options={[{ value: '', label: 'Choose the QTL…' }, ...q.map((x) => ({ value: x.id, label: `${x.id} · ${x.text}` }))]} />
        <TextArea aria-label="Root cause" value={root} onChange={(e) => setRoot(e.target.value)} placeholder="Root cause (what the investigation found)" />
        <TextArea aria-label="Corrective action" value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Corrective and preventive action, owner and date" />
        {sel && <SignBox meaning="QTL breach investigated; actions approved" what={`QTL breach ${sel}`} roles={['dmlead']} label="Sign and record" onSigned={(s) => act((pp) => { recordBreach(pp, sel, root, fix, s); setRoot(''); setFix(''); setSel('') })} />}
        <Table head={['Record', 'QTL', 'Observed', 'Limit', 'Root cause', 'Action', 'Signed']} rows={p.qtlLog.map((l) => [l.id, l.qtl, `${l.observed.toFixed(1)}%`, `${l.limit}%`, l.rootCause, l.action, `${l.signature.userId} ${fmtUtc(l.utc)}`])} empty="No breach records." />
      </Panel>
    </div>
  )
}
