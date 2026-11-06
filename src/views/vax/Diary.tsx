import { useMemo, useState } from 'react'
import { useStore } from '../../state'
import { useNav } from '../../App'
import { SITES } from '../../domain/study'
import { me } from '../../domain/project'
import { vaxSeed } from '../../domain/vax/seed'
import { DIARY_ITEMS, DIARY_DAYS, SCALE_TEXT, GRADE_WORD, gradeOf, gradeMm, gradeTemp } from '../../domain/vax/study'
import { viewOf, sendAlert, alertOutcome, compliance, dayKey, dcfVisible, decideDcf, transfers, queryVendor, reconRows, markRecon, immRows, missingSamples, type DayView } from '../../domain/vax/diary'
import { addDays } from '../../domain/util'
import { Panel, Pill, Btn, Table, Tabs, Stat, TextArea, Select, ic, fmtUtc } from '../ui'

type T = 'compliance' | 'data' | 'dcf' | 'transfers' | 'recon' | 'imm' | 'grading'
const TABS: { id: T; label: string }[] = [
  { id: 'compliance', label: 'Compliance' }, { id: 'data', label: 'Diary data' }, { id: 'dcf', label: 'Corrections (DCF)' },
  { id: 'transfers', label: 'Vendor transfers' }, { id: 'recon', label: 'Reconciliation' }, { id: 'imm', label: 'Immunogenicity' }, { id: 'grading', label: 'Grading scale' },
]

export default function Diary() {
  const nav = useNav()
  const [t, setT] = useState<T>(TABS.some((x) => x.id === nav.arg) ? (nav.arg as T) : 'compliance')
  return (
    <div className="space-y-4">
      <Panel title="E-diary" sub="Participants record solicited reactions every evening for 7 days after each dose. The diary is electronic source held by the diary vendor: data management reviews it, but cannot change it. Days are numbered from 1 (the day of vaccination).">
        <Tabs tabs={TABS} value={t} onChange={setT} />
      </Panel>
      {t === 'compliance' && <Compliance />}
      {t === 'data' && <Data />}
      {t === 'dcf' && <Dcf />}
      {t === 'transfers' && <Transfers />}
      {t === 'recon' && <Recon />}
      {t === 'imm' && <Imm />}
      {t === 'grading' && <Grading />}
    </div>
  )
}

const CELL: Record<DayView, { c: string; t: string; s: string }> = {
  received: { c: 'border-lab-cdsco/60 text-lab-cdsco bg-lab-cdsco-soft', t: '✓', s: 'received' },
  open: { c: 'border-lab-amber text-lab-amber bg-lab-amber-soft', t: '!', s: 'not received; window open until 12:00 today' },
  missed: { c: 'border-lab-red/60 text-lab-red bg-lab-red-soft', t: '✕', s: 'not received' },
  future: { c: 'border-lab-line text-lab-text-muted', t: '·', s: 'not yet due' },
  'not due': { c: 'border-lab-line text-lab-text-muted', t: '', s: 'not due' },
}

