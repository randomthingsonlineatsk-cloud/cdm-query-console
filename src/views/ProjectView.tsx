import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state'
import { createProject, audit, me, migrate } from '../domain/project'
import { exportFile, importFile, deleteProject, listProjects, saveProject } from '../domain/store'
import { formCsvs, zip } from '../domain/lock'
import type { Project } from '../domain/types'
import { exportBuild, checkBuild, importBuild, resetBuild, type BuildReport } from '../domain/build'
import { SignBox } from './ui'
import { ROLE_LABEL } from '../domain/types'
import { STUDY } from '../domain/study'
import { Panel, Btn, Table, inputCls, Pill } from './ui'

export default function ProjectView() {
  const { p, act, replace, setError, saved: savedAt } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [saved, setSaved] = useState<Project[]>([])
  const buildFile = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<BuildReport | null>(null)
  const dlBuild = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(exportBuild(p), null, 2)], { type: 'application/json' })); a.download = `${STUDY.protocol}-study-build.json`; a.click(); URL.revokeObjectURL(a.href) }
  const refresh = () => listProjects().then((a) => setSaved(a.sort((x, y) => y.updatedUtc.localeCompare(x.updatedUtc)))).catch(() => {})
  useEffect(() => { refresh() }, [p.id, savedAt])
  const csvZip = () => {
    const blob = new Blob([zip(formCsvs(p)) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${STUDY.protocol}-cdash-csv-${p.clock}.zip`; a.click(); URL.revokeObjectURL(a.href)
    act((pp) => audit(pp, me(pp), 'project.export.csv', pp.id, undefined, a.download, 'CDASH-style CSV export per form'))
  }
  const download = () => {
    const blob = new Blob([exportFile(p)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${STUDY.protocol}-${p.clock}.cdmproject.json`
    a.click(); URL.revokeObjectURL(a.href)
    act((pp) => audit(pp, me(pp), 'project.export', pp.id, undefined, a.download, 'Project exported to a file'))
  }
  const onFile = async (f: File) => {
    try {
      const { project, warnings } = importFile(await f.text())
      audit(project, me(project), 'project.import', project.id, undefined, f.name, warnings.join(' ') || 'Imported')
      replace(project)
      setMsg(warnings.length ? `Imported with warnings: ${warnings.join(' ')}` : `Imported ${f.name}.`)
    } catch (e) { setError((e as Error).message) }
  }
  return (
    <div className="space-y-4">
      <Panel title="Project" sub="Everything is stored in this browser (IndexedDB). Export a file to keep a copy or move to another computer.">
        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
          <label className="text-xs text-lab-text-muted">Project name<input className={inputCls} value={p.name} onChange={(e) => act((pp) => { pp.name = e.target.value })} /></label>
          <label className="text-xs text-lab-text-muted">User ID (for the later classroom mode)<input className={inputCls} value={p.userId} onChange={(e) => act((pp) => { pp.userId = e.target.value.trim() || 'local-user' })} /></label>
          <label className="text-xs text-lab-text-muted">Class ID<input className={inputCls} value={p.classId} onChange={(e) => act((pp) => { pp.classId = e.target.value.trim() || 'none' })} /></label>
          <div className="text-xs text-lab-text-muted">Project ID<p className="font-mono text-lab-text mt-1">{p.id}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="solid" onClick={download}>Export project file</Btn>
          <Btn onClick={() => file.current?.click()}>Import project file</Btn>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" aria-label="Project file" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
          {!confirmReset ? <Btn tone="grey" onClick={() => setConfirmReset(true)}>Start a new project</Btn>
            : <><Btn tone="red" onClick={() => { saveProject(p).finally(() => { replace(createProject(p.userId, p.classId)); setConfirmReset(false); setMsg('New project started. The previous one is listed under Saved projects.') }) }}>Yes, start a new project</Btn><Btn tone="grey" onClick={() => setConfirmReset(false)}>Cancel</Btn></>}
          <Btn tone="grey" onClick={csvZip}>Export CDASH-style CSV (.zip)</Btn>
        </div>
        {msg && <p className="text-xs text-lab-cdsco">{msg}</p>}
        <p className="text-[11px] text-lab-text-muted">Exported files carry a checksum and the hash-chained audit trail; an edited file is flagged on import.</p>
      </Panel>
      <Panel title="Study build" sub="The visit schedule, eCRF forms, codelists, edit checks and CRF completion guidelines, as one file. This is the hand-over format for the EDC Study Build Lab (planned): it exports a build, this console imports it. Any build tool can produce the same file; the format is documented in the repository (docs/study-build-format.md).">
        <p className="text-xs">In force: {p.build ? <b>imported build {p.build.study.buildVersion} from {p.build.study.source}</b> : 'the build shipped with the console'}.</p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={dlBuild}>Export the study build</Btn>
          <Btn tone="grey" onClick={() => buildFile.current?.click()}>Check a build file…</Btn>
          {p.build && <Btn tone="red" onClick={() => act((pp) => resetBuild(pp))}>Return to the shipped build</Btn>}
          <input ref={buildFile} type="file" accept=".json,application/json" className="hidden" aria-label="Study build file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setReport(checkBuild(await f.text())); e.target.value = '' }} />
        </div>
        {report && <div className="rounded border border-lab-line p-2 space-y-1 text-xs">
          {report.errors.length > 0 && <><p className="text-lab-red">Cannot import:</p><ul className="list-disc pl-5 text-lab-red">{report.errors.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {report.changes.length > 0 && <><p>Changes from the build in force:</p><ul className="list-disc pl-5 text-lab-text-muted">{report.changes.slice(0, 40).map((x) => <li key={x}>{x}</li>)}</ul></>}
          {report.warnings.length > 0 && <><p className="text-lab-amber">Warnings:</p><ul className="list-disc pl-5 text-lab-amber">{report.warnings.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {report.build && !report.changes.length && <p className="text-lab-cdsco">No changes: the file matches the build in force.</p>}
          {report.build && <SignBox meaning="Study build amendment approved for production" what={`Study build ${report.build.study.buildVersion}`} roles={['dmlead']} label="Approve and import" onSigned={(s) => { if (act((pp) => importBuild(pp, report.build!, s))) { setReport(null); setMsg('Build imported. The UAT summary needs signing again for the changed checks.') } }} />}
        </div>}
      </Panel>
      <Panel title="Saved projects" sub="Projects stored in this browser. Each mission runs in a prepared project of its own.">
        <Table head={['Name', 'Study date', 'Last saved', '']} rows={saved.map((x) => [x.id === p.id ? <b>{x.name} (open)</b> : x.name, x.clock, x.updatedUtc.replace('T', ' ').slice(0, 16), x.id === p.id ? '' : <div className="flex gap-1"><Btn tone="blue" className="py-0.5" onClick={() => saveProject(p).finally(() => replace(migrate(x)))}>Open</Btn><Btn tone="red" className="py-0.5" onClick={() => deleteProject(x.id).then(refresh)}>Delete</Btn></div>])} empty="Nothing saved yet." />
      </Panel>
      <Panel title="Users and practice PINs" sub="Accounts are personal in real systems and a PIN is never shared. These are practice accounts so you can play every role.">
        <Table head={['User ID', 'Name', 'Role', 'PIN', 'Trained']} rows={p.users.filter((u) => !u.id.startsWith('scenario')).map((u) => [<span className="font-mono">{u.id}</span>, u.name, ROLE_LABEL[u.role], <span className="font-mono">{u.pin}</span>, u.trained ? <Pill tone="green">Yes</Pill> : <Pill tone="amber">No</Pill>])} />
      </Panel>
      <Panel title="About">
        <p className="text-sm text-lab-text-muted">A practice console for clinical data management on the run side of a study. It models real CDM practice: CDISC CDASH forms, a data validation specification with UAT, automatic and manual queries with ageing, a hash-chained audit trail and two-part electronic signatures. It is not a validated system and must not hold real patient data. Real regulations and standards are named for learning; no commercial system is reproduced.</p>
        <p className="text-sm text-lab-text-muted">Open source under the Apache License 2.0.</p>
      </Panel>
    </div>
  )
}
