import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { BUCKETS, ageOf, bucketOf, isActive, metrics, scoreQuery, siteOf, type QualityRule } from '../domain/queries'
import { closeQuery, cancelQuery, requery, respond, me, value, userById, VISIT_NAME } from '../domain/project'
import { FORMS, SITES } from '../domain/study'
import { parseKey, ROLE_LABEL, type Query } from '../domain/types'
import { Panel, Pill, Btn, Table, Tabs, Select, TextArea, fmtUtc, Stat } from './ui'

export function QualityMeter({ score, rules }: { score: number; rules: QualityRule[] }) {
  return (
    <div className="rounded border border-lab-line p-2 space-y-1">
      <p className="text-xs"><span className="font-mono">Query quality </span><span className={score >= 70 ? 'text-lab-cdsco' : score >= 50 ? 'text-lab-amber' : 'text-lab-red'}>{score}%</span></p>
      <ul className="grid sm:grid-cols-2 gap-x-3 text-[11px]">{rules.map((r) => <li key={r.id} className={r.ok ? 'text-lab-cdsco' : 'text-lab-text-muted'}>{r.ok ? '✓' : '○'} {r.label}</li>)}</ul>
    </div>
  )
}
const TONE: Record<Query['status'], 'amber' | 'blue' | 'green' | 'grey'> = { open: 'amber', answered: 'blue', closed: 'green', cancelled: 'grey' }

export default function Queries() {
  const [t, setT] = useState<'list' | 'metrics' | 'coder'>('list')
  return (
    <div className="space-y-4">
      <Tabs value={t} onChange={setT} tabs={[{ id: 'list', label: 'Queries' }, { id: 'metrics', label: 'Ageing and metrics' }, { id: 'coder', label: 'Coder tasks' }]} />
      {t === 'list' && <QueryList />}
      {t === 'metrics' && <Metrics />}
      {t === 'coder' && <CoderTasks />}
    </div>
  )
}

