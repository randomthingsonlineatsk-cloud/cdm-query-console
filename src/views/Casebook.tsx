import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { SITES, VISITS, FORMS, CODELISTS, LOG_FORMS, sdtmTarget, type Field } from '../domain/study'
import { fieldGuide } from '../domain/dmp'
import { value, editValue, enterForm, me, raiseManual, runChecks, nowUtc, VISIT_NAME } from '../domain/project'
import { isActive, scoreQuery } from '../domain/queries'
import { ROLE_LABEL } from '../domain/types'
import { Panel, Pill, Btn, Table, Modal, TextArea, Select, inputCls, fmtUtc } from './ui'
import { QualityMeter } from './Queries'

export default function Casebook() {
  const { p } = useStore()
  const nav = useNav()
  const subjects = useMemo(() => [...new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))].sort(), [p, Object.keys(p.forms).length])
  const [subj, setSubj] = useState<string>(nav.arg?.slice(0, 7) ?? subjects[0] ?? '')
  const [fk, setFk] = useState<string | null>(nav.arg && nav.arg.split('|').length >= 4 ? nav.arg.split('|').slice(0, 4).join('|') : null)
  const [annot, setAnnot] = useState(false)
  const [guide, setGuide] = useState(false)
  if (!subjects.length) return <Panel title="Casebook" sub="No data yet.">{p.live ? <p className="text-sm">Advance the study clock: the first subject is screened on 2 March 2026.</p> : <p className="text-sm">The database is not live. Complete start-up and go live; sites then enter data as the study clock moves.</p>}</Panel>
  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-4">
      <Panel title="Subjects" className="lg:max-h-[75vh] lg:overflow-y-auto">
        {SITES.map((s) => {
          const list = subjects.filter((x) => x.startsWith(s.id))
          if (!list.length) return null
          return (
            <div key={s.id}>
              <p className="font-mono text-[10px] uppercase text-lab-text-muted mt-1">Site {s.id} · {s.country}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {list.map((x) => {
                  const q = p.queries.filter((y) => isActive(y) && y.key.startsWith(x)).length
                  return <button key={x} onClick={() => { setSubj(x); setFk(null) }} className={`font-mono text-[11px] rounded border px-1.5 py-0.5 ${subj === x ? 'border-lab-fda text-lab-fda' : 'border-lab-line text-lab-text'}`}>{x}{q ? <span className="text-lab-amber"> ·{q}</span> : null}</button>
                })}
              </div>
            </div>
          )
        })}
      </Panel>
      <div className="space-y-4">
        {subj && <SubjectGrid subj={subj} fk={fk} setFk={setFk} />}
        {fk && <FormPanel fk={fk} annot={annot} setAnnot={setAnnot} guide={guide} setGuide={setGuide} />}
      </div>
    </div>
  )
}

