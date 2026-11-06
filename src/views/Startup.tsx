import { useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { DMP, DMP_VERSION, CCG_GENERAL, CCG_FORM, RISKS, QTLS, fieldGuide } from '../domain/dmp'
import { FORMS } from '../domain/study'
import { audit, me, goLive } from '../domain/project'
import { ROLE_LABEL } from '../domain/types'
import { Panel, Pill, Btn, Tabs, SignBox, SigLine, Table, Select, inputCls, ic } from './ui'

type T = 'dmp' | 'ccg' | 'risk' | 'golive'
export default function Startup() {
  const [t, setT] = useState<T>('dmp')
  return (
    <div className="space-y-4">
      <Tabs value={t} onChange={setT} tabs={[{ id: 'dmp', label: 'Data management plan' }, { id: 'ccg', label: 'CRF completion guidelines' }, { id: 'risk', label: 'Risk assessment' }, { id: 'golive', label: 'Go-live' }]} />
      {t === 'dmp' && <DmpView />}
      {t === 'ccg' && <CcgView />}
      {t === 'risk' && <RiskView />}
      {t === 'golive' && <GoLive />}
    </div>
  )
}

function DmpView() {
  const { p, act } = useStore()
  const flags = p.startup.dmpFlags
  const [open, setOpen] = useState<string | null>(null)
  const signed = !!p.startup.dmpApproved
  return (
    <div className="space-y-3">
      <Panel title="Data management plan" sub={`${DMP_VERSION}. Read every statement. Flag a statement that breaks regulation or good practice, and choose the correction. This is mission M1.`} right={<SigLine s={p.startup.dmpApproved} />}>
        <p className="text-xs text-lab-text-muted">{Object.keys(flags).length} statements flagged. A flag records a review comment in the audit trail.</p>
      </Panel>
      {DMP.map((sec) => (
        <Panel key={sec.id} title={sec.title}>
          <ul className="space-y-2">
            {sec.statements.map((st) => {
              const f = flags[st.id]
              const opts = st.error?.options ?? [
                { id: 'x1', text: 'Reword this to make it stricter.' },
                { id: 'x2', text: 'Remove this statement.' },
                { id: 'x3', text: 'Move this statement to the CRF completion guidelines.' },
              ]
              return (
                <li key={st.id} className={`rounded border p-2 ${f ? 'border-lab-amber/70 bg-lab-amber-soft/30' : 'border-lab-line'}`}>
                  <div className="flex gap-2 items-start">
                    <span className="font-mono text-[11px] text-lab-text-muted w-8 shrink-0">{st.id}</span>
                    <p className="text-sm flex-1">{st.text}</p>
                    {!signed && <Btn tone={f ? 'amber' : 'grey'} onClick={() => setOpen(open === st.id ? null : st.id)}>{f ? 'Flagged' : 'Flag'}</Btn>}
                  </div>
                  {f && <p className="ml-10 mt-1 text-xs text-lab-amber">Proposed correction: {opts.find((o) => o.id === f)?.text}</p>}
                  {open === st.id && !signed && (
                    <div className="ml-10 mt-2 space-y-1.5">
                      <p className="text-xs text-lab-text-muted">Choose the correction:</p>
                      {[...opts].sort((a, b) => a.text.localeCompare(b.text)).map((o) => (
                        <button key={o.id} onClick={() => { act((pp) => { pp.startup.dmpFlags[st.id] = o.id; audit(pp, me(pp), 'dmp.flag', `DMP ${st.id}`, undefined, o.text, 'Review comment') }); setOpen(null) }}
                          className={`block w-full text-left rounded border px-2 py-1.5 text-xs ${f === o.id ? 'border-lab-fda text-lab-fda' : 'border-lab-line hover:border-lab-fda/60'}`}>{o.text}</button>
                      ))}
                      {f && <Btn tone="grey" onClick={() => { act((pp) => { delete pp.startup.dmpFlags[st.id]; audit(pp, me(pp), 'dmp.unflag', `DMP ${st.id}`, undefined, undefined, 'Review comment withdrawn') }); setOpen(null) }}>Remove flag</Btn>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>
      ))}
      {!signed && <Panel title="Approve the DMP" sub="Approval freezes the review. The lead data manager signs. Missions score the review when you finish M1.">
        <SignBox meaning="Approved" what="Data management plan" roles={['dmlead']} onSigned={(s) => act((pp) => { pp.startup.dmpApproved = s })} label="Approve DMP" />
      </Panel>}
    </div>
  )
}

function CcgView() {
  const { p, act } = useStore()
  return (
    <div className="space-y-3">
      <Panel title="CRF completion guidelines" sub="Instructions for site staff, form by form. Approved before go-live; every site user is trained on them." right={<SigLine s={p.startup.ccgApproved} />}>
        <ul className="list-disc pl-5 space-y-1 text-sm">{CCG_GENERAL.map((g) => <li key={g}>{g}</li>)}</ul>
      </Panel>
      <div className="grid md:grid-cols-2 gap-3">
        {Object.entries(CCG_FORM).map(([f, lines]) => (
          <Panel key={f} title={`${FORMS[f].name} (${FORMS[f].domain})`}>
            <ul className="list-disc pl-5 space-y-1 text-sm">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
            <details className="text-xs"><summary className="cursor-pointer text-lab-text-muted">Field by field ({FORMS[f].fields.length})</summary>
              <dl className="mt-1 space-y-1">{FORMS[f].fields.map((x) => { const g = fieldGuide(f, x); return <div key={x.id}><dt className="font-mono text-[11px]">{x.id}{x.required ? '*' : ''} · {x.label}</dt><dd className="text-lab-text-muted">{g.text} <span className="font-mono text-[10px]">[{g.rules.join(' · ')}]</span></dd></div> })}</dl>
            </details>
          </Panel>
        ))}
      </div>
      <Panel title="Training records" sub="Access is granted only after training on the protocol, the CCG and the EDC is documented.">
        <Table head={['User', 'Role', 'Trained']} rows={p.users.map((u) => [u.name, ROLE_LABEL[u.role], u.trained ? <Pill tone="green">Trained</Pill> : <Btn tone="amber" onClick={() => act((pp) => { const x = pp.users.find((y) => y.id === u.id)!; x.trained = true; audit(pp, me(pp), 'training.record', u.id, 'not trained', 'trained', 'Training on protocol v2.0, CCG v1.0 and EDC completed') })}>Record training</Btn>])} />
      </Panel>
      {!p.startup.ccgApproved && <SignBox meaning="Approved" what="CRF completion guidelines" roles={['dmlead']} onSigned={(s) => act((pp) => { pp.startup.ccgApproved = s })} label="Approve CCG" />}
    </div>
  )
}

function RiskView() {
  const { p, act } = useStore()
  const r = p.startup.risk
  const locked = !!p.startup.riskApproved
  const done = RISKS.every((x) => r[x.id]) && QTLS.every((q) => p.startup.qtl[q.id] !== undefined)
  const lvl = [{ value: '', label: '–' }, { value: '1', label: '1 low' }, { value: '2', label: '2 medium' }, { value: '3', label: '3 high' }]
  const setR = (id: string, k: 'likelihood' | 'impact' | 'detect', v: number) => act((pp) => { const cur = pp.startup.risk[id] ?? { likelihood: 0, impact: 0, detect: 0 }; pp.startup.risk[id] = { ...cur, [k]: v } })
  return (
    <div className="space-y-3">
      <Panel title="Risk assessment (ICH E6(R3) 3.10)" sub="Score each risk to the critical-to-quality factors: likelihood, impact, and how hard it is to detect (3 = hard). The score is the product; 12 or more needs a documented control. Scoring is your judgement; nothing is marked right or wrong." right={<SigLine s={p.startup.riskApproved} />}>
        <Table head={['Risk', 'Critical factor', 'Likelihood', 'Impact', 'Detectability', 'Score', 'Control']} rows={RISKS.map((x) => {
          const v = r[x.id]; const score = v ? v.likelihood * v.impact * v.detect : 0
          return [x.text, x.ctq,
            ...(['likelihood', 'impact', 'detect'] as const).map((k) => <Select key={k} aria-label={`${x.id} ${k}`} disabled={locked} className="w-24 py-0.5 text-xs" value={v?.[k] ? String(v[k]) : ''} options={lvl} onChange={(e) => setR(x.id, k, Number(e.target.value))} />),
            v && v.likelihood && v.impact && v.detect ? <Pill tone={score >= 12 ? 'red' : score >= 6 ? 'amber' : 'green'}>{score}</Pill> : '–',
            <span className="text-lab-text-muted">{x.control}</span>]
        })} />
      </Panel>
      <Panel title="Quality tolerance limits" sub="Study-level limits that, if crossed, trigger an investigation. Pick a value in the allowed range.">
        <Table head={['Parameter', 'Allowed range', 'Limit']} rows={QTLS.map((q) => [q.text, `${q.lo} to ${q.hi}`, <input aria-label={q.id} disabled={locked} type="number" min={q.lo} max={q.hi} className={ic('w-24 py-0.5')} value={p.startup.qtl[q.id] ?? ''} placeholder={String(q.suggest)}
          onChange={(e) => act((pp) => { const n = Number(e.target.value); if (e.target.value === '') delete pp.startup.qtl[q.id]; else if (n < q.lo || n > q.hi) throw new Error(`The limit must be between ${q.lo} and ${q.hi}.`); else pp.startup.qtl[q.id] = n })} />])} />
      </Panel>
      {!locked && (done
        ? <SignBox meaning="Approved" what="Risk assessment" roles={['dmlead']} onSigned={(s) => act((pp) => { pp.startup.riskApproved = s })} label="Approve risk assessment" />
        : <p className="text-xs text-lab-amber">Score every risk and set every limit to approve.</p>)}
    </div>
  )
}

function GoLive() {
  const { p, act } = useStore()
  const { go } = useNav()
  const st = p.startup
  const rows = [
    { ok: !!st.dmpApproved, text: 'Data management plan approved', view: 'startup' as const },
    { ok: !!st.ccgApproved, text: 'CRF completion guidelines approved', view: 'startup' as const },
    { ok: !!st.uatSigned, text: 'UAT summary signed for the data validation specification', view: 'checks' as const },
    { ok: !!st.riskApproved, text: 'Risk assessment and QTLs approved', view: 'startup' as const },
    { ok: p.users.every((u) => u.trained), text: 'Every user trained before access', view: 'startup' as const },
  ]
  const ready = rows.every((r) => r.ok)
  return (
    <Panel title="Go-live checklist" sub="The production database is released for data entry only when start-up is complete. First subject first visit is 2 March 2026." right={p.live ? <Pill tone="green">Live</Pill> : <Pill tone="amber">Not live</Pill>}>
      <ul className="space-y-1.5">{rows.map((r) => <li key={r.text} className="flex gap-2 text-sm"><span className={r.ok ? 'text-lab-cdsco' : 'text-lab-red'}>{r.ok ? '✓' : '✗'}</span><button className="hover:text-lab-fda text-left" onClick={() => go(r.view)}>{r.text}</button></li>)}</ul>
      {!p.live && ready && <SignBox meaning="Released for production data entry" what="Go-live" roles={['dmlead']} onSigned={(s) => act((pp) => { pp.startup.goLive = s; goLive(pp) })} label="Go live" />}
      {!p.live && !ready && <p className="text-xs text-lab-text-muted">Want to practise on live data first? Missions → Clean a messy site offers a prepared start-up.</p>}
      {p.live && <p className="text-sm text-lab-text">The study is live. Use the clock buttons at the top to move time forward; sites enter data and answer queries as time passes.</p>}
    </Panel>
  )
}
