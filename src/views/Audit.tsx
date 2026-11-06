import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { verifyAudit, userById } from '../domain/project'
import { Panel, Pill, Btn, Table, Select, inputCls, fmtUtc } from './ui'

const ALCOA = [
  ['Attributable', 'Every entry names the user ID and role.'],
  ['Legible', 'Values are stored as text and shown as entered, never encoded.'],
  ['Contemporaneous', 'Each entry has a UTC timestamp on the study clock at the moment of the action.'],
  ['Original', 'The first version of each value is kept; changes add versions.'],
  ['Accurate', 'Edit checks and queries keep values consistent with the source.'],
  ['Complete', 'Creation, change, deletion, queries, signatures and logins to roles are all logged.'],
  ['Consistent', 'Entries are in sequence and each one is chained to the one before by a hash.'],
  ['Enduring', 'Stored in this browser and in exported project files, with a checksum.'],
  ['Available', 'Searchable here and exportable for inspection.'],
]

export default function AuditView() {
  const { p, tick } = useStore()
  const [q, setQ] = useState('')
  const [action, setAction] = useState('all')
  const [who, setWho] = useState('all')
  const [check, setCheck] = useState<number | null>(null)
  const actions = useMemo(() => [...new Set(p.audit.map((a) => a.action))].sort(), [tick])
  const users = useMemo(() => [...new Set(p.audit.map((a) => a.userId))].sort(), [tick])
  const list = useMemo(() => p.audit.filter((a) => (action === 'all' || a.action === action) && (who === 'all' || a.userId === who) && (!q || `${a.entity} ${a.old ?? ''} ${a.new ?? ''} ${a.reason ?? ''}`.toLowerCase().includes(q.toLowerCase()))).reverse(), [tick, q, action, who])
  return (
    <div className="space-y-4">
      <Panel title="Audit trail" sub="Computer-generated, append-only and always on (21 CFR 11.10(e), EU GMP Annex 11 §9). Who, what, when and why for every change." right={<div className="flex items-center gap-2"><Btn onClick={() => setCheck(verifyAudit(p))}>Verify chain</Btn>{check !== null && (check < 0 ? <Pill tone="green">Intact · {p.audit.length} entries</Pill> : <Pill tone="red">Broken at #{check + 1}</Pill>)}</div>}>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Search" className={`${inputCls} w-64`} placeholder="Search entity, value or reason" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select aria-label="Action" className="w-48" value={action} onChange={(e) => setAction(e.target.value)} options={[{ value: 'all', label: 'All actions' }, ...actions.map((a) => ({ value: a, label: a }))]} />
          <Select aria-label="User" className="w-48" value={who} onChange={(e) => setWho(e.target.value)} options={[{ value: 'all', label: 'All users' }, ...users.map((u) => ({ value: u, label: `${u} · ${userById(p, u).name}` }))]} />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table head={['#', 'When (UTC)', 'Who', 'Role', 'Action', 'What', 'Old', 'New', 'Why', 'Hash']} rows={list.slice(0, 400).map((a) => [a.seq, fmtUtc(a.utc), a.userId, a.role, <span className="font-mono">{a.action}</span>, <span className="font-mono text-[10px]">{a.entity}</span>, a.old ?? '', a.new ?? '', a.reason ?? '', <span className="font-mono text-[10px] text-lab-text-muted">{a.hash.slice(0, 8)}</span>])} />
          {list.length > 400 && <p className="text-[11px] text-lab-text-muted mt-1">Showing the latest 400 of {list.length}. Search or filter to narrow.</p>}
        </div>
      </Panel>
      <Panel title="ALCOA+ in this audit trail">
        <div className="grid sm:grid-cols-3 gap-2">{ALCOA.map(([k, v]) => <div key={k} className="rounded border border-lab-line p-2"><p className="font-mono text-xs text-lab-fda">{k}</p><p className="text-xs text-lab-text-muted">{v}</p></div>)}</div>
      </Panel>
    </div>
  )
}
