// Consent versions from the Plain Language Lab, and the edit check they drive.
import { useState } from 'react'
import { useStore } from '../state'
import { ACTIVE } from '../domain/study'
import { readConsentVersions, previewConsent, applyConsent, versionCheck, type ConsentVersionsFile } from '../domain/consentVersions'
import { Panel, Table, Btn } from './ui'

export default function ConsentVersions() {
  const { p, act } = useStore()
  const [file, setFile] = useState<ConsentVersionsFile | null>(null), [err, setErr] = useState(''), [done, setDone] = useState('')
  const study = ACTIVE.id
  let preview: ReturnType<typeof previewConsent> | null = null, perr = ''
  if (file) { try { preview = previewConsent(p, file, study) } catch (e) { perr = (e as Error).message } }
  const open = (f: File) => { const r = new FileReader(); r.onload = () => { try { setFile(readConsentVersions(String(r.result))); setErr(''); setDone('') } catch (e) { setErr((e as Error).message); setFile(null) } }; r.readAsText(f) }
  const held = p.consentVersions, c = versionCheck(p)
  const shown = file ?? held
  return (
    <Panel title="Consent form versions" sub="Approved consent versions per ethics committee, from the Plain Language Lab (Versions and ethics). The superseded-version check follows the latest approved English adult consent form."
      right={<label className="cursor-pointer rounded border border-lab-line px-2 py-1 text-xs font-mono">Open a consent-versions file<input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) open(f) }} /></label>}>
      {err && <p className="text-sm text-lab-red" role="alert">{err}</p>}
      {c && <p className="text-sm">Check <b>{c.id}</b> now: <code className="font-mono">{c.expr}</code>{held ? ` (from the file exported ${held.exportedUtc.slice(0, 10)})` : ' (as shipped)'}</p>}
      {file && perr && <p className="text-sm text-lab-amber" role="alert">{perr}</p>}
      {file && preview && <div className="rounded border border-lab-line p-2 text-sm space-y-2">
        <p>{preview.from === preview.to ? `${preview.check} already expects ${preview.to}. Importing stores the versions only.` : `${preview.check} will expect ${preview.to} instead of ${preview.from}. ${preview.flagged} recorded consent version${preview.flagged === 1 ? '' : 's'} would then fire on the next run of the checks.`}</p>
        <Btn onClick={() => { act((x) => { applyConsent(x, file, study) }); setDone(`Imported. ${preview!.check} expects ${preview!.to}; the change is in the audit trail.`); setFile(null) }}>Import and update {preview.check}</Btn>
      </div>}
      {done && <p className="text-sm text-lab-green">{done}</p>}
      {shown && <Table head={['Document', 'Language', 'Version', 'Committee', 'Sites', 'Approved']} rows={shown.versions.map((v) => [v.document, v.language, v.version, v.committee, v.sites.join(', '), v.approved])} />}
      {shown && shown.inUse.length > 0 && <Table head={['Site', 'Document', 'Language', 'Version', 'In use from']} rows={shown.inUse.map((u) => [u.site, u.document, u.language, u.version, u.from])} />}
    </Panel>
  )
}
