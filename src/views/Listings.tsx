import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { formsOfSubject, type FormData } from '../domain/engine'
import { me } from '../domain/project'
import { VISITS, SITES } from '../domain/study'
import { isActive } from '../domain/queries'
import { daysBetween } from '../domain/util'
import { Panel, Pill, Btn, Table, Tabs, Select } from './ui'
import { RaiseModal } from './Casebook'

type L = 'ae' | 'ae-dup' | 'cm-ae' | 'vs-trend' | 'windows' | 'lab' | 'cm'
const LISTINGS: { id: L; label: string; sub: string }[] = [
  { id: 'ae', label: 'Adverse events', sub: 'All AEs with seriousness, outcome and causality. Look for missing or inconsistent fields the checks cannot judge.' },
  { id: 'ae-dup', label: 'Possible duplicate AEs', sub: 'AEs of the same subject with the same verbatim term and start date.' },
  { id: 'cm-ae', label: 'CM on treatment vs AE/MH', sub: 'Medications started on or after randomisation whose indication matches no adverse event or medical history: was an AE missed?' },
  { id: 'vs-trend', label: 'Vital-sign trends', sub: 'Blood pressure across visits. Identical readings at three or more visits are unusual and may mean copied values.' },
  { id: 'windows', label: 'Visit windows', sub: 'Study day of each visit against its protocol window.' },
  { id: 'lab', label: 'Local lab with units', sub: 'Values with the unit recorded. A value that is plausible in one unit and not the other is a unit error.' },
  { id: 'cm', label: 'Concomitant medications', sub: 'All medications with indication, dose and dates.' },
]

