import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { pairs, discrepancies, statusOf, decide, link, setCutoff, signoff, reconReady, inScope, safetyDb, resolvedIds, FIELD_LABEL, CRIT_LABEL, type Discrepancy, type Field } from '../domain/safety'
import { DTAS, VENDOR_IDS, transferLog, conformance, decideTransfer, extDiscrepancies, decideExt, addRule, standardise, latestLoaded, type VendorId, type ExtClass, type Transfer } from '../domain/external'
import { me } from '../domain/project'
import type { SaeClass } from '../domain/types'
import { Panel, Pill, Btn, Table, Tabs, Select, SignBox, SigLine, Stat, inputCls, ic, fmtUtc } from './ui'

type T = 'sae' | 'transfers' | 'vendor' | 'dta'
export default function Recon() {
  const [t, setT] = useState<T>('sae')
  return (
    <div className="space-y-4">
      <Tabs value={t} onChange={setT} tabs={[{ id: 'sae', label: 'SAE reconciliation' }, { id: 'transfers', label: 'Vendor transfers' }, { id: 'vendor', label: 'Vendor reconciliation' }, { id: 'dta', label: 'Data transfer agreements' }]} />
      {t === 'sae' && <Sae />}
      {t === 'transfers' && <Transfers />}
      {t === 'vendor' && <Vendor />}
      {t === 'dta' && <Dtas />}
    </div>
  )
}

const SAE_CLS: { value: SaeClass; label: string }[] = [
  { value: 'edc', label: 'EDC error: query the site' },
  { value: 'safety', label: 'Safety database error: note to drug safety' },
  { value: 'acceptable', label: 'Acceptable difference (give the reason)' },
  { value: 'not-reported', label: 'SAE not reported to safety: notify drug safety' },
  { value: 'missing-edc', label: 'SAE missing from the EDC: query the site' },
]
const ST_TONE = { open: 'amber', pending: 'blue', accepted: 'green', resolved: 'green' } as const
const show = (f: string, v: string) => (f === 'criteria' ? v.split(',').filter(Boolean).map((c) => CRIT_LABEL[c]).join(', ') : v) || '—'

