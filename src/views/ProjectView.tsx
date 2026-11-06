import { useRef, useState } from 'react'
import { useStore } from '../state'
import { createProject, audit, me } from '../domain/project'
import { exportFile, importFile, deleteProject } from '../domain/store'
import { ROLE_LABEL } from '../domain/types'
import { STUDY } from '../domain/study'
import { Panel, Btn, Table, inputCls, Pill } from './ui'

export default function ProjectView() {
  const { p, act, replace, setError } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
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
          {!confirmReset ? <Btn tone="red" onClick={() => setConfirmReset(true)}>Start a new project</Btn>
            : <><Btn tone="red" onClick={() => { const old = p.id; replace(createProject(p.userId, p.classId)); deleteProject(old).catch(() => {}); setConfirmReset(false); setMsg('New project started. Export first if you want to keep the old one.') }}>Yes, discard this project</Btn><Btn tone="grey" onClick={() => setConfirmReset(false)}>Keep it</Btn></>}
        </div>
        {msg && <p className="text-xs text-lab-cdsco">{msg}</p>}
        <p className="text-[11px] text-lab-text-muted">Exported files carry a checksum and the hash-chained audit trail; an edited file is flagged on import.</p>
      </Panel>
      <Panel title="Users and practice PINs" sub="Accounts are personal in real systems and a PIN is never shared. These are practice accounts so you can play every role.">
        <Table head={['User ID', 'Name', 'Role', 'PIN', 'Trained']} rows={p.users.map((u) => [<span className="font-mono">{u.id}</span>, u.name, ROLE_LABEL[u.role], <span className="font-mono">{u.pin}</span>, u.trained ? <Pill tone="green">Yes</Pill> : <Pill tone="amber">No</Pill>])} />
      </Panel>
      <Panel title="About">
        <p className="text-sm text-lab-text-muted">A practice console for clinical data management on the run side of a study. It models real CDM practice: CDISC CDASH forms, a data validation specification with UAT, automatic and manual queries with ageing, a hash-chained audit trail and two-part electronic signatures. It is not a validated system and must not hold real patient data. Real regulations and standards are named for learning; no commercial system is reproduced.</p>
        <p className="text-sm text-lab-text-muted">Open source under the Apache License 2.0.</p>
      </Panel>
    </div>
  )
}