function QueryList() {
  const { p, tick } = useStore()
  const nav = useNav()
  const [status, setStatus] = useState<string>('active')
  const [site, setSite] = useState('all')
  const [source, setSource] = useState('all')
  const [bucket, setBucket] = useState('all')
  const [sel, setSel] = useState<string | null>(nav.arg?.startsWith('Q-') ? nav.arg : null)
  const list = useMemo(() => p.queries.filter((q) =>
    (status === 'all' || (status === 'active' ? isActive(q) : q.status === status)) && (site === 'all' || siteOf(q.key) === site) && (source === 'all' || q.source === source) && (bucket === 'all' || (isActive(q) && bucketOf(ageOf(q, p.clock)) === bucket))
  ).sort((a, b) => b.raisedUtc.localeCompare(a.raisedUtc)), [tick, status, site, source, bucket])
  const q = p.queries.find((x) => x.id === sel)
  return (
    <div className="grid xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start">
      <Panel title={`${list.length} queries`} sub="Open: waiting for the site. Answered: waiting for data management to close or re-query.">
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'active', label: 'Active' }, { value: 'open', label: 'Open' }, { value: 'answered', label: 'Answered' }, { value: 'closed', label: 'Closed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]} />
          <Select aria-label="Site" className="w-32" value={site} onChange={(e) => setSite(e.target.value)} options={[{ value: 'all', label: 'All sites' }, ...SITES.map((s) => ({ value: s.id, label: `Site ${s.id}` }))]} />
          <Select aria-label="Source" className="w-36" value={source} onChange={(e) => setSource(e.target.value)} options={[{ value: 'all', label: 'Auto and manual' }, { value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'Manual' }]} />
          <Select aria-label="Age" className="w-36" value={bucket} onChange={(e) => setBucket(e.target.value)} options={[{ value: 'all', label: 'Any age' }, ...BUCKETS.map((b) => ({ value: b.id, label: b.label }))]} />
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <Table head={['Query', 'Status', 'Subject', 'Form · field', 'Source', 'Age (d)', 'Text']} rows={list.slice(0, 300).map((x) => {
            const k = parseKey(x.key)
            return [<button className={`font-mono ${sel === x.id ? 'text-lab-fda' : ''}`} onClick={() => setSel(x.id)}>{x.id}</button>, <Pill tone={TONE[x.status]}>{x.status}</Pill>, k.subj, `${FORMS[k.form].name}${k.visit === 'LOG' ? ` #${k.inst}` : ` · ${k.visit}`} · ${k.field}`, x.source === 'auto' ? x.checkId : 'manual', ageOf(x, p.clock), <button className="text-left line-clamp-2" onClick={() => setSel(x.id)}>{x.text}</button>]
          })} empty="No queries match." />
          {list.length > 300 && <p className="text-[11px] text-lab-text-muted mt-1">Showing the latest 300. Filter to narrow.</p>}
        </div>
      </Panel>
      {q ? <QueryDetail q={q} /> : <Panel title="Select a query"><p className="text-sm text-lab-text-muted">Pick a query to see its thread and act on it. Your role decides what you can do: the site answers; data management closes, re-queries or cancels.</p></Panel>}
    </div>
  )
}

function QueryDetail({ q }: { q: Query }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const u = me(p)
  const [text, setText] = useState('')
  const [cancel, setCancel] = useState('')
  const k = parseKey(q.key)
  const f = FORMS[k.form].fields.find((x) => x.id === k.field)
  const dmRole = u.role === 'dm' || u.role === 'dmlead' || (u.role === 'cra' && q.raisedBy === u.id)
  const sc = scoreQuery(text, f ? [f.label.split(' ')[0]] : [])
  return (
    <Panel title={`${q.id} · ${f?.label ?? k.field}`} sub={`${k.subj} · ${VISIT_NAME[k.visit]} · ${FORMS[k.form].name}${k.visit === 'LOG' ? ` #${k.inst}` : ''} · current value: ${value(p, q.key) || 'blank'}`} right={<Pill tone={TONE[q.status]}>{q.status}</Pill>}>
      <div className="flex flex-wrap gap-2 text-[11px] text-lab-text-muted">
        <span>{q.source === 'auto' ? `Raised by edit check ${q.checkId}` : 'Manual query'}</span>
        <span>· age {ageOf(q, p.clock)} days</span>
        {q.requeries > 0 && <span>· re-queried {q.requeries}×</span>}
        {q.dueDate && <span>· site expected to respond by {q.dueDate}</span>}
        {q.quality !== undefined && <span>· text quality {q.quality}%</span>}
        <button className="text-lab-fda" onClick={() => go('casebook', q.key)}>Open in casebook →</button>
      </div>
      <ol className="space-y-2">
        {q.msgs.map((m, i) => (
          <li key={i} className={`rounded border p-2 text-sm ${m.role === 'site' ? 'border-lab-fda/50 ml-6' : 'border-lab-line mr-6'}`}>
            <p className="font-mono text-[10px] text-lab-text-muted">{m.kind.toUpperCase()} · {userById(p, m.userId).name} ({ROLE_LABEL[m.role]}) · {fmtUtc(m.utc)} UTC</p>
            <p>{m.text}</p>
          </li>
        ))}
      </ol>
      {q.status === 'open' && (u.role === 'site' || u.role === 'pi') && (
        <div className="space-y-2">
          <TextArea aria-label="Response" value={text} onChange={(e) => setText(e.target.value)} placeholder="Answer the question. If the data are wrong, correct them in the casebook first (Edit, with a reason for change)." />
          <Btn tone="solid" disabled={!text.trim()} onClick={() => { if (act((pp) => respond(pp, q.id, text.trim()))) setText('') }}>Send response</Btn>
        </div>
      )}
      {q.status === 'open' && dmRole && <p className="text-xs text-lab-text-muted">Waiting for the site. Advance the clock, or switch to the site coordinator to answer it yourself. You can cancel a query raised in error:</p>}
      {q.status === 'answered' && dmRole && (
        <div className="space-y-2">
          <p className="text-xs text-lab-text-muted">Review the answer against the data. Close if it resolves the question; re-query if it does not.</p>
          <TextArea aria-label="Re-query or closing note" value={text} onChange={(e) => setText(e.target.value)} placeholder="Re-query text (or an optional closing note)" />
          {text.trim() && <QualityMeter score={sc.score} rules={sc.rules} />}
          <div className="flex flex-wrap gap-2">
            <Btn tone="green" onClick={() => { if (act((pp) => closeQuery(pp, q.id, text.trim() || 'Response accepted.'))) setText('') }}>Close</Btn>
            <Btn tone="amber" disabled={!text.trim()} onClick={() => { if (act((pp) => requery(pp, q.id, text))) setText('') }}>Re-query</Btn>
          </div>
        </div>
      )}
      {isActive(q) && dmRole && (
        <div className="flex flex-wrap gap-2 items-center">
          <input aria-label="Reason for cancelling" className="flex-1 min-w-48 rounded-md border border-lab-line bg-lab-panel-strong px-2 py-1 text-xs" value={cancel} onChange={(e) => setCancel(e.target.value)} placeholder="Reason for cancelling (e.g. raised in error)" />
          <Btn tone="red" disabled={!cancel.trim()} onClick={() => { if (act((pp) => cancelQuery(pp, q.id, cancel))) setCancel('') }}>Cancel query</Btn>
          <span className="w-full text-[11px] text-lab-text-muted">Cancel only a query that should never have been raised.</span>
        </div>
      )}
      {!dmRole && u.role !== 'site' && u.role !== 'pi' && <p className="text-xs text-lab-text-muted">As {ROLE_LABEL[u.role]} you can read this query. Switch role to act on it.</p>}
    </Panel>
  )
}

function Metrics() {
  const { p, tick } = useStore()
  const ms = useMemo(() => metrics(p), [tick])
  const tot = (f: (m: (typeof ms)[number]) => number) => ms.reduce((s, m) => s + f(m), 0)
  const n = (x: number, d = 0) => (Number.isNaN(x) ? '–' : x.toFixed(d))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Open" value={tot((m) => m.open)} tone="amber" />
        <Stat label="Answered, awaiting DM" value={tot((m) => m.answered)} tone="blue" />
        <Stat label="Closed" value={tot((m) => m.closed)} tone="green" />
        <Stat label="Over 30 days" value={tot((m) => m.buckets['31-60'] + m.buckets['60+'])} tone="red" />
      </div>
      <Panel title="Ageing of active queries by site" sub="Days since the query was raised. The DMP escalates queries older than 30 days to the CRA.">
        <Table head={['Site', ...BUCKETS.map((b) => b.label), 'Total active']} rows={ms.map((m) => [m.site, ...BUCKETS.map((b) => m.buckets[b.id] || ''), m.open + m.answered])} />
      </Panel>
      <Panel title="Query metrics by site" sub="Median days to close counts closed queries only. Entry lag is the median days from visit to data entry.">
        <Table head={['Site', 'Data points', 'Queries per 100 data points', 'Automatic share', 'Median days to close', 'Re-query rate', 'Data entry lag (d)', 'Cancelled']} rows={ms.map((m) => [m.site, m.dataPoints, n(m.perHundred, 1), `${Math.round(m.autoShare * 100)}%`, n(m.medianDaysToClose), `${Math.round(m.requeryRate * 100)}%`, n(m.entryLag), m.cancelled])} />
      </Panel>
    </div>
  )
}

function CoderTasks() {
  const { p } = useStore()
  const { go } = useNav()
  return (
    <Panel title="Coder tasks" sub="Raised by coding checks (AE-21, AE-22, CM-12). The coding review module arrives in Phase 2; here you can see the tasks and open the record.">
      <Table head={['Task', 'Status', 'Record', 'Check', 'Text', '']} rows={p.coderTasks.map((t) => [t.id, <Pill tone={t.status === 'pending' ? 'purple' : 'green'}>{t.status}</Pill>, t.key.split('|').slice(0, 4).join(' · '), t.checkId, t.text, <Btn tone="grey" className="py-0.5" onClick={() => go('casebook', t.key)}>Open</Btn>])} empty="No coder tasks yet." />
    </Panel>
  )
}