function Sae() {
  const { p, tick, act } = useStore()
  const { go } = useNav()
  const ps = useMemo(() => pairs(p), [tick])
  const ds = useMemo(() => discrepancies(p), [tick])
  const done = useMemo(() => resolvedIds(p, ds), [tick, ds])
  const [cut, setCut] = useState(p.sae.cutoff ?? p.clock)
  const u = me(p)
  const dm = u.role === 'dm' || u.role === 'dmlead'
  const unmatchedCases = ps.filter((x) => !x.edc && x.sc).map((x) => x.sc!)
  const scope = ds.filter((d) => inScope(p, d))
  return (
    <div className="space-y-4">
      <Panel title="SAE reconciliation" sub="Every serious adverse event in the EDC against the sponsor’s safety database (fictional), field by field. Class each discrepancy; the site answers queries, drug safety answers notes, three days after they arrive. Both sides sign off at the agreed cut-off.">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="SAEs in EDC" value={ps.filter((x) => x.edc).length} /><Stat label="Cases in safety DB" value={safetyDb(p).length} />
          <Stat label="Open" value={scope.filter((d) => statusOf(p, d) === 'open').length} tone="amber" /><Stat label="Waiting" value={scope.filter((d) => statusOf(p, d) === 'pending').length} tone="blue" /><Stat label="Resolved" value={done.length} tone="green" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-lab-text-muted">Data cut-off</span>
          <input aria-label="Cut-off date" className={ic('w-36')} value={cut} onChange={(e) => setCut(e.target.value)} placeholder="YYYY-MM-DD" />
          <Btn tone="grey" disabled={!dm} onClick={() => act((pp) => setCutoff(pp, cut))}>Set cut-off</Btn>
          <span className="text-xs">{p.sae.cutoff ? `In scope: SAEs with onset up to ${p.sae.cutoff}` : 'No cut-off set: everything is in scope'}</span>
        </div>
      </Panel>
      <Panel title="Matched records" sub="Matched on subject and onset within 14 days. Link records by hand when a key differs (for example a mistyped subject number).">
        <Table head={['Subject', 'EDC term', 'Safety case', 'Safety term', 'Onset EDC / safety', 'Link']} rows={ps.map((x) => [
          x.edc?.subj ?? <span className="text-lab-text-muted">{x.sc!.subj}</span>,
          x.edc ? <button className="text-left hover:text-lab-fda" onClick={() => go('casebook', x.edc!.fk)}>{x.edc.term}</button> : <Pill tone="red">not in EDC</Pill>,
          x.sc?.caseId ?? <Pill tone="red">not in safety DB</Pill>, x.sc?.term ?? '', `${x.edc?.onset ?? '—'} / ${x.sc?.onset ?? '—'}`,
          x.edc && dm ? (x.linked ? <Btn tone="grey" className="py-0.5" onClick={() => act((pp) => link(pp, x.edc!.fk, null))}>Unlink</Btn> : !x.sc && unmatchedCases.length ? <Select aria-label={`Link ${x.edc.fk}`} className="w-48 py-0.5 text-xs" value="" onChange={(e) => e.target.value && act((pp) => link(pp, x.edc!.fk, e.target.value))} options={[{ value: '', label: 'Link to a case…' }, ...unmatchedCases.map((c) => ({ value: c.caseId, label: `${c.caseId} · ${c.subj} · ${c.term}` }))]} /> : x.linked ? 'linked' : '') : x.linked ? 'linked' : '',
        ])} empty="No serious adverse events yet. Advance the clock." />
      </Panel>
      <Panel title={`Discrepancies (${scope.length} in scope)`}>
        <div className="space-y-2">
          {scope.map((d) => <DiscRow key={d.id} d={d} />)}
          {!scope.length && <p className="text-sm text-lab-text-muted">No discrepancies in scope.</p>}
        </div>
      </Panel>
      <Panel title="Sign-off" sub="When every discrepancy in scope is resolved or accepted, data management and drug safety sign.">
        <p className="text-xs">Data management: <SigLine s={p.sae.signoffDm} /> · Drug safety: <SigLine s={p.sae.signoffSafety} /></p>
        {reconReady(p) ? (
          <div className="grid md:grid-cols-2 gap-3">
            {!p.sae.signoffDm && <SignBox meaning={`SAE reconciliation complete at cut-off ${p.sae.cutoff ?? p.clock}`} what="SAE reconciliation (data management)" roles={['dm', 'dmlead']} label="Sign for data management" onSigned={(s) => act((pp) => signoff(pp, s))} />}
            {!p.sae.signoffSafety && <SignBox meaning={`SAE reconciliation complete at cut-off ${p.sae.cutoff ?? p.clock}`} what="SAE reconciliation (drug safety)" roles={['safety']} label="Sign for drug safety" onSigned={(s) => act((pp) => signoff(pp, s))} />}
          </div>
        ) : <p className="text-xs text-lab-amber">Not ready: open or waiting discrepancies remain.</p>}
        <p className="text-[11px] text-lab-text-muted">The safety side of these cases is practised in the PV Intake Console and PV Detective (links come in Phase 4).</p>
      </Panel>
    </div>
  )
}

