import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { codingStats, codeTerm, codingQuery, approveCoding, describe, smd, upgradeImpact, applyUpgrade, reviewHierarchy, removeSynonym } from '../domain/coding'
import { searchMed, path, medStats, SMD, V11_CHANGES, type Term } from '../domain/dictmed'
import { searchDrug, drugById, atcPath, DRUGS, ATC_CLASSES, SDD_VERSION } from '../domain/dictdrug'
import { me, value, VISIT_NAME } from '../domain/project'
import { parseKey, type CodingRecord } from '../domain/types'
import { scoreQuery } from '../domain/queries'
import { Panel, Pill, Btn, Table, Tabs, Select, TextArea, SignBox, Stat, inputCls, fmtUtc } from './ui'
import { QualityMeter } from './Queries'

type T = 'work' | 'dict' | 'drug' | 'syn' | 'upgrade'
export default function Coding() {
  const { p } = useStore()
  const [t, setT] = useState<T>('work')
  const s = codingStats(p)
  return (
    <div className="space-y-4">
      <Panel title="Medical coding" sub={`Adverse events and medical history to the Study Medical Dictionary v${p.smdVersion}; medications to ${SDD_VERSION}. Both dictionaries are fictional, with the structures of MedDRA and WHODrug; no licensed terms are used.`}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <Stat label="Terms" value={s.total} /><Stat label="Uncoded" value={s.uncoded} tone="amber" /><Stat label="Coded" value={s.coded} tone="blue" />
          <Stat label="In query" value={s.query} tone="red" /><Stat label="Approved" value={s.approved} tone="green" /><Stat label="Auto or synonym" value={s.auto} tone="purple" />
        </div>
        <p className="text-xs text-lab-text-muted">Conventions (from ICH’s MedDRA Term Selection: Points to Consider, applied to this dictionary): code the most specific lowest-level term; prefer a diagnosis to its signs and symptoms; record death as an outcome, not an event; never code two events as one, query them to be split; query a verbatim that is ambiguous. Codes are verbatim-driven: never change the site’s words to make a match.</p>
      </Panel>
      <Tabs value={t} onChange={setT} tabs={[{ id: 'work', label: 'Worklist' }, { id: 'dict', label: 'Medical dictionary' }, { id: 'drug', label: 'Drug dictionary' }, { id: 'syn', label: `Synonym list (${Object.keys(p.synonyms).length})` }, { id: 'upgrade', label: 'Version upgrade' }]} />
      {t === 'work' && <Worklist />}
      {t === 'dict' && <MedBrowser />}
      {t === 'drug' && <DrugBrowser />}
      {t === 'syn' && <Synonyms />}
      {t === 'upgrade' && <Upgrade />}
    </div>
  )
}

const TONE = { uncoded: 'amber', coded: 'blue', query: 'red', approved: 'green' } as const

function Worklist() {
  const { p, tick, act } = useStore()
  const [status, setStatus] = useState('todo')
  const [form, setForm] = useState('all')
  const [sel, setSel] = useState<string | null>(null)
  const u = me(p)
  const list = useMemo(() => Object.values(p.coding).filter((r) => (status === 'all' || (status === 'todo' ? r.status === 'uncoded' || r.review : status === 'review' ? !!r.review : r.status === status)) && (form === 'all' || parseKey(r.key).form === form)).sort((a, b) => a.verbatim.localeCompare(b.verbatim)), [tick, status, form])
  const coded = Object.values(p.coding).filter((r) => r.status === 'coded' && !r.review)
  const r = sel ? p.coding[sel] : undefined
  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <Panel title={`${list.length} terms`} right={<div className="flex gap-2"><Select aria-label="Status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'todo', label: 'To code' }, { value: 'review', label: 'Hierarchy review' }, { value: 'query', label: 'In query' }, { value: 'coded', label: 'Coded' }, { value: 'approved', label: 'Approved' }, { value: 'all', label: 'All' }]} /><Select aria-label="Form" className="w-36" value={form} onChange={(e) => setForm(e.target.value)} options={[{ value: 'all', label: 'All forms' }, { value: 'AE', label: 'Adverse events' }, { value: 'MH', label: 'Medical history' }, { value: 'CM', label: 'Medications' }]} /></div>}>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table head={['Verbatim', 'Form', 'Subject', 'Status', 'Coded as', 'How']} rows={list.slice(0, 300).map((x) => {
            const k = parseKey(x.key)
            return [<button className={`text-left ${sel === x.key ? 'text-lab-fda' : ''}`} onClick={() => setSel(x.key)}>{x.verbatim}</button>, k.form, k.subj, <span className="flex gap-1"><Pill tone={TONE[x.status]}>{x.status}</Pill>{x.review && <Pill tone="purple">review</Pill>}</span>, <span className="text-[11px] text-lab-text-muted">{x.code ? (x.dict === 'SMD' ? path(smd(p), x.code).slice(-2).map((t) => t.name).join(' › ') : drugById.get(x.code)?.name + (x.atc ? ` · ${x.atc}` : '')) : ''}</span>, x.method ?? '']
          })} empty="Nothing here. Go live and advance the clock: terms arrive as sites enter AEs, medical history and medications." />
        </div>
      </Panel>
      {r ? <CodePanel key={r.key + r.status + r.code} r={r} /> : <Panel title="Select a term"><p className="text-sm text-lab-text-muted">Pick a term to code it, query it or see its history. Switch to Tomás Ibarra (medical coder) to code.</p></Panel>}
      {u.role === 'dmlead' && coded.length > 0 && (
        <Panel title={`Coding review and approval (${coded.length} coded, not yet approved)`} sub="The coding reviewer checks each coded term, then approves the batch with an electronic signature." className="xl:col-span-2">
          <Table head={['Verbatim', 'Coded as', 'By']} rows={coded.slice(0, 50).map((x) => [x.verbatim, <span className="text-[11px]">{describe(p, x)}</span>, x.codedBy ?? ''])} />
          <SignBox meaning="Coding reviewed and approved" what={`${coded.length} coded terms`} roles={['dmlead']} label="Approve coding" onSigned={(s) => act((pp) => approveCoding(pp, coded.map((x) => x.key), s))} />
        </Panel>
      )}
    </div>
  )
}