function SubjectGrid({ subj, fk, setFk }: { subj: string; fk: string | null; setFk: (k: string) => void }) {
  const { p, act } = useStore()
  const u = me(p)
  const chip = (k: string, label: string) => {
    const f = p.forms[k]
    const q = p.queries.filter((y) => isActive(y) && y.key.startsWith(k + '|'))
    const tone = !f ? 'text-lab-text-muted border-dashed border-lab-line' : f.deleted ? 'line-through text-lab-text-muted border-lab-line' : q.some((y) => y.status === 'open') ? 'border-lab-amber text-lab-amber' : q.length ? 'border-lab-fda text-lab-fda' : 'border-lab-cdsco/60 text-lab-cdsco'
    return <button key={k} disabled={!f} onClick={() => setFk(k)} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${tone} ${fk === k ? 'ring-2 ring-lab-fda/60' : ''}`}>{label}{q.length ? ` ·${q.length}` : ''}</button>
  }
  const addLog = (form: string) => act((pp) => {
    if (u.role !== 'site') throw new Error('Switch to the site coordinator to add a record.')
    const inst = Math.max(0, ...Object.keys(pp.forms).filter((x) => x.startsWith(`${subj}|LOG|${form}|`)).map((x) => Number(x.split('|')[3]))) + 1
    enterForm(pp, subj, 'LOG', form, inst, {}, u, nowUtc(pp))
    runChecks(pp, [subj])
    setFk(`${subj}|LOG|${form}|${inst}`)
  })
  return (
    <Panel title={`Subject ${subj}`} sub={`Site ${subj.slice(0, 3)} · ${SITES.find((s) => s.id === subj.slice(0, 3))?.name}`} right={<span className="text-[11px] text-lab-text-muted">Green: clean · amber: open query · blue: answered · dashed: not entered</span>}>
      <Table head={['Visit', 'Date', 'Forms']} rows={VISITS.map((v) => {
        const d = value(p, `${subj}|${v.id}|SV|1|VISDAT`)
        const occ = value(p, `${subj}|${v.id}|SV|1|VISOCCUR`)
        return [v.name, occ === 'N' ? <Pill tone="amber">Not done</Pill> : d || '–', <div className="flex flex-wrap gap-1">{[...v.forms, ...(p.forms[`${subj}|${v.id}|EOS|1`] && !v.forms.includes('EOS') ? ['EOS'] : [])].map((f) => chip(`${subj}|${v.id}|${f}|1`, FORMS[f].name))}{v.id === 'SCR' && Object.keys(p.forms).filter((k) => k.startsWith(`${subj}|SCR|MH|`)).sort().map((k) => chip(k, `MH #${k.split('|')[3]}`))}</div>]
      })} />
      {LOG_FORMS.map((form) => {
        const keys = Object.keys(p.forms).filter((k) => k.startsWith(`${subj}|LOG|${form}|`)).sort((a, b) => Number(a.split('|')[3]) - Number(b.split('|')[3]))
        return (
          <div key={form} className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[11px] text-lab-text-muted w-40">{FORMS[form].name}</span>
            {keys.length ? keys.map((k) => chip(k, `#${k.split('|')[3]} ${value(p, `${k}|${form === 'AE' ? 'AETERM' : 'CMTRT'}`) || '(blank)'}`)) : <span className="text-[11px] text-lab-text-muted">None recorded</span>}
            {u.role === 'site' && <Btn tone="grey" className="py-0.5" onClick={() => addLog(form)}>+ Add</Btn>}
          </div>
        )
      })}
    </Panel>
  )
}

const REASONS = ['Transcription error', 'Updated per source document', 'Query response', 'Data entered in the wrong field', 'New information received']