function DiscRow({ d }: { d: Discrepancy }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const st = statusOf(p, d)
  const dec = p.sae.decisions[d.id]
  const [cls, setCls] = useState<SaeClass | ''>('')
  const [reason, setReason] = useState('')
  const dm = ['dm', 'dmlead'].includes(me(p).role)
  const label = d.field === 'missing-safety' ? 'In EDC, not in the safety database' : d.field === 'missing-edc' ? 'In the safety database, not in the EDC' : FIELD_LABEL[d.field as Field]
  return (
    <div className="rounded border border-lab-line p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs">{d.pair.edc?.subj ?? d.pair.sc?.subj}</span><b>{label}</b>
        <span className="text-xs">EDC: <span className="font-mono">{show(d.field, d.edc)}</span></span>
        <span className="text-xs">Safety: <span className="font-mono">{show(d.field, d.safety)}</span></span>
        {d.field === 'term' && d.pair.edc?.pt && <span className="text-[11px] text-lab-text-muted">EDC coded to {d.pair.edc.pt}</span>}
        <Pill tone={ST_TONE[st]}>{st}</Pill>
      </div>
      {dec && <p className="text-[11px] text-lab-text-muted">Decided {dec.cls} by {dec.userId} {fmtUtc(dec.utc)} UTC{dec.reason ? `: ${dec.reason}` : ''}{dec.queryId && <> · <button className="text-lab-fda" onClick={() => go('queries', dec.queryId)}>{dec.queryId}</button></>}{dec.noteDue && !dec.done ? ` · drug safety replies by ${dec.noteDue}` : ''}{dec.reply ? ` · ${dec.reply}` : ''}</p>}
      {dm && st === 'open' && (
        <div className="flex flex-wrap gap-2">
          <Select aria-label={`Class for ${d.id}`} className="w-80 py-1 text-xs" value={cls} onChange={(e) => setCls(e.target.value as SaeClass)} options={[{ value: '', label: 'Choose the class…' }, ...SAE_CLS]} />
          <input aria-label="Reason" className={ic('flex-1 min-w-40 py-1 text-xs')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason or note" />
          <Btn tone="solid" disabled={!cls} onClick={() => cls && act((pp) => decide(pp, d, cls, reason))}>Record</Btn>
        </div>
      )}
      {dm && st === 'pending' && dec?.reply && <Btn tone="grey" className="py-0.5" onClick={() => act((pp) => { delete pp.sae.decisions[d.id] })}>Re-open and decide again</Btn>}
    </div>
  )
}

function Transfers() {
  const { p, tick, act } = useStore()
  const log = useMemo(() => transferLog(p.clock), [tick])
  const [sel, setSel] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const t = log.find((x) => x.id === sel)
  const dm = ['dm', 'dmlead'].includes(me(p).role)
  return (
    <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 items-start">
      <Panel title="Transfer log" sub="Files arrive on the secure transfer server on the first Monday of each month. Check each against its data transfer agreement before loading.">
        <Table head={['Date', 'Vendor', 'File', 'Records (log)', 'Status']} rows={log.map((x) => {
          const s = p.ext.transfers[x.id]
          return [x.date, x.vendor, <button className={`text-left font-mono text-[11px] ${sel === x.id ? 'text-lab-fda' : ''}`} onClick={() => { setSel(x.id); setReason('') }}>{x.file}{x.resendOf ? ' (re-sent)' : ''}</button>, conformanceDeclared(p, x), s ? <Pill tone={s.status === 'accepted' ? 'green' : 'red'}>{s.status === 'accepted' ? 'loaded' : 'rejected'}</Pill> : <Pill tone="amber">new</Pill>]
        })} empty="No transfers yet. The first arrives on 6 April 2026." />
      </Panel>
      {t ? <TransferDetail t={t} reason={reason} setReason={setReason} dm={dm} act={act} /> : <Panel title="Select a transfer"><p className="text-sm text-lab-text-muted">Pick a file to run the DTA checks and preview it.</p></Panel>}
    </div>
  )
}
const conformanceDeclared = (p: ReturnType<typeof useStore>['p'], t: Transfer) => conformance(p, t).checks.find((c) => c.id === 'count')!.detail.split(',')[0].replace('Log ', '')

function TransferDetail({ t, reason, setReason, dm, act }: { t: Transfer; reason: string; setReason: (s: string) => void; dm: boolean; act: ReturnType<typeof useStore>['act'] }) {
  const { p } = useStore()
  const c = conformance(p, t)
  const s = p.ext.transfers[t.id]
  return (
    <Panel title={t.file} sub={`${DTAS[t.vendor].name} · ${DTAS[t.vendor].system} · received ${t.date}`} right={s && <Pill tone={s.status === 'accepted' ? 'green' : 'red'}>{s.status}</Pill>}>
      <Table head={['DTA check', 'Result', 'Detail']} rows={c.checks.map((x) => [x.label, x.ok ? <Pill tone="green">pass</Pill> : <Pill tone="red">fail</Pill>, <span className="text-[11px]">{x.detail}</span>])} />
      <p className="text-xs text-lab-text-muted">Preview, first 8 of {c.rows.length} rows</p>
      <Table head={c.header} rows={c.rows.slice(0, 8).map((r) => c.header.map((h) => <span className="font-mono text-[10px]">{r[h]}</span>))} />
      {s && <p className="text-[11px] text-lab-text-muted">{s.status} by {s.userId} {fmtUtc(s.utc)} UTC{s.reason ? `: ${s.reason}` : ''}</p>}
      {dm && !s && (
        <div className="flex flex-wrap gap-2">
          <input aria-label="Reason" className={ic('flex-1 min-w-48')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to reject)" />
          <Btn tone="green" onClick={() => act((pp) => decideTransfer(pp, t, 'accepted', reason))}>Load</Btn>
          <Btn tone="red" onClick={() => act((pp) => decideTransfer(pp, t, 'rejected', reason))}>Reject and ask for a re-send</Btn>
        </div>
      )}
      {!dm && <p className="text-xs text-lab-text-muted">Switch to data management to load or reject.</p>}
    </Panel>
  )
}

const EXT_CLS: { value: ExtClass; label: string }[] = [
  { value: 'edc', label: 'EDC error: query the site' },
  { value: 'vendor', label: 'Vendor error: data clarification to the vendor' },
  { value: 'acceptable', label: 'Acceptable under the DTA (give the reason)' },
  { value: 'no-action', label: 'Timing difference: no action, re-check next transfer' },
]

function Vendor() {
  const { p, tick, act } = useStore()
  const { go } = useNav()
  const [v, setV] = useState<VendorId>('CL')
  const ds = useMemo(() => extDiscrepancies(p, v), [tick, v])
  const dm = ['dm', 'dmlead'].includes(me(p).role)
  const t = latestLoaded(p, v)
  const [rule, setRule] = useState({ test: 'GLUC', from: 'mg/dL', to: 'mmol/L', factor: '', site: '' })
  const rows = useMemo(() => (t && v === 'CL' ? conformance(p, t).rows.filter((r) => r.LBORRESU !== 'mmol/L' && r.LBORRESU !== '%').slice(0, 6) : []), [tick, v])
  return (
    <div className="space-y-4">
      <Tabs value={v} onChange={setV} tabs={VENDOR_IDS.map((x) => ({ id: x, label: DTAS[x].name.replace(' (fictional)', '') }))} />
      <Panel title={`Reconciliation against ${t ? t.file : 'no loaded transfer'}`} sub={`Keys: ${DTAS[v].keys}. EDC records newer than the vendor’s cut-off (${DTAS[v].cutoff} days before the transfer) are left out.`}>
        {!t && <p className="text-sm text-lab-text-muted">Load a transfer from this vendor first.</p>}
        <div className="space-y-2">
          {ds.map((d) => <ExtRow key={d.id} d={d} dm={dm} />)}
          {t && !ds.length && <p className="text-sm text-lab-cdsco">The EDC and the vendor file agree.</p>}
        </div>
      </Panel>
      {v === 'CL' && (
        <Panel title="Unit conversion rules" sub="Results not in the DTA’s units are converted to standard units for analysis by a documented rule; the vendor is also asked to correct its feed. Glucose: 1 mmol/L = 18.0 mg/dL.">
          <Table head={['Rule', 'Test', 'From', 'To', 'Divide by', 'Site', 'By']} rows={p.ext.rules.map((r) => [r.id, r.test, r.from, r.to, r.factor, r.site || 'all', `${r.userId} ${fmtUtc(r.utc)}`])} empty="No rules yet." />
          {dm && <div className="flex flex-wrap gap-2 items-center">
            <Select aria-label="Test" className="w-28" value={rule.test} onChange={(e) => setRule({ ...rule, test: e.target.value })} options={['GLUC', 'SODIUM', 'HBA1C'].map((x) => ({ value: x, label: x }))} />
            <input aria-label="From unit" className={ic('w-24')} value={rule.from} onChange={(e) => setRule({ ...rule, from: e.target.value })} />
            <span className="text-xs">→</span>
            <input aria-label="To unit" className={ic('w-24')} value={rule.to} onChange={(e) => setRule({ ...rule, to: e.target.value })} />
            <input aria-label="Divide by" className={ic('w-24')} value={rule.factor} onChange={(e) => setRule({ ...rule, factor: e.target.value })} placeholder="factor" />
            <input aria-label="Site (optional)" className={ic('w-24')} value={rule.site} onChange={(e) => setRule({ ...rule, site: e.target.value })} placeholder="site" />
            <Btn tone="solid" onClick={() => act((pp) => addRule(pp, { vendor: 'CL', test: rule.test, from: rule.from.trim(), to: rule.to.trim(), factor: Number(rule.factor), site: rule.site.trim() || undefined }))}>Add rule</Btn>
          </div>}
          {rows.length > 0 && <Table head={['Subject', 'Test', 'As reported', 'Range as reported', 'Standardised', 'Range standardised']} rows={rows.map((r) => { const s = standardise(p, r); return [r.SUBJID, r.LBTESTCD, `${r.LBORRES} ${r.LBORRESU}`, `${r.LBORNRLO} to ${r.LBORNRHI}`, s.converted ? `${s.value} ${s.unit}` : <Pill tone="amber">no rule</Pill>, s.converted ? `${s.lo} to ${s.hi}` : ''] })} />}
          <button className="text-xs text-lab-fda" onClick={() => go('listings')}>Local lab listing (units at site level) →</button>
        </Panel>
      )}
    </div>
  )
}

function ExtRow({ d, dm }: { d: ReturnType<typeof extDiscrepancies>[number]; dm: boolean }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const dec = p.ext.decisions[d.id]
  const [cls, setCls] = useState<ExtClass | ''>('')
  const [reason, setReason] = useState('')
  return (
    <div className="rounded border border-lab-line p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs">{d.subj} · {d.visit}</span><b>{d.field}</b>
        <span className="text-xs">EDC: <span className="font-mono">{d.edc || '—'}</span></span>
        <span className="text-xs">Vendor: <span className="font-mono">{d.vendorValue || '—'}</span></span>
        {d.note && <span className="text-[11px] text-lab-text-muted">{d.note}</span>}
        <Pill tone={dec ? 'blue' : 'amber'}>{dec ? dec.cls : 'open'}</Pill>
      </div>
      {dec && <p className="text-[11px] text-lab-text-muted">by {dec.userId} {fmtUtc(dec.utc)} UTC{dec.reason ? `: ${dec.reason}` : ''}{dec.queryId && <> · <button className="text-lab-fda" onClick={() => go('queries', dec.queryId)}>{dec.queryId}</button></>}{dec.reply ? ` · ${dec.reply}` : ''}{dec.cls === 'vendor' && p.ext.vendorFixes[d.id] ? ` · vendor fixed on ${p.ext.vendorFixes[d.id]}; check the next transfer` : ''}</p>}
      {dm && !dec && (
        <div className="flex flex-wrap gap-2">
          <Select aria-label={`Class for ${d.id}`} className="w-80 py-1 text-xs" value={cls} onChange={(e) => setCls(e.target.value as ExtClass)} options={[{ value: '', label: 'Choose the class…' }, ...EXT_CLS]} />
          <input aria-label="Reason" className={ic('flex-1 min-w-40 py-1 text-xs')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason or note" />
          <Btn tone="solid" disabled={!cls} onClick={() => cls && act((pp) => decideExt(pp, d, cls, reason))}>Record</Btn>
        </div>
      )}
      {dm && dec?.reply && <Btn tone="grey" className="py-0.5" onClick={() => act((pp) => { delete pp.ext.decisions[d.id] })}>Re-open and decide again</Btn>}
    </div>
  )
}

function Dtas() {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {VENDOR_IDS.map((v) => { const d = DTAS[v]; return (
        <Panel key={v} title={d.name} sub={`Data transfer agreement v1.0 · ${d.system}`}>
          <dl className="text-xs space-y-1">
            <div><dt className="text-lab-text-muted">File name</dt><dd className="font-mono">{d.file}</dd></div>
            <div><dt className="text-lab-text-muted">Format</dt><dd>Text, delimiter “{d.delimiter}”, header row</dd></div>
            <div><dt className="text-lab-text-muted">Frequency</dt><dd>{d.frequency}</dd></div>
            <div><dt className="text-lab-text-muted">Columns, in order</dt><dd className="font-mono text-[11px]">{d.columns.join(' | ')}</dd></div>
            <div><dt className="text-lab-text-muted">Required</dt><dd className="font-mono text-[11px]">{d.required.join(', ')}</dd></div>
            <div><dt className="text-lab-text-muted">Never transferred (blinding)</dt><dd className="font-mono text-[11px]">{d.prohibited.join(', ')}</dd></div>
            <div><dt className="text-lab-text-muted">Reconciliation keys</dt><dd>{d.keys}</dd></div>
          </dl>
          <ul className="list-disc pl-5 text-xs space-y-1">{d.rules.map((r) => <li key={r}>{r}</li>)}</ul>
        </Panel>
      ) })}
    </div>
  )
}
