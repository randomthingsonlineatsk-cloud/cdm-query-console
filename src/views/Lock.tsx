import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { checklist, randomised, piCurrent, privacyFindings, signCasebooks, recordAuditReview, confirmPrivacy, softLock, addHardSignature, requestUnlock, approveUnlock, createArchive, archiveFiles, retentionDate, LPLV, CLOSE_OUT_REPORT } from '../domain/lock'
import { latestRun } from '../domain/missions'
import { me } from '../domain/project'
import { STUDY } from '../domain/study'
import { Panel, Pill, Btn, Table, SignBox, Stat, TextArea, ic, fmtUtc } from './ui'
import { RaiseModal } from './Casebook'
import { AppLinks } from './Links'

const STATUS = { open: ['Open', 'amber'], soft: ['Soft-locked', 'blue'], hard: ['Hard-locked', 'green'], unlocked: ['Unlocked for a correction', 'red'] } as const

export default function Lock() {
  const { p, act, tick } = useStore()
  const { go } = useNav()
  const items = useMemo(() => checklist(p), [tick])
  const st = p.lock.status
  const m12 = latestRun(p, 'M12')
  const ready = items.every((i) => i.ok)
  return (
    <div className="space-y-4">
      {m12 && m12.score === undefined && <div role="status" className="rounded border border-lab-red/60 bg-lab-red-soft px-3 py-2 text-sm text-lab-red">{CLOSE_OUT_REPORT}</div>}
      <Panel title="Database lock" sub={`Last subject last visit: ${LPLV()}. Lock follows the DMP: every checklist item evidenced, soft lock, then hard lock with the lead data manager’s and the sponsor’s signatures (ICH E6(R3) 4.2.6).`} right={<Pill tone={STATUS[st][1]}>{STATUS[st][0]}</Pill>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Checklist items met" value={`${items.filter((i) => i.ok).length} of ${items.length}`} tone={ready ? 'green' : 'amber'} />
          <Stat label="Study date" value={p.clock} />
          <Stat label="Casebooks signed" value={`${randomised(p).filter((s) => piCurrent(p, s)).length}/${randomised(p).length}`} tone="purple" />
          <Stat label="Archive" value={p.lock.archive ? 'created' : '—'} tone={p.lock.archive ? 'green' : 'grey'} />
        </div>
      </Panel>
      <Panel title="Lock checklist">
        <Table head={['', 'Item', 'Evidence', '']} rows={items.map((i) => [<span className={i.ok ? 'text-lab-cdsco' : 'text-lab-red'}>{i.ok ? '✓' : '✗'}</span>, i.label, <span className="text-[11px] text-lab-text-muted">{i.evidence}</span>, i.view !== 'lock' ? <Btn tone="grey" className="py-0.5" onClick={() => go(i.view as never)}>Open</Btn> : ''])} />
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <CasebookSign />
        <AuditReview />
        <Privacy />
        <Panel title="Lock steps">
          {st === 'open' && <>
            <p className="text-xs text-lab-text-muted">Soft lock freezes the data once everything is entered: values change only in answer to an open query.</p>
            <SignBox meaning="Soft lock approved" what="Soft lock" roles={['dmlead']} label="Soft-lock" onSigned={(s) => act((pp) => softLock(pp, s))} />
          </>}
          {(st === 'soft' || st === 'unlocked') && <>
            <p className="text-xs text-lab-text-muted">{st === 'unlocked' ? 'Re-lock after the approved change, with every checklist item met again.' : 'Hard lock makes the database read-only. Both signatures are needed.'} {ready ? '' : 'The checklist is not complete yet.'}</p>
            <p className="text-xs">Signed: {p.lock.hardSigs.map((s) => `${s.userId} (${s.role})`).join(', ') || 'none'}</p>
            {!p.lock.hardSigs.some((s) => s.role === 'dmlead') && <SignBox meaning={st === 'unlocked' ? 'Re-lock approved' : 'Hard lock approved'} what={st === 'unlocked' ? 'Re-lock' : 'Hard lock'} roles={['dmlead']} label="Approve as lead data manager" onSigned={(s) => act((pp) => addHardSignature(pp, s))} />}
            {!p.lock.hardSigs.some((s) => s.role === 'sponsor') && <SignBox meaning={st === 'unlocked' ? 'Re-lock approved' : 'Hard lock approved'} what={st === 'unlocked' ? 'Re-lock' : 'Hard lock'} roles={['sponsor']} label="Approve as sponsor" onSigned={(s) => act((pp) => addHardSignature(pp, s))} />}
          </>}
          {st === 'hard' && <Archive />}
        </Panel>
      </div>
      {(st === 'hard' || p.lock.unlocks.length > 0) && <Unlock />}
      <Panel title="Lock record">
        <Table head={['When (UTC)', 'Who', 'Step', 'Detail']} rows={p.lock.events.map((e) => [fmtUtc(e.utc), e.userId, e.action, e.detail])} empty="No lock steps yet." />
      </Panel>
      <Panel title="Where the locked data go next"><AppLinks ids={['sdtm', 'tlf', 'ectd']} /></Panel>
    </div>
  )
}

function CasebookSign() {
  const { p, act } = useStore()
  const subs = randomised(p)
  const stale = subs.filter((s) => !piCurrent(p, s))
  return (
    <Panel title="Investigator casebook signatures" sub="The investigator signs each casebook once data are final. Any later change makes the signature out of date.">
      <p className="text-xs">{subs.length - stale.length} of {subs.length} current.{stale.length ? ` To sign: ${stale.slice(0, 12).join(', ')}${stale.length > 12 ? '…' : ''}` : ''}</p>
      {stale.length > 0 && <SignBox meaning="I confirm the casebooks are complete and accurate" what={`${stale.length} casebooks`} roles={['pi']} label="Sign casebooks" onSigned={(s) => act((pp) => signCasebooks(pp, s, stale))} />}
    </Panel>
  )
}

function AuditReview() {
  const { p, act } = useStore()
  const [t, setT] = useState('')
  const stats = useMemo(() => {
    const a = p.audit
    return {
      updates: a.filter((x) => x.action === 'item.update').length,
      bySystem: a.filter((x) => x.action === 'item.update' && x.role === 'system').length,
      deletions: a.filter((x) => x.action === 'form.delete').length,
      failedSig: a.filter((x) => x.action === 'signature.fail').length,
      cancelled: p.queries.filter((q) => q.status === 'cancelled').length,
    }
  }, [p.audit.length])
  const r = p.lock.auditReview
  return (
    <Panel title="Audit trail review" sub="Before lock, data management reviews the audit trail for unexplained changes, deletions and unusual access, and records what it found.">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Value changes" value={stats.updates} /><Stat label="By the system" value={stats.bySystem} /><Stat label="Deleted forms" value={stats.deletions} />
        <Stat label="Failed signatures" value={stats.failedSig} tone={stats.failedSig ? 'amber' : 'grey'} /><Stat label="Cancelled queries" value={stats.cancelled} />
      </div>
      {r && <p className="text-xs text-lab-text-muted">Last review by {r.userId} {fmtUtc(r.utc)} UTC, up to entry {r.upToSeq}: {r.findings}</p>}
      <TextArea aria-label="Audit trail review findings" value={t} onChange={(e) => setT(e.target.value)} placeholder="What you reviewed (filters, period) and what you found; every change has a reason; deletions explained…" />
      <Btn tone="solid" onClick={() => { if (act((pp) => recordAuditReview(pp, t))) setT('') }}>Record the review</Btn>
    </Panel>
  )
}

function Privacy() {
  const { p, act } = useStore()
  const f = privacyFindings(p)
  const [raise, setRaise] = useState<string | null>(null)
  const can = ['dm', 'dmlead'].includes(me(p).role)
  return (
    <Panel title="Privacy check" sub="No direct identifiers may sit in the database: subject IDs and year of birth only (GDPR Article 5(1)(c), India’s DPDP Act). Free-text fields are scanned for names, phone numbers and e-mail addresses.">
      <Table head={['Field', 'Text', '']} rows={f.map((x) => [<span className="font-mono text-[10px]">{x.key}</span>, x.text, can ? <Btn tone="amber" className="py-0.5" onClick={() => setRaise(x.key)}>Query the site</Btn> : ''])} empty="The scan finds nothing that looks like personal data." />
      {p.lock.privacy ? <p className="text-xs text-lab-cdsco">✓ Confirmed by {p.lock.privacy.userId} {fmtUtc(p.lock.privacy.utc)} UTC</p> : can && <Btn tone="solid" disabled={f.length > 0} onClick={() => act((pp) => confirmPrivacy(pp, ''))}>Confirm the privacy check</Btn>}
      {raise && <RaiseModal itemKey={raise} label="Comment" onClose={() => setRaise(null)} preset="This comment appears to contain a person’s name and phone number. Please remove the personal identifiers and describe the information without them?" />}
    </Panel>
  )
}

function Archive() {
  const { p, act } = useStore()
  const download = () => {
    let bytes: Uint8Array | null = null
    if (!act((pp) => { bytes = createArchive(pp) }) || !bytes) return
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${STUDY.protocol}-archive-${p.clock}.zip`; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-lab-cdsco">The database is hard-locked and read-only.</p>
      <p className="text-xs text-lab-text-muted">The archive holds the data (one CDASH-style CSV per form), the audit trail with every item version, the metadata (edit checks, forms, coding, queries) and the documents (deviations, signatures, lock record), in open formats, to be kept until {retentionDate(p)} (ICH E6(R3) 4.2.7; 25 years under the EU CTR). {archiveFiles(p).length} files.</p>
      <Btn tone="solid" onClick={download}>Create and download the archive (.zip)</Btn>
      {p.lock.archive && <p className="text-[11px] text-lab-text-muted">Archived {fmtUtc(p.lock.archive.utc)} UTC · {p.lock.archive.files} files · checksum {p.lock.archive.checksum} · retain until {p.lock.archive.retention}</p>}
    </div>
  )
}

function Unlock() {
  const { p, act } = useStore()
  const [just, setJust] = useState('')
  const [subs, setSubs] = useState('')
  const pending = p.lock.unlocks.find((x) => x.status === 'requested')
  return (
    <Panel title="Unlock procedure" sub="A change after hard lock needs a documented request naming the finding and the subjects, approval by the lead data manager and the sponsor, the correction made through the usual queries, and a re-lock with every checklist item met again. Only the named subjects can change.">
      <Table head={['Request', 'Subjects', 'Justification', 'Approvals', 'Status']} rows={p.lock.unlocks.map((r) => [r.id, r.subjects.join(', '), r.justification, r.approvals.map((a) => `${a.userId} (${a.role})`).join(', ') || '—', <Pill tone={r.status === 'relocked' ? 'green' : r.status === 'approved' ? 'red' : 'amber'}>{r.status}</Pill>])} empty="No unlock requests." />
      {p.lock.status === 'hard' && !pending && (
        <div className="space-y-2">
          <TextArea aria-label="Justification" value={just} onChange={(e) => setJust(e.target.value)} placeholder="What was found, by whom and when, why it matters, and what will change" />
          <div className="flex gap-2"><input aria-label="Subjects to unlock" className={ic('flex-1')} value={subs} onChange={(e) => setSubs(e.target.value)} placeholder="Subjects, comma-separated (e.g. 105-007)" /><Btn tone="amber" onClick={() => act((pp) => requestUnlock(pp, just, subs.split(',')))}>Request unlock</Btn></div>
        </div>
      )}
      {pending && (
        <div className="grid md:grid-cols-2 gap-3">
          {!pending.approvals.some((a) => a.role === 'dmlead') && <SignBox meaning={`Unlock ${pending.id} approved`} what={`Unlock ${pending.id}`} roles={['dmlead']} label="Approve as lead data manager" onSigned={(s) => act((pp) => approveUnlock(pp, s))} />}
          {!pending.approvals.some((a) => a.role === 'sponsor') && <SignBox meaning={`Unlock ${pending.id} approved`} what={`Unlock ${pending.id}`} roles={['sponsor']} label="Approve as sponsor" onSigned={(s) => act((pp) => approveUnlock(pp, s))} />}
        </div>
      )}
      {p.lock.status === 'unlocked' && <p className="text-xs text-lab-amber">Unlocked for {p.lock.unlocks.find((x) => x.status === 'approved')?.subjects.join(', ')}. Raise the query, let the site correct, then repeat coding approval, SDV, the investigator signature and the audit trail review for what changed, and re-lock above.</p>}
    </Panel>
  )
}
