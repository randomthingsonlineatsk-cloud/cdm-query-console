import { useEffect, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { api, loadSession, saveSession, submissionPayload, verifySubmission, type Session, type Submission } from '../domain/classroom'
import { MISSIONS } from '../domain/missions'
import { listProjects } from '../domain/store'
import type { MissionRun, Project } from '../domain/types'
import { Panel, Pill, Btn, Table, Select, TextArea, ic, fmtUtc } from './ui'

interface Assignment { id: string; missionId: string; difficulty: string; dueAt: string; note: string }
interface Sub { id: string; assignmentId: string; memberId: string; submittedAt: string; score: number; verifiedScore: number | null; checks: { label: string }[] | null }
interface Me {
  role: 'instructor' | 'student'; class: { name: string; code: string; instructorName: string }
  member?: { id: string; name: string }; members?: { id: string; name: string; email: string | null; joinedAt: string }[]
  assignments: Assignment[]; submissions: Sub[]; leaderboard: { rank: number; name: string; total: number; completed: number }[]
  comments?: { submissionId: string; authorName: string; body: string; createdAt: string }[]
}
const title = (id: string) => `${id} · ${MISSIONS.find((m) => m.id === id)?.title ?? ''}`

export default function Classroom() {
  const [s, setS] = useState<Session>(loadSession())
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState('')
  const update = (n: Session) => { setS(n); saveSession(n) }
  const refresh = async (ss = s) => { if (!ss.token) return; setBusy(true); try { setMe(await api<Me>(ss, 'GET', '/me')); setErr('') } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }
  useEffect(() => { refresh() }, [])
  const run = async (fn: () => Promise<void>) => { setBusy(true); setOk(''); try { await fn(); setErr('') } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }
  return (
    <div className="space-y-4">
      <Panel title="Classroom" sub="Optional. An instructor creates a class and sets missions as assignments; students join with a code, run each mission in its prepared project and submit it. Only classroom mode talks to a server; everything else stays in this browser." right={s.token ? <Pill tone="green">{s.role} · {s.className}</Pill> : <Pill>not in a class</Pill>}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-lab-text-muted">Classroom server</span>
          <input aria-label="Classroom server address" className={ic('flex-1 min-w-64 font-mono text-xs')} value={s.api} onChange={(e) => update({ ...s, api: e.target.value.trim() })} />
          <Btn tone="grey" onClick={() => run(async () => { const h = await api<{ service?: string }>(s, 'GET', '/health'); setOk(`The server answers (${h.service ?? 'ok'}).`) })}>Test</Btn>
          {s.token && <Btn tone="grey" onClick={() => { update({ api: s.api }); setMe(null) }}>Leave this class on this device</Btn>}
        </div>
        {ok && !err && <p className="text-xs text-lab-cdsco">{ok}</p>}
        {err && <p role="alert" className="text-xs text-lab-red">{err}</p>}
        {busy && <p className="text-xs text-lab-text-muted">Working…</p>}
      </Panel>
      {!s.token && <JoinOrCreate session={s} onIn={(n) => { update(n); refresh(n) }} run={run} />}
      {s.token && me?.role === 'student' && <Student s={s} me={me} refresh={refresh} run={run} />}
      {s.token && me?.role === 'instructor' && <Instructor s={s} me={me} refresh={refresh} run={run} />}
    </div>
  )
}

function JoinOrCreate({ session, onIn, run }: { session: Session; onIn: (s: Session) => void; run: (f: () => Promise<void>) => void }) {
  const { p } = useStore()
  const [j, setJ] = useState({ code: '', name: '', email: '' })
  const [c, setC] = useState({ name: '', instructorName: '', instructorEmail: '' })
  const [key, setKey] = useState<string | null>(null)
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Panel title="Join a class (student)" sub="Your instructor gives you the six-letter code. The email address is optional; it is used only for deadline reminders.">
        <input aria-label="Join code" className={ic('font-mono uppercase')} value={j.code} onChange={(e) => setJ({ ...j, code: e.target.value })} placeholder="Join code" />
        <input aria-label="Your name" className={ic('')} value={j.name} onChange={(e) => setJ({ ...j, name: e.target.value })} placeholder="Your name" />
        <input aria-label="Email (optional)" className={ic('')} value={j.email} onChange={(e) => setJ({ ...j, email: e.target.value })} placeholder="Email for reminders (optional)" />
        <Btn tone="solid" onClick={() => run(async () => { const r = await api<{ token: string; class: { name: string } }>(session, 'POST', '/join', { code: j.code, name: j.name, email: j.email, userId: p.userId }); onIn({ api: session.api, token: r.token, role: 'student', className: r.class.name, name: j.name }) })}>Join</Btn>
      </Panel>
      <Panel title="Create a class (instructor)" sub="You get a join code for students and an instructor key. The key is shown once: download it, because it is the only way back into the class.">
        {!key ? <>
          <input aria-label="Class name" className={ic('')} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Class name, e.g. CDM cohort 3" />
          <input aria-label="Instructor name" className={ic('')} value={c.instructorName} onChange={(e) => setC({ ...c, instructorName: e.target.value })} placeholder="Your name" />
          <input aria-label="Instructor email (optional)" className={ic('')} value={c.instructorEmail} onChange={(e) => setC({ ...c, instructorEmail: e.target.value })} placeholder="Your email (optional)" />
          <Btn tone="solid" onClick={() => run(async () => { const r = await api<{ instructorKey: string; class: { name: string; code: string } }>(session, 'POST', '/classes', c); setKey(r.instructorKey); download(`${r.class.name}-instructor-key.txt`, `Class: ${r.class.name}\nJoin code for students: ${r.class.code}\nInstructor key (keep it private): ${r.instructorKey}\nServer: ${session.api}\n`); onIn({ api: session.api, token: r.instructorKey, role: 'instructor', className: r.class.name, name: c.instructorName }) })}>Create class</Btn>
        </> : <p className="text-xs text-lab-cdsco">Class created; the key file was downloaded.</p>}
        <details className="text-xs"><summary className="cursor-pointer">Already have an instructor key?</summary>
          <KeyLogin session={session} onIn={onIn} run={run} />
        </details>
      </Panel>
    </div>
  )
}
function KeyLogin({ session, onIn, run }: { session: Session; onIn: (s: Session) => void; run: (f: () => Promise<void>) => void }) {
  const [k, setK] = useState('')
  return <div className="flex gap-2 mt-2"><input aria-label="Instructor key" type="password" className={ic('flex-1 font-mono')} value={k} onChange={(e) => setK(e.target.value)} placeholder="Instructor or student key" /><Btn onClick={() => run(async () => { const me = await api<Me>({ ...session, token: k.trim() }, 'GET', '/me'); onIn({ api: session.api, token: k.trim(), role: me.role, className: me.class.name }) })}>Sign in</Btn></div>
}
const download = (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; a.click(); URL.revokeObjectURL(a.href) }