export default function Listings() {
  const { p, tick } = useStore()
  const [l, setL] = useState<L>('ae')
  const [site, setSite] = useState('all')
  const [raise, setRaise] = useState<{ key: string; label: string } | null>(null)
  const { go } = useNav()
  const canQuery = ['dm', 'dmlead', 'cra', 'coder'].includes(me(p).role)
  const subjects = useMemo(() => [...new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))].sort().filter((s) => site === 'all' || s.startsWith(site)), [tick, site])
  const data = useMemo(() => subjects.map((s) => ({ s, forms: formsOfSubject(p, s) })), [subjects, tick])
  const qBtn = (key: string, label: string) => {
    const act = p.queries.filter((q) => q.key === key && isActive(q))
    return <div className="flex gap-1">{act.map((q) => <button key={q.id} onClick={() => go('queries', q.id)}><Pill tone="amber">{q.id}</Pill></button>)}{canQuery && <Btn tone="amber" className="py-0.5" onClick={() => setRaise({ key, label })}>Query</Btn>}<Btn tone="grey" className="py-0.5" onClick={() => go('casebook', key)}>Open</Btn></div>
  }
  const k = (f: FormData, field: string) => `${f.subj}|${f.visit}|${f.form}|${f.inst}|${field}`
  let head: string[] = [], rows: React.ReactNode[][] = []
  if (l === 'ae' || l === 'ae-dup') {
    const all = data.flatMap(({ forms }) => forms.filter((f) => f.form === 'AE'))
    const dupKey = (f: FormData) => `${f.subj}|${(f.values.AETERM ?? '').toLowerCase()}|${f.values.AESTDAT}`
    const counts = new Map<string, number>(); all.forEach((f) => counts.set(dupKey(f), (counts.get(dupKey(f)) ?? 0) + 1))
    const list = l === 'ae' ? all : all.filter((f) => (counts.get(dupKey(f)) ?? 0) > 1)
    head = ['Subject', '#', 'Verbatim term', 'Start', 'End', 'Ongoing', 'Serious', 'Severity', 'Relationship', 'Action', 'Outcome', '']
    rows = list.map((f) => [f.subj, f.inst, f.values.AETERM, f.values.AESTDAT, f.values.AEENDAT, f.values.AEONGO, f.values.AESER === 'Y' ? <Pill tone="red">Y</Pill> : f.values.AESER, f.values.AESEV, f.values.AEREL, f.values.AEACN, f.values.AEOUT, qBtn(k(f, 'AETERM'), 'Adverse event')])
  } else if (l === 'cm-ae' || l === 'cm') {
    const rowsCm = data.flatMap(({ forms }) => {
      const rand = forms.find((f) => f.visit === 'D1' && f.form === 'SV')?.values.VISDAT ?? ''
      const terms = forms.filter((f) => f.form === 'AE' || f.form === 'MH').map((f) => (f.values.AETERM ?? f.values.MHTERM ?? '').toLowerCase())
      return forms.filter((f) => f.form === 'CM').map((f) => {
        const ind = (f.values.CMINDC ?? '').toLowerCase()
        const onTx = !!rand && (f.values.CMSTDAT ?? '') >= rand
        const matched = terms.some((t) => t && (t.includes(ind) || ind.includes(t)))
        return { f, onTx, matched }
      })
    })
    const list = l === 'cm' ? rowsCm : rowsCm.filter((r) => r.onTx && !r.matched)
    head = ['Subject', '#', 'Medication', 'Indication', 'Dose', 'Route', 'Start', 'End', 'On treatment', l === 'cm-ae' ? 'Matching AE/MH' : '', '']
    rows = list.map(({ f, onTx, matched }) => [f.subj, f.inst, f.values.CMTRT, f.values.CMINDC, `${f.values.CMDSTXT} ${f.values.CMDOSU}`, f.values.CMROUTE, f.values.CMSTDAT, f.values.CMENDAT, onTx ? 'Yes' : 'No', l === 'cm-ae' ? (matched ? 'Yes' : <Pill tone="amber">None</Pill>) : '', qBtn(k(f, 'CMINDC'), 'Indication')])
  } else if (l === 'vs-trend') {
    head = ['Subject', ...VISITS.map((v) => v.id), 'Flag', '']
    rows = data.map(({ s, forms }) => {
      const vs = VISITS.map((v) => forms.find((f) => f.visit === v.id && f.form === 'VS'))
      const bp = vs.map((f) => (f ? `${f.values.SYSBP}/${f.values.DIABP}` : ''))
      const post = bp.slice(1).filter(Boolean)
      const same = post.length >= 3 && post.some((x) => post.filter((y) => y === x).length >= 3)
      const target = vs.slice(1).find((f) => f && same && `${f.values.SYSBP}/${f.values.DIABP}` === post.find((x) => post.filter((y) => y === x).length >= 3))
      return [s, ...bp.map((b) => <span className="font-mono">{b || '–'}</span>), same ? <Pill tone="amber">Identical ×3+</Pill> : '', target ? qBtn(k(target, 'SYSBP'), 'Systolic BP') : '']
    }).filter((r) => l === 'vs-trend')
  } else if (l === 'windows') {
    head = ['Subject', 'Visit', 'Date', 'Study day', 'Window', 'Status', '']
    rows = data.flatMap(({ forms }) => {
      const rand = forms.find((f) => f.visit === 'D1' && f.form === 'SV')?.values.VISDAT
      return forms.filter((f) => f.form === 'SV' && f.visit !== 'SCR' && f.visit !== 'D1').map((f) => {
        const v = VISITS.find((x) => x.id === f.visit)!
        const d = f.values.VISDAT
        const day = rand && d ? daysBetween(rand, d) + 1 : NaN
        const out = !Number.isNaN(day) && (day < v.lo || day > v.hi)
        return [f.subj, v.name, f.values.VISOCCUR === 'N' ? 'Not done' : d, Number.isNaN(day) ? '–' : day, `${v.lo} to ${v.hi}`, out ? <Pill tone="red">Out of window</Pill> : f.values.VISOCCUR === 'N' ? <Pill tone="amber">Missed</Pill> : <Pill tone="green">OK</Pill>, qBtn(k(f, 'VISDAT'), 'Visit date')]
      })
    })
  } else if (l === 'lab') {
    head = ['Subject', 'Visit', 'Date', 'Glucose', 'Unit', 'K', 'Creatinine', 'ALT', 'Flag', '']
    rows = data.flatMap(({ forms }) => forms.filter((f) => f.form === 'LB').map((f) => {
      const g = Number(f.values.GLUC), u = f.values.GLUCU
      const flag = u === 'mmol/L' && g > 30 ? 'Looks like mg/dL' : u === 'mg/dL' && g < 36 && g > 0 ? 'Looks like mmol/L' : !u ? 'No unit' : ''
      return [f.subj, f.visit, f.values.LBDAT, f.values.GLUC, u, f.values.K, f.values.CREAT, f.values.ALT, flag ? <Pill tone="amber">{flag}</Pill> : '', qBtn(k(f, 'GLUC'), 'Fasting glucose')]
    }))
  }
  const def = LISTINGS.find((x) => x.id === l)!
  return (
    <div className="space-y-4">
      <Tabs value={l} onChange={setL} tabs={LISTINGS.map((x) => ({ id: x.id, label: x.label }))} />
      <Panel title={def.label} sub={def.sub} right={<Select aria-label="Site" className="w-40" value={site} onChange={(e) => setSite(e.target.value)} options={[{ value: 'all', label: 'All sites' }, ...SITES.map((s) => ({ value: s.id, label: `Site ${s.id}` }))]} />}>
        {!subjects.length ? <p className="text-sm text-lab-text-muted">No data yet. Go live and advance the clock.</p> : <Table head={head} rows={rows} empty="No rows. Nothing flagged in this listing." />}
        {!canQuery && <p className="text-[11px] text-lab-text-muted">Switch to data management, the CRA or the coder to raise queries from a listing.</p>}
      </Panel>
      {raise && <RaiseModal itemKey={raise.key} label={raise.label} onClose={() => setRaise(null)} />}
    </div>
  )
}