function Compliance() {
  const { p, act } = useStore()
  const s = vaxSeed().vax
  const [note, setNote] = useState('')
  const parts = Object.keys(s.doses).filter((x) => s.doses[x][1]! < p.clock).sort()
  const open = s.diary.filter((x) => viewOf(p, x) === 'open')
  const c = compliance(p)
  const alertsToday = p.vax?.alerts.filter((a) => a.date === p.clock) ?? []
  const can = ['dm', 'dmlead', 'cra'].includes(me(p).role)
  return (
    <>
      <Panel title="Today" sub={`Study date ${p.clock}. Yesterday’s diary closes at 12:00 today. A day the site is alerted about now can still be completed; tomorrow it is lost.`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Diary days due" value={c.due} />
          <Stat label="Completed in the window" value={`${c.pct}%`} tone={c.pct >= 90 ? 'green' : 'amber'} />
          <Stat label="Open now, not received" value={open.length} tone={open.length ? 'amber' : 'grey'} />
          <Stat label="Alerts sent today" value={alertsToday.length} tone="blue" />
        </div>
        <Table head={['Participant', 'Dose', 'Diary day', 'Date', 'Site alerted', '']} rows={open.map((x) => {
          const k = dayKey(x.subj, x.dose, x.day)
          const d = p.vax?.days[k]
          return [<span className="font-mono">{x.subj}</span>, x.dose, x.day + 1, x.date, d?.alertDate === p.clock ? <Pill tone="blue">Alerted today</Pill> : '—',
            d?.alertDate === p.clock ? '' : <Btn className="py-0.5" disabled={!can} title={can ? '' : 'Switch to data management or the CRA'} onClick={() => act((pp) => sendAlert(pp, k, note))}>Alert the site</Btn>]
        })} empty="Nothing open: every diary day due yesterday has been received." />
        <input aria-label="Alert note (optional)" className={ic('text-xs')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the site (default: please remind the participant to complete yesterday’s diary before 12:00 today)" />
        {!can && <p className="text-[11px] text-lab-amber">Alerts are sent by data management or the CRA. Switch role at the top.</p>}
      </Panel>
      <Panel title="By participant" sub="Each cell is one diary day: ✓ received · ! open until noon today · ✕ not received · · not yet due. A device that does not sync shows as missing until its data upload.">
        <div className="overflow-x-auto">
          <table className="text-[11px] font-mono">
            <thead><tr><th className="text-left pr-3">Participant</th><th colSpan={DIARY_DAYS} className="px-1">Dose 1 · days 1–7</th><th className="w-3" /><th colSpan={DIARY_DAYS} className="px-1">Dose 2 · days 1–7</th><th className="pl-3 text-left">Site alerts</th></tr></thead>
            <tbody>{parts.map((subj) => (
              <tr key={subj}><td className="pr-3">{subj}</td>
                {[1, 2].map((dose) => [...Array.from({ length: DIARY_DAYS }, (_, day) => {
                  const x = s.diary.find((y) => y.subj === subj && y.dose === dose && y.day === day)
                  const v: DayView = x ? viewOf(p, x) : 'not due'
                  return <td key={`${dose}-${day}`} className="p-0.5"><span title={`${subj} dose ${dose} day ${day + 1}${x ? ` (${x.date})` : ''}: ${CELL[v].s}`} className={`inline-block w-5 text-center rounded border ${CELL[v].c}`}>{CELL[v].t}</span></td>
                }), dose === 1 ? <td key="gap" /> : null])}
                <td className="pl-3 text-lab-text-muted">{p.vax?.alerts.filter((a) => a.key.startsWith(subj + '|')).length || ''}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Completion by site">
        <Table head={['Site', 'Days due', 'Completed in the window', 'Alerts sent']} rows={SITES.map((st) => {
          const due = s.diary.filter((x) => x.subj.startsWith(st.id) && x.date <= addDays(p.clock, -2))
          const ok = due.filter((x) => p.vax?.days[dayKey(x.subj, x.dose, x.day)]?.entered)
          return [st.id, due.length, due.length ? `${Math.round((ok.length / due.length) * 1000) / 10}%` : '—', p.vax?.alerts.filter((a) => a.key.startsWith(st.id)).length ?? 0]
        })} />
        <p className="text-[11px] text-lab-text-muted">“Completed in the window” counts entries made before the day locked, including those that reached the vendor late because a device did not sync.</p>
      </Panel>
      {(p.vax?.alerts.length ?? 0) > 0 && <Panel title="Alert log">
        <Table head={['Date', 'Diary day', 'Sent by', 'Note', 'Outcome']} rows={[...(p.vax?.alerts ?? [])].reverse().slice(0, 40).map((a) => { const [subj, dose, day] = a.key.split('|'); return [a.date, `${subj} dose ${dose} day ${Number(day) + 1}`, a.userId, a.note, alertOutcome(p, a.key)] })} />
      </Panel>}
    </>
  )
}

function Data() {
  const { p } = useStore()
  const s = vaxSeed().vax
  const parts = useMemo(() => Object.keys(s.doses).filter((x) => s.doses[x][1]! < p.clock).sort(), [p.clock])
  const [subj, setSubj] = useState(parts[0] ?? '')
  if (!parts.length) return <Panel title="Diary data"><p className="text-sm">No diary data yet. Advance the study clock: the first dose is on {s.doses['201-001']?.[1]}.</p></Panel>
  return (
    <Panel title="Diary data" sub="As received from the vendor. Read-only: changes come only through a data clarification form. Grades are derived by the system on the FDA 2007 scale; check them on the Grading scale tab." right={<Select aria-label="Participant" className="w-36" value={subj} onChange={(e) => setSubj(e.target.value)} options={parts.map((x) => ({ value: x, label: x }))} />}>
      {[1, 2].filter((dose) => s.doses[subj]?.[dose as 1 | 2]).map((dose) => {
        const days = Array.from({ length: DIARY_DAYS }, (_, day) => ({ x: s.diary.find((y) => y.subj === subj && y.dose === dose && y.day === day)!, d: p.vax?.days[dayKey(subj, dose, day)] }))
        const shown = (i: number) => (days[i].x && viewOf(p, days[i].x) === 'received' ? days[i].d?.values : undefined)
        return (
          <div key={dose} className="space-y-1">
            <p className="font-mono text-xs">Dose {dose} · vaccinated {s.doses[subj][dose as 1 | 2]} · device {s.devices[subj]}</p>
            <div className="overflow-x-auto">
              <table className="text-[11px] w-full">
                <thead><tr className="text-lab-text-muted"><th className="text-left">Item</th>{days.map((_, i) => <th key={i} className="px-1">Day {i + 1}</th>)}<th className="px-1">Highest</th></tr></thead>
                <tbody>{DIARY_ITEMS.map((it) => {
                  const grades = days.map((_, i) => gradeOf(it.id, shown(i)?.[it.id]))
                  const max = Math.max(...grades)
                  return <tr key={it.id} className="border-t border-lab-line">
                    <td className="pr-2">{it.label}</td>
                    {days.map((_, i) => {
                      const v = shown(i)?.[it.id]; const g = grades[i]
                      const changed = days[i].d?.changes?.some((c) => c.field === it.id)
                      return <td key={i} className={`px-1 text-center font-mono ${g >= 3 ? 'text-lab-red' : g === 2 ? 'text-lab-amber' : ''}`} title={changed ? 'Changed through a DCF' : ''}>
                        {v === undefined ? <span className="text-lab-text-muted">–</span> : it.type === 'scale' ? (v === '0' ? '·' : SCALE_TEXT[Number(v)]?.split(':')[0]) : it.type === 'yn' ? (v === 'Y' ? 'Yes' : '·') : v}{changed ? '*' : ''}
                      </td>
                    })}
                    <td className="px-1 text-center">{it.type === 'yn' ? '' : max ? <Pill tone={max >= 3 ? 'red' : max === 2 ? 'amber' : 'grey'}>{GRADE_WORD[max]}</Pill> : '·'}</td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          </div>
        )
      })}
      <p className="text-[11px] text-lab-text-muted">– not received · * changed through a data clarification form (see the audit trail). A grade 3 reaction should have prompted a site contact; a reaction still present on day 7 needs a continuing-reaction record on the eCRF.</p>
    </Panel>
  )
}

function Dcf() {
  const { p, act } = useStore()
  const reqs = dcfVisible(p)
  return (
    <>
      <Panel title="Requests to change diary data" sub="The participant is the originator of diary data. A change is justified only when a contemporaneous source supports it (for example a phone note or e-mail made when the error was noticed). Sponsor and monitor staff may not change participant data. Recall days or weeks later does not replace a diary entry. Sent forms are applied by the vendor the next day.">
        {!reqs.length && <p className="text-sm">No requests yet. They arrive as sites review the diaries with participants.</p>}
      </Panel>
      {reqs.map((r) => <DcfCard key={r.id} id={r.id} act={act} p={p} />)}
    </>
  )
}
function DcfCard({ id, p, act }: { id: string; p: ReturnType<typeof useStore>['p']; act: ReturnType<typeof useStore>['act'] }) {
  const r = vaxSeed().vax.requests.find((x) => x.id === id)!
  const d = p.vax?.dcf[id]
  const [choice, setChoice] = useState<'send' | 'return'>(d?.decision ?? 'send')
  const [val, setVal] = useState(d?.value ?? (r.field === 'ALL' ? '' : r.to))
  const [why, setWhy] = useState(d?.reason ?? '')
  const field = r.field === 'ALL' ? 'whole day' : DIARY_ITEMS.find((i) => i.id === r.field)?.label ?? r.field
  return (
    <Panel title={`${r.id} · ${r.subj} · dose ${r.dose} day ${r.day + 1} · ${field}`} sub={`Received ${r.date} from ${r.requester}`} right={d ? <Pill tone={d.applied ? 'green' : d.decision === 'send' ? 'blue' : 'grey'}>{d.applied ? `applied ${d.applied}` : d.decision === 'send' ? 'sent to vendor' : 'returned to site'}</Pill> : <Pill tone="amber">to decide</Pill>}>
      <p className="text-sm">{r.story}</p>
      <p className="text-xs"><b>Entered:</b> <span className="font-mono">{r.from}</span> · <b>Requested:</b> <span className="font-mono">{r.to || '(delete)'}</span> · <b>Source:</b> {r.source}</p>
      {!d?.applied && <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="radio" name={`dcf-${id}`} checked={choice === 'send'} onChange={() => setChoice('send')} />Send a DCF to the vendor</label>
          <label className="flex items-center gap-1"><input type="radio" name={`dcf-${id}`} checked={choice === 'return'} onChange={() => setChoice('return')} />Return to the requester</label>
          {choice === 'send' && <label className="flex items-center gap-1 text-xs">Corrected value<input aria-label="Corrected value" className={ic('w-28 font-mono')} value={val} onChange={(e) => setVal(e.target.value)} /></label>}
        </div>
        <TextArea aria-label="Reason" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason for the decision (kept in the audit trail)" />
        <Btn tone="solid" onClick={() => act((pp) => decideDcf(pp, id, choice, why, val))}>{d ? 'Change decision' : 'Record decision'}</Btn>
      </div>}
      {d && <p className="text-[11px] text-lab-text-muted">Decided by {d.userId} at {fmtUtc(d.utc)}: {d.reason}</p>}
    </Panel>
  )
}

function Transfers() {
  const { p, act } = useStore()
  const list = transfers(p)
  const [text, setText] = useState<Record<string, string>>({})
  return (
    <>
      <Panel title="Nightly diary transfers" sub="The vendor sends one file a night with every entry uploaded that day. Each file is checked against the data transfer agreement: participants known to the eCRF, device IDs linked to the right participant, no duplicates.">
        <Table head={['File', 'Date', 'Records', 'Participants', 'Checks']} rows={list.slice(0, 60).map((x) => [<span className="font-mono text-[11px]">{x.file}</span>, x.date, x.records, x.participants,
          x.issues.length ? <div className="space-y-1">{x.issues.map((i) => <div key={i} className="text-lab-amber text-xs">{i}</div>)}
            <div className="flex gap-1"><input aria-label="Vendor query" className={ic('text-xs')} value={text[x.file] ?? ''} onChange={(e) => setText({ ...text, [x.file]: e.target.value })} placeholder="Ask the vendor to check the device link" /><Btn className="py-0.5" onClick={() => act((pp) => queryVendor(pp, x.file, text[x.file] ?? ''))}>Send</Btn></div></div> : <Pill tone="green">conforms</Pill>])} empty="No transfers yet." />
      </Panel>
      {(p.vax?.vendorQueries.length ?? 0) > 0 && <Panel title="Queries to the diary vendor"><Table head={['ID', 'About', 'Text', 'Sent']} rows={p.vax!.vendorQueries.map((q) => [q.id, q.about, q.text, fmtUtc(q.utc)])} /></Panel>}
    </>
  )
}

function Recon() {
  const { p, act } = useStore()
  const rows = reconRows(p)
  const marks = p.vax?.recon ?? {}
  return (
    <Panel title="Reconciliation worksheet" sub="Participants whose second diary ended at least two weeks ago. Compare what the diary says with the eCRF, the vendor’s device links and the central lab. Mark each row: the records agree, the site must correct the eCRF, or the vendor must correct its data. Diary data are never changed to match the eCRF.">
      <Table head={['Participant', 'Diary or external data', 'eCRF', 'Your decision']} rows={rows.map((r) => [<span className="font-mono">{r.subj}</span>, r.diary, r.other,
        <Select aria-label={`Decision for ${r.id}`} className="w-48 text-xs" value={marks[r.id] ?? ''} onChange={(e) => act((pp) => markRecon(pp, r.id, e.target.value as 'match' | 'site' | 'vendor'))} options={[{ value: '', label: 'Choose…' }, { value: 'match', label: 'Records agree' }, { value: 'site', label: 'Discrepancy: site' }, { value: 'vendor', label: 'Discrepancy: vendor' }]} />])}
        empty="Nothing to reconcile yet: the worksheet fills as participants finish their second diary." />
      <p className="text-[11px] text-lab-text-muted">{Object.keys(marks).length} of {rows.length} rows marked.</p>
    </Panel>
  )
}

function Imm() {
  const { p } = useStore()
  const rows = immRows(p)
  const miss = missingSamples(p)
  return (
    <>
      <Panel title="Central lab: neutralising antibody titres" sub="Results arrive about 14 days after collection. The lower limit of quantification is a titre of 10. Titres are shown here for data review only: the study is blinded, so summaries by group are not produced by data management.">
        <Table head={['Participant', 'Visit', 'Tube', 'Collected', 'Reported', 'Titre', 'Flags']} rows={rows.map((r) => [<span className="font-mono">{r.subj}</span>, r.visit, <span className="font-mono">{r.tube}</span>, r.collected, r.reported, r.titre || '—', r.flags.length ? <ul className="text-[11px] text-lab-amber">{r.flags.map((f) => <li key={f}>{f}</li>)}</ul> : <Pill tone="green">ok</Pill>])} empty="No results yet." />
      </Panel>
      <Panel title="Samples recorded as not taken"><p className="text-sm">{miss.length ? miss.map((fk) => fk.split('|').slice(0, 2).join(' ')).join(', ') : 'None.'} A missing sample is not reconciled away: it stays missing and is explained in the data review.</p></Panel>
    </>
  )
}

function Grading() {
  const [mm, setMm] = useState('51')
  const [t, setT] = useState('38.5')
  return (
    <Panel title="Grading scale" sub="FDA guidance, Toxicity Grading Scale for Healthy Adult and Adolescent Volunteers Enrolled in Preventive Vaccine Clinical Trials (September 2007), chosen by the protocol. Diary values are graded by the system; data management checks the derivation at the edges.">
      <Table head={['Reaction', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']} rows={[
        ['Redness, swelling', '25 to 50 mm', '51 to 100 mm', 'more than 100 mm', 'necrosis (site assessment)'],
        ['Fever (oral)', '38.0 to 38.4 °C', '38.5 to 38.9 °C', '39.0 to 40.0 °C', 'more than 40.0 °C'],
        ['Pain, headache, fatigue, muscle and joint pain, chills, nausea, diarrhoea', 'does not interfere with activity', 'some interference', 'prevents daily activity', 'emergency room visit or hospitalisation (site assessment)'],
      ]} />
      <div className="flex flex-wrap gap-4 items-end text-sm">
        <label className="text-xs">Diameter (mm)<input aria-label="Diameter in mm" className={ic('w-24 font-mono')} value={mm} onChange={(e) => setMm(e.target.value)} /></label><span>→ {GRADE_WORD[gradeMm(Number(mm))]}</span>
        <label className="text-xs">Temperature (°C)<input aria-label="Temperature in °C" className={ic('w-24 font-mono')} value={t} onChange={(e) => setT(e.target.value)} /></label><span>→ {GRADE_WORD[gradeTemp(Number(t))]}</span>
      </div>
      <p className="text-[11px] text-lab-text-muted">Redness and swelling under 25 mm are not graded. A temperature is rounded to one decimal before grading. Grade 4 is never derived from the diary alone: the site confirms an emergency visit or hospitalisation.</p>
    </Panel>
  )
}