function Board({ me }: { me: Me }) {
  return <Panel title="Leaderboard" sub="Best score per assignment, summed; a verified score counts over the reported one.">
    <Table head={['Rank', 'Student', 'Total', 'Passed at 80%+']} rows={me.leaderboard.map((l) => [l.rank, l.name, l.total, l.completed])} empty="No students yet." />
  </Panel>
}

function Student({ s, me, refresh, run }: { s: Session; me: Me; refresh: () => void; run: (f: () => Promise<void>) => void }) {
  const { p } = useStore()
  const { go } = useNav()
  const [all, setAll] = useState<Project[]>([])
  useEffect(() => { listProjects().then((x) => setAll(x.filter((y) => y.id !== p.id).concat([p]))).catch(() => setAll([p])) }, [p.id])
  const finished = (id: string) => all.flatMap((x) => x.missions.filter((m) => m.id === id && m.score !== undefined).map((m) => ({ proj: x, run: m }))).sort((a, b) => (b.run.endedUtc ?? '').localeCompare(a.run.endedUtc ?? ''))[0]
  return (
    <div className="space-y-4">
      <Panel title={`${me.class.name} · instructor ${me.class.instructorName}`} sub={`You are ${me.member?.name}. Run each assigned mission on the Missions tab, at the level shown, finish and score it, then submit it here.`}>
        <Table head={['Mission', 'Level', 'Due (UTC)', 'Note', 'Your latest run', 'Submitted', '']} rows={me.assignments.map((a) => {
          const f = finished(a.missionId)
          const subs = me.submissions.filter((x) => x.assignmentId === a.id)
          const best = subs.reduce((m, x) => Math.max(m, x.verifiedScore ?? x.score), -1)
          return [title(a.missionId), a.difficulty, fmtUtc(a.dueAt), a.note, f ? `${f.run.score}% (${f.run.level ?? 'standard'})${(f.run.level ?? 'standard') !== a.difficulty ? ' · different level' : ''}` : <Btn tone="grey" className="py-0.5" onClick={() => go('missions')}>Run it</Btn>,
            subs.length ? `${subs.length} · best ${best}%` : '—',
            f ? <Btn tone="solid" className="py-0.5" onClick={() => run(async () => { const pl = await submissionPayload(f.proj, f.run as MissionRun); const r = await api<{ late: boolean }>(s, 'POST', `/assignments/${a.id}/submissions`, pl); refresh(); if (r.late) throw new Error('Submitted, after the due date.') })}>Submit</Btn> : '']
        })} empty="No assignments yet." />
      </Panel>
      {(me.comments?.length ?? 0) > 0 && <Panel title="Comments from your instructor"><ul className="space-y-1 text-sm">{me.comments!.map((c, i) => <li key={i}><span className="text-lab-text-muted text-xs">{c.authorName} · {fmtUtc(c.createdAt)}</span><br />{c.body}</li>)}</ul></Panel>}
      <Board me={me} />
    </div>
  )
}