function FormPanel({ fk, annot, setAnnot, guide, setGuide }: { fk: string; annot: boolean; setAnnot: (b: boolean) => void; guide: boolean; setGuide: (b: boolean) => void }) {
  const { p } = useStore()
  const { go } = useNav()
  const [subj, visit, form, inst] = fk.split('|')
  const def = FORMS[form]
  const fs = p.forms[fk]
  const [edit, setEdit] = useState<Field | null>(null)
  const [raise, setRaise] = useState<Field | null>(null)
  const [hist, setHist] = useState<Field | null>(null)
  const u = me(p)
  const vals: Record<string, string> = { ...Object.fromEntries(def.fields.map((f) => [f.id, value(p, `${fk}|${f.id}`)])), __visit: visit }
  return (
    <Panel title={`${def.name}${def.repeating ? ` #${inst}` : ''} · ${VISIT_NAME[visit]}`} sub={`${subj} · CDASH domain ${def.domain} · entered ${fmtUtc(fs?.enteredUtc)} UTC by ${fs?.enteredBy}${fs?.deleted ? ` · DELETED: ${fs.deletedReason}` : ''}`}
      right={<div className="flex gap-3"><label className="flex items-center gap-1.5 text-xs text-lab-text-muted"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />Completion guidelines</label><label className="flex items-center gap-1.5 text-xs text-lab-text-muted"><input type="checkbox" checked={annot} onChange={(e) => setAnnot(e.target.checked)} />Annotated CRF</label></div>}>
      <div className="divide-y divide-lab-line/60">
        {def.fields.map((f) => {
          if (f.showIf && vals[f.showIf.field] !== f.showIf.equals && !vals[f.id]) return null
          const key = `${fk}|${f.id}`
          const qs = p.queries.filter((q) => q.key === key)
          const active = qs.filter(isActive)
          const item = p.items[key]
          const v = vals[f.id]
          const label = f.codelist ? CODELISTS[f.codelist].find((o) => o.value === v)?.label ?? v : v
          return (
            <div key={f.id} className="py-1.5 grid sm:grid-cols-[1fr_200px_auto] gap-2 items-center">
              <div>
                <p className="text-sm">{f.label}{f.required && <span className="text-lab-red"> *</span>}{f.unit && <span className="text-lab-text-muted"> ({f.unit})</span>}</p>
                {guide && (() => { const g = fieldGuide(form, f); return <p className="text-[11px] text-lab-text-muted">{g.text && <>{g.text} </>}<span className="font-mono text-[10px]">[{g.rules.join(' · ')}]</span></p> })()}
                {annot && <p className="font-mono text-[10px] text-lab-ema">{f.id} → SDTM {sdtmTarget(form, f.id)}{f.codelist ? ` · codelist ${f.codelist}` : ''}{f.ctq ? ' · critical to quality' : ''}</p>}
              </div>
              <div className="font-mono text-sm">{v === '' ? <span className="text-lab-text-muted">blank</span> : label}{f.derived && <Pill className="ml-1">derived</Pill>}</div>
              <div className="flex flex-wrap gap-1 justify-end">
                {active.map((q) => <button key={q.id} onClick={() => go('queries', q.id)}><Pill tone={q.status === 'open' ? 'amber' : 'blue'}>{q.id} {q.status}</Pill></button>)}
                {(item?.versions.length ?? 0) > 1 && <Btn tone="grey" className="py-0.5" onClick={() => setHist(f)}>History ({item!.versions.length})</Btn>}
                {(item?.versions.length ?? 0) === 1 && <Btn tone="grey" className="py-0.5" onClick={() => setHist(f)}>History</Btn>}
                {(u.role === 'site' || u.role === 'pi') && !f.derived && !fs?.deleted && <Btn tone="blue" className="py-0.5" onClick={() => setEdit(f)}>Edit</Btn>}
                {['dm', 'dmlead', 'cra', 'coder'].includes(u.role) && !fs?.deleted && <Btn tone="amber" className="py-0.5" onClick={() => setRaise(f)}>Query</Btn>}
              </div>
            </div>
          )
        })}
      </div>
      {edit && <EditModal fk={fk} f={edit} onClose={() => setEdit(null)} />}
      {raise && <RaiseModal itemKey={`${fk}|${raise.id}`} label={raise.label} onClose={() => setRaise(null)} />}
      {hist && <HistoryModal itemKey={`${fk}|${hist.id}`} label={hist.label} onClose={() => setHist(null)} />}
      {annot && <p className="text-[11px] text-lab-ema">Annotated CRF: CDASH variables and their SDTM targets. Mapping practice belongs to the SDTM Mapping Trainer (planned).</p>}
      <p className="text-[11px] text-lab-text-muted">As {ROLE_LABEL[u.role]}: {u.role === 'site' ? 'you can edit values (with a reason for change) and answer queries.' : ['dm', 'dmlead', 'cra', 'coder'].includes(u.role) ? 'you can raise manual queries; data management never edits site data directly.' : 'read only.'}</p>
    </Panel>
  )
}

function EditModal({ fk, f, onClose }: { fk: string; f: Field; onClose: () => void }) {
  const { p, act } = useStore()
  const key = `${fk}|${f.id}`
  const [v, setV] = useState(value(p, key))
  const [reason, setReason] = useState(REASONS[0])
  const [other, setOther] = useState('')
  const first = !p.items[key] || p.items[key].versions.length === 0
  return (
    <Modal title={`Edit: ${f.label}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (act((pp) => editValue(pp, key, v.trim(), reason === 'Other' ? other : reason))) onClose() }}>
      {(() => { const g = fieldGuide(fk.split('|')[2], f); return <p className="text-xs text-lab-text-muted">{g.text && <>{g.text} </>}<span className="font-mono text-[10px]">[{g.rules.join(' · ')}]</span></p> })()}
      {f.codelist ? <Select aria-label={f.label} value={v} onChange={(e) => setV(e.target.value)} options={[{ value: '', label: '(blank)' }, ...CODELISTS[f.codelist]]} />
        : <input aria-label={f.label} className={inputCls} type={f.type === 'date' ? 'text' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} placeholder={f.type === 'date' ? 'YYYY-MM-DD' : ''} value={v} onChange={(e) => setV(e.target.value)} />}
      {!first && <>
        <p className="text-xs text-lab-text-muted">Reason for change (required; kept in the audit trail with the old value)</p>
        <Select aria-label="Reason for change" value={reason} onChange={(e) => setReason(e.target.value)} options={[...REASONS, 'Other'].map((r) => ({ value: r, label: r }))} />
        {reason === 'Other' && <input aria-label="Other reason" className={inputCls} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe the reason" />}
      </>}
      <div className="flex gap-2 justify-end"><Btn type="button" tone="grey" onClick={onClose}>Cancel</Btn><Btn type="submit" tone="solid">Save</Btn></div>
      </form>
      <p className="text-[10px] text-lab-text-muted">Enter saves · Escape cancels</p>
    </Modal>
  )
}

export function RaiseModal({ itemKey, label, onClose, preset = '' }: { itemKey: string; label: string; onClose: () => void; preset?: string }) {
  const { p, act } = useStore()
  const [text, setText] = useState(preset)
  const sc = scoreQuery(text, [label.split(' ')[0]])
  return (
    <Modal title={`Raise a manual query: ${label}`} onClose={onClose}>
      <p className="text-xs text-lab-text-muted font-mono">{itemKey.replaceAll('|', ' · ')} · current value: {value(p, itemKey) || 'blank'}</p>
      <TextArea aria-label="Query text" value={text} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim() && act((pp) => { raiseManual(pp, itemKey, text) })) onClose() }} onChange={(e) => setText(e.target.value)} placeholder="e.g. Weight at Week 12 is 187.4 kg; at screening it was 85.0 kg. Please verify the value and unit against the source." />
      <QualityMeter score={sc.score} rules={sc.rules} />
      <div className="flex gap-2 justify-end items-center"><span className="text-[10px] text-lab-text-muted mr-auto">Ctrl+Enter raises · Escape cancels</span><Btn tone="grey" onClick={onClose}>Cancel</Btn><Btn tone="solid" disabled={!text.trim()} onClick={() => { if (act((pp) => { raiseManual(pp, itemKey, text) })) onClose() }}>Raise query</Btn></div>
    </Modal>
  )
}

function HistoryModal({ itemKey, label, onClose }: { itemKey: string; label: string; onClose: () => void }) {
  const { p } = useStore()
  const it = p.items[itemKey]
  return (
    <Modal title={`Audit history: ${label}`} onClose={onClose} wide>
      <Table head={['#', 'Value', 'Old value', 'Who', 'Role', 'When (UTC)', 'Why']} rows={(it?.versions ?? []).map((v, i, a) => [i + 1, <span className="font-mono">{v.value || 'blank'}</span>, i ? <span className="font-mono text-lab-text-muted">{a[i - 1].value || 'blank'}</span> : '–', v.userId, v.role, fmtUtc(v.utc), v.reason])} />
      <p className="text-[11px] text-lab-text-muted">Versions are never overwritten. The first version is the original record (ALCOA+: original, attributable, contemporaneous).</p>
    </Modal>
  )
}
