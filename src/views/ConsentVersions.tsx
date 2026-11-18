// Consent versions from the Plain Language Lab: the edit check they drive, and the site-level
// reconciliation of every participant's signed version and date.
import { useState } from 'react'
import { useStore } from '../state'
import { ACTIVE, SITES } from '../domain/study'
import { readConsentVersions, previewConsent, applyConsent, versionCheck, defaultSiteMap, reconcile, approvalsOf, IMPLEMENTATION_DAYS, type ConsentVersionsFile, type SiteMap } from '../domain/consentVersions'
import { raiseManual } from '../domain/project'
import { latestRun } from '../domain/missions'
import { isActive } from '../domain/queries'
import { Panel, Table, Btn, Pill, Select, inputCls } from './ui'

const TONE = { ok: 'green', 'not-approved': 'red', 'before-approval': 'red', superseded: 'amber', 'no-committee': 'grey' } as const
const LABEL = { ok: 'OK', 'not-approved': 'not approved', 'before-approval': 'before approval', superseded: 'superseded', 'no-committee': 'no committee' } as const

export default function ConsentVersions() {
  const { p, act } = useStore()
  const [file, setFile] = useState<ConsentVersionsFile | null>(null), [err, setErr] = useState(''), [done, setDone] = useState('')
  const study = ACTIVE.id
  const held = p.consentVersions, c = versionCheck(p)
  const [map, setMap] = useState<SiteMap>({})
  const shown = file ?? held
  const effMap: SiteMap = file ? { ...defaultSiteMap(file), ...map } : { ...(p.consentSiteMap ?? {}), ...map }
  let preview: ReturnType<typeof previewConsent> | null = null, perr = ''
  if (file) { try { preview = previewConsent(p, file, study, effMap) } catch (e) { perr = (e as Error).message } }
  const open = (f: File) => { const r = new FileReader(); r.onload = () => { try { setFile(readConsentVersions(String(r.result))); setMap({}); setErr(''); setDone('') } catch (e) { setErr((e as Error).message); setFile(null) } }; r.readAsText(f) }
  return (
    <Panel title="Consent form versions" sub="Approved consent versions per ethics committee, from the Plain Language Lab (Versions and ethics). The superseded-version check expects the newest version every committee has approved; the site listing compares each participant with their own site’s committee."
      right={<label className="cursor-pointer rounded border border-lab-line px-2 py-1 text-xs font-mono">Open a consent-versions file<input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) open(f) }} /></label>}>
      {err && <p className="text-sm text-lab-red" role="alert">{err}</p>}
      {c && <p className="text-sm">Check <b>{c.id}</b> now: <code className="font-mono">{c.expr}</code>{held ? ` (from the file exported ${held.exportedUtc.slice(0, 10)})` : ' (as shipped)'}</p>}
      {shown && <SiteMapping f={shown} map={effMap} onChange={(site, com) => { setMap({ ...map, [site]: com }); if (!file) act((x) => { x.consentSiteMap = { ...(x.consentSiteMap ?? {}), [site]: com } }) }} />}
      {file && perr && <p className="text-sm text-lab-amber" role="alert">{perr}</p>}
      {file && preview && <div className="rounded border border-lab-line p-2 text-sm space-y-2">
        <p>{preview.from === preview.to ? `${preview.check} already expects ${preview.to}, the newest version every committee approved.` : `${preview.check} will expect ${preview.to}, the newest version every committee approved, instead of ${preview.from}. ${preview.flagged} recorded consent version${preview.flagged === 1 ? '' : 's'} would then fire on the next run of the checks.`} The site listing shows {preview.siteFindings} participant{preview.siteFindings === 1 ? '' : 's'} to review.</p>
        <Btn onClick={() => { act((x) => { applyConsent(x, file, study, effMap) }); setDone(`Imported. ${preview!.check} expects ${preview!.to}; the change is in the audit trail.`); setFile(null); setMap({}) }}>Import and update {preview.check}</Btn>
      </div>}
      {done && <p className="text-sm text-lab-cdsco">{done}</p>}
      {shown && <details className="text-sm"><summary className="cursor-pointer">Approvals in the file ({shown.versions.length})</summary>
        <Table head={['Document', 'Language', 'Version', 'Committee', 'Country', 'Approved']} rows={shown.versions.map((v) => [v.document, v.language, v.version, v.committee, v.country ?? '', v.approved])} /></details>}
      {held && !file && <SiteListing />}
    </Panel>
  )
}

function SiteMapping({ f, map, onChange }: { f: ConsentVersionsFile; map: SiteMap; onChange: (site: string, committee: string) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-2 gap-2 text-xs">
      {SITES.map((s) => <label key={s.id} className="flex flex-col gap-1"><span className="text-lab-text-muted">Site {s.id} · {s.name} ({s.country})</span>
        <Select aria-label={`Ethics committee for site ${s.id}`} value={map[s.id] ?? ''} onChange={(e) => onChange(s.id, e.target.value)} options={[{ value: '', label: '(no committee)' }, ...f.committees!.map((c) => ({ value: c.id, label: `${c.name} · approved ${approvalsOf(f, c.id).map((a) => `${a.version} ${a.approved}`).join(', ') || 'nothing yet'}` }))]} /></label>)}
    </div>
  )
}

function SiteListing() {
  const { p, act, setError } = useStore()
  const [text, setText] = useState<Record<string, string>>({})
  const run = latestRun(p, 'M21'), hide = !!run && run.score === undefined
  const rows = reconcile(p, p.consentVersions!, p.consentSiteMap ?? {})
  const open = (key: string) => p.queries.some((q) => isActive(q) && q.key === key && q.source === 'manual')
  const n = rows.filter((r) => r.status !== 'ok').length
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">Consent by site {hide ? <Pill tone="purple">M21: statuses hidden</Pill> : <Pill tone={n ? 'amber' : 'green'}>{`${n} to review`}</Pill>}</p>
      <p className="text-xs text-lab-text-muted">Each participant’s screening consent page (IC) against the approvals of their site’s committee. A superseded version is allowed for {IMPLEMENTATION_DAYS} days after the newer one is approved, while the site brings it in.</p>
      <Table head={['Participant', 'Version', 'Signed', ...(hide ? [] : ['Status', 'Why']), 'Query']} rows={rows.map((r) => [r.subj, r.version, r.signed, ...(hide ? [] : [<Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill>, <span className="text-xs">{r.why}</span>]),
        open(r.key) ? <Pill tone="blue">open query</Pill> : <div className="flex gap-1 min-w-[16rem]"><input aria-label={`Query text for ${r.subj}`} className={`${inputCls} text-xs`} placeholder="Query text" value={text[r.key] ?? ''} onChange={(e) => setText({ ...text, [r.key]: e.target.value })} />
          <Btn className="py-0.5" disabled={!(text[r.key] ?? '').trim()} onClick={() => { const ok = act((x) => { raiseManual(x, r.key, text[r.key]) }); if (ok) setText({ ...text, [r.key]: '' }); else setError('Could not raise the query.') }}>Raise</Btn></div>])} />
    </div>
  )
}