function Instructor({ s, me, refresh, run }: { s: Session; me: Me; refresh: () => void; run: (f: () => Promise<void>) => void }) {
  const [a, setA] = useState({ missionId: 'M1', difficulty: 'standard', dueAt: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), note: '' })
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ score: number; detail: string[] } | null>(null)
  const [comment, setComment] = useState('')
  const name = (id: string) => me.members?.find((m) => m.id === id)?.name ?? id
  const asg = (id: string) => me.assignments.find((x) => x.id === id)
  return (
    <div className="space-y-4">
      <Panel title={`${me.class.name}`} sub={`Join code for students: ${me.class.code}`}>
        <p className="text-xs">{me.members?.length ?? 0} {me.members?.length === 1 ? 'student' : 'students'}: {me.members?.map((m) => m.name).join(', ') || 'none yet'}</p>
      </Panel>
      <Panel title="Assignments">
        <Table head={['Mission', 'Level', 'Due (UTC)', 'Note', 'Submissions', '']} rows={me.assignments.map((x) => [title(x.missionId), x.difficulty, fmtUtc(x.dueAt), x.note, me.submissions.filter((y) => y.assignmentId === x.id).length, <Btn tone="red" className="py-0.5" onClick={() => run(async () => { await api(s, 'DELETE', `/assignments/${x.id}`); refresh() })}>Remove</Btn>])} empty="No assignments yet." />
        <div className="flex flex-wrap gap-2 items-center">
          <Select aria-label="Mission" className="w-72" value={a.missionId} onChange={(e) => setA({ ...a, missionId: e.target.value })} options={MISSIONS.map((m) => ({ value: m.id, label: title(m.id) }))} />
          <Select aria-label="Level" className="w-36" value={a.difficulty} onChange={(e) => setA({ ...a, difficulty: e.target.value })} options={['guided', 'standard', 'expert'].map((l) => ({ value: l, label: l }))} />
          <input aria-label="Due date" type="date" className={ic('w-40')} value={a.dueAt} onChange={(e) => setA({ ...a, dueAt: e.target.value })} />
          <input aria-label="Note" className={ic('flex-1 min-w-48')} value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} placeholder="Note for students (optional)" />
          <Btn tone="solid" onClick={() => run(async () => { await api(s, 'POST', '/assignments', { ...a, dueAt: `${a.dueAt}T23:59:00Z` }); refresh() })}>Assign</Btn>
        </div>
      </Panel>
      <Panel title="Submissions" sub="Re-score runs this app’s own scoring on the submitted project in your browser and stores a verified score.">
        <Table head={['Student', 'Mission', 'Submitted (UTC)', 'Reported', 'Verified', '']} rows={me.submissions.map((x) => [name(x.memberId), title(asg(x.assignmentId)?.missionId ?? ''), fmtUtc(x.submittedAt) + (asg(x.assignmentId) && x.submittedAt > asg(x.assignmentId)!.dueAt ? ' (late)' : ''), `${x.score}%`, x.verifiedScore === null ? '—' : `${x.verifiedScore}%`, <Btn className="py-0.5" onClick={() => { setOpen(x.id); setDetail(null); setComment('') }}>Review</Btn>])} empty="No submissions yet." />
        {open && <div className="rounded border border-lab-line p-2 space-y-2">
          <div className="flex gap-2">
            <Btn tone="solid" onClick={() => run(async () => { const r = await api<{ submission: { project: Submission } }>(s, 'GET', `/submissions/${open}`); const v = await verifySubmission(r.submission.project); setDetail(v); await api(s, 'PATCH', `/submissions/${open}`, { verifiedScore: v.score }); refresh() })}>Re-score in this browser</Btn>
            <Btn tone="grey" onClick={() => setOpen(null)}>Close</Btn>
          </div>
          {detail && <><p className="text-sm">Verified score <b>{detail.score}%</b></p><ul className="list-disc pl-5 text-xs text-lab-text-muted">{detail.detail.map((d) => <li key={d}>{d}</li>)}</ul></>}
          <TextArea aria-label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Feedback for the student" />
          <Btn disabled={!comment.trim()} onClick={() => run(async () => { await api(s, 'POST', `/submissions/${open}/comments`, { body: comment }); setComment('') })}>Send comment</Btn>
        </div>}
      </Panel>
      <Board me={me} />
      <Panel title="Delete the class"><Btn tone="red" onClick={() => run(async () => { await api(s, 'DELETE', '/class'); saveSession({ api: s.api }); location.reload() })}>Delete class, students and submissions</Btn></Panel>
    </div>
  )
}