function CodePanel({ r }: { r: CodingRecord }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const k = parseKey(r.key)
  const [q, setQ] = useState(r.verbatim.replace(/[^A-Za-z -]/g, ' ').split(/\s+/).filter((w) => w.length > 3)[0] ?? r.verbatim)
  const [drug, setDrug] = useState<string | null>(null)
  const [qtext, setQtext] = useState('')
  const u = me(p)
  const ind = k.form === 'CM' ? value(p, r.key.replace('|CMTRT', '|CMINDC')) : ''
  const results = r.dict === 'SMD' ? searchMed(smd(p), q) : searchDrug(q)
  const coder = u.role === 'coder'
  const sc = scoreQuery(qtext, [r.verbatim.split(' ')[0]])
  return (
    <Panel title={`"${r.verbatim}"`} sub={`${k.subj} · ${VISIT_NAME[k.visit]} · ${k.form}${k.visit === 'LOG' ? ` #${k.inst}` : ''}${ind ? ` · indication: ${ind}` : ''}`} right={<Pill tone={TONE[r.status]}>{r.status}</Pill>}>
      {r.code && <p className="text-xs"><span className="text-lab-text-muted">Coded as </span>{describe(p, r)}</p>}
      {r.previous && <p className="text-[11px] text-lab-text-muted">Previously {r.previous.code} (v{r.previous.version}): {r.previous.reason}</p>}
      {r.review && coder && <div className="flex gap-2 items-center"><Pill tone="purple">Hierarchy changed in v1.1</Pill><Btn tone="purple" onClick={() => act((pp) => reviewHierarchy(pp, r.key))}>Reviewed: keep the code</Btn></div>}
      {r.status === 'query' && <p className="text-xs text-lab-amber">In query {r.queryId}. <button className="text-lab-fda" onClick={() => go('queries', r.queryId)}>Open the query →</button></p>}
      {coder && r.status !== 'query' && (
        <div className="space-y-2">
          <input aria-label="Search the dictionary" className={inputCls} value={q} onChange={(e) => { setQ(e.target.value); setDrug(null) }} placeholder={r.dict === 'SMD' ? 'Search lowest-level terms' : 'Search drug names and ingredients'} />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {r.dict === 'SMD' ? (results as Term[]).map((t) => {
              const pth = path(smd(p), t.code)
              return <div key={t.code} className="flex items-start gap-2 rounded border border-lab-line p-1.5">
                <div className="flex-1 text-xs"><p><b>{t.name}</b> <span className="font-mono text-[10px] text-lab-text-muted">{t.code}</span> {!t.current && <Pill tone="red">not current</Pill>}</p><p className="text-[11px] text-lab-text-muted">{pth.slice(0, 4).map((x) => x.name).join(' › ')}</p></div>
                <Btn tone="blue" className="py-0.5" disabled={!t.current} onClick={() => act((pp) => codeTerm(pp, r.key, t.code))}>Code</Btn>
              </div>
            }) : (results as typeof DRUGS).map((d) => (
              <div key={d.id} className={`rounded border p-1.5 ${drug === d.id ? 'border-lab-fda' : 'border-lab-line'}`}>
                <div className="flex items-start gap-2"><div className="flex-1 text-xs"><p><b>{d.name}</b> <span className="font-mono text-[10px] text-lab-text-muted">{d.id}</span> {d.generic ? <Pill>generic</Pill> : <Pill>trade name</Pill>}</p><p className="text-[11px] text-lab-text-muted">{d.ingredients.join(' + ')} · {d.atc.length} class{d.atc.length > 1 ? 'es' : ''}</p></div><Btn tone="blue" className="py-0.5" onClick={() => setDrug(d.id)}>Choose</Btn></div>
                {drug === d.id && <div className="mt-1 space-y-1">{d.atc.map((a) => <div key={a} className="flex items-center gap-2 text-[11px]"><span className="flex-1">{atcPath(a).map((x) => `${x.code} ${x.name}`).join(' › ')}</span><Btn tone="green" className="py-0.5" onClick={() => act((pp) => codeTerm(pp, r.key, d.id, a))}>Code with this class</Btn></div>)}</div>}
              </div>
            ))}
            {q.trim().length >= 2 && results.length === 0 && <p className="text-xs text-lab-text-muted">No match. Try another word, or query the site.</p>}
          </div>
          <details className="rounded border border-lab-line p-2">
            <summary className="text-xs cursor-pointer">Query the site about this verbatim</summary>
            <div className="space-y-2 mt-2">
              <TextArea aria-label="Coding query text" value={qtext} onChange={(e) => setQtext(e.target.value)} placeholder={`e.g. The term "${r.verbatim}" may describe more than one event. Please clarify the event or record each event separately?`} />
              {qtext && <QualityMeter score={sc.score} rules={sc.rules} />}
              <Btn tone="amber" disabled={!qtext.trim()} onClick={() => act((pp) => codingQuery(pp, r.key, qtext))}>Raise coding query</Btn>
            </div>
          </details>
        </div>
      )}
      {!coder && <p className="text-xs text-lab-text-muted">Switch to the medical coder to code or query this term.</p>}
      <Table head={['When (UTC)', 'Who', 'What', 'Detail']} rows={r.history.slice().reverse().map((h) => [fmtUtc(h.utc), h.userId, h.action, <span className="text-[11px]">{h.detail}</span>])} />
    </Panel>
  )
}

function MedBrowser() {
  const { p } = useStore()
  const d = smd(p)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const kids = (code?: string) => [...d.terms.values()].filter((t) => t.parent === code && (code || t.level === 'SOC')).sort((a, b) => a.name.localeCompare(b.name))
  const st = medStats(d)
  const Node = ({ t, depth }: { t: Term; depth: number }) => {
    const isOpen = open.has(t.code), ks = t.level === 'LLT' ? [] : kids(t.code)
    return <li>
      <button className="text-left text-xs py-0.5 hover:text-lab-fda" style={{ paddingLeft: depth * 14 }} onClick={() => { const n = new Set(open); if (isOpen) n.delete(t.code); else n.add(t.code); setOpen(n) }}>
        {ks.length ? (isOpen ? '▾ ' : '▸ ') : '· '}<span className="font-mono text-[10px] text-lab-text-muted">{t.level} {t.code}</span> {t.name} {!t.current && <Pill tone="red">not current</Pill>}
      </button>
      {isOpen && <ul>{ks.map((c) => <Node key={c.code} t={c} depth={depth + 1} />)}</ul>}
    </li>
  }
  return (
    <Panel title={`Study Medical Dictionary v${d.version} (fictional)`} sub={`Released ${d.released}. ${st.SOC} system classes, ${st.HLGT} groups, ${st.HLT} clusters, ${st.PT} preferred terms, ${st.LLT} lowest-level terms. Five levels, like MedDRA: system organ class, high-level group term, high-level term, preferred term, lowest-level term.`}>
      <ul>{kids(undefined).map((t) => <Node key={t.code} t={t} depth={0} />)}</ul>
    </Panel>
  )
}

function DrugBrowser() {
  const [q, setQ] = useState('')
  const list = q ? searchDrug(q, 200) : DRUGS
  return (
    <div className="space-y-4">
      <Panel title={SDD_VERSION} sub={`${DRUGS.length} records. Each record has a drug record number, sequence number 1 (active moiety or salt) and sequence number 2 (the name), as in the WHODrug B3 format, plus one or more four-level classes shaped like ATC. Classification codes use letters the real ATC does not, so they cannot be confused.`}>
        <input aria-label="Search drugs" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ingredient" />
        <div className="max-h-[55vh] overflow-y-auto"><Table head={['Record', 'Name', 'Type', 'Ingredients', 'Classes']} rows={list.map((d) => [<span className="font-mono text-[11px]">{d.id}</span>, d.name, d.generic ? 'generic' : 'trade name', d.ingredients.join(' + '), d.atc.map((a) => `${a} ${atcPath(a).pop()?.name}`).join('; ')])} /></div>
      </Panel>
      <Panel title="Classification (four levels)"><div className="grid sm:grid-cols-2 gap-x-6 text-xs">{ATC_CLASSES.map((a) => <p key={a.code} style={{ paddingLeft: (a.level - 1) * 12 }}><span className="font-mono text-lab-text-muted">{a.code}</span> {a.name}</p>)}</div></Panel>
    </div>
  )
}

function Synonyms() {
  const { p, act } = useStore()
  return (
    <Panel title="Study synonym list" sub="Every manual coding decision is kept here, so the same verbatim codes automatically next time. Remove an entry that was a mistake; it then stops auto-coding.">
      <Table head={['Verbatim', 'Dictionary', 'Code', 'Class', 'By', 'When', '']} rows={Object.entries(p.synonyms).map(([id, s]) => [id.split(':').slice(1).join(':'), s.dict, s.dict === 'SMD' ? `${smd(p).terms.get(s.code)?.name ?? s.code}` : drugById.get(s.code)?.name ?? s.code, s.atc ?? '', s.userId, fmtUtc(s.utc), me(p).role === 'coder' ? <Btn tone="red" className="py-0.5" onClick={() => act((pp) => removeSynonym(pp, id))}>Remove</Btn> : ''])} empty="No manual coding decisions yet." />
    </Panel>
  )
}

function Upgrade() {
  const { p, act } = useStore()
  const [note, setNote] = useState('')
  if (p.smdVersion === '1.1') {
    const rec = Object.values(p.coding).filter((r) => r.history.some((h) => h.action === 'upgrade: needs recoding'))
    const rev = Object.values(p.coding).filter((r) => r.history.some((h) => h.action === 'upgrade: hierarchy changed'))
    return (
      <Panel title="Upgraded to v1.1" sub={`Applied ${fmtUtc(p.smdUpgrade?.utc)} UTC by ${p.smdUpgrade?.userId}. Impact note: ${p.smdUpgrade?.note}`}>
        <Table head={['Verbatim', 'Change', 'Now']} rows={[...rec.map((r) => [r.verbatim, 'Retired term: recode', r.status === 'uncoded' ? <Pill tone="amber">to recode</Pill> : <Pill tone="green">{describe(p, r).split(' › ').pop()}</Pill>]), ...rev.map((r) => [r.verbatim, 'Hierarchy changed: review', r.review ? <Pill tone="purple">to review</Pill> : <Pill tone="green">reviewed</Pill>])]} />
        <p className="text-xs text-lab-text-muted">Recode and review from the Worklist (filters “To code” and “Hierarchy review”).</p>
      </Panel>
    )
  }
  const impact = upgradeImpact(p)
  const n = (k: string) => impact.filter((i) => i.kind === k).length
  return (
    <div className="space-y-4">
      <Panel title={`Version 1.1 is available (released ${SMD['1.1'].released})`} sub="Dictionary versions are controlled: the DMP names the version in use, and an upgrade follows an impact assessment. Review what changes, then apply.">
        <Table head={['Change in 1.1', 'Detail']} rows={V11_CHANGES.map((c) => [c.kind === 'retire' ? `Retire LLT "${c.llt}"` : c.kind === 'add' ? `Add LLT "${c.llt}" under "${c.pt}"` : c.kind === 'move-pt' ? `Move PT "${c.pt}"` : `Demote PT "${c.pt}" to an LLT under "${c.toPt}"`, c.note])} />
      </Panel>
      <Panel title="Impact on this study" sub={`${impact.length} coded medical terms: ${n('recode')} must be recoded, ${n('hierarchy')} keep their code but move in the hierarchy, ${n('none')} are unaffected.`}>
        <Table head={['Verbatim', 'Impact', 'Now (v1.0)', 'In v1.1']} rows={impact.filter((i) => i.kind !== 'none').map((i) => [i.verbatim, i.kind === 'recode' ? <Pill tone="red">recode</Pill> : <Pill tone="purple">hierarchy</Pill>, <span className="text-[11px]">{i.from}</span>, <span className="text-[11px]">{i.to}</span>])} empty="No coded term is affected." />
        <TextArea aria-label="Impact note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Document the impact: how many terms are recoded, how many move, effect on analyses already run, who reviewed." />
        <SignBox meaning="Dictionary upgrade impact assessed and approved" what="SMD upgrade 1.0 → 1.1" roles={['dmlead']} label="Apply the upgrade" onSigned={(s) => act((pp) => applyUpgrade(pp, s, note.trim()))} />
      </Panel>
    </div>
  )
}
