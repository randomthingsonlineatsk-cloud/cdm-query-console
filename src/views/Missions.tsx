import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { MISSIONS, LEVEL_TEXT, progress, M4_SCENARIOS, latestRun, startMission, scoreM1, scoreM2, scoreM3, scoreM4, scoreM5, scoreM6, scoreM7, scoreM8, scoreM9, scoreM10, scoreM11, scoreM12, scoreM13, scoreM14, scoreM15, scoreM16, scoreM17, scoreM18, scoreM19, certificate, siteIssueStatus, prepareMission, MISSION_PROJECT } from '../domain/missions'
import { listProjects } from '../domain/store'
import type { MissionRun } from '../domain/types'
import { scoreQuery } from '../domain/queries'
import { Panel, Pill, Btn, TextArea, Table, Stat } from './ui'
import { QualityMeter } from './Queries'

function useAllRuns() {
  const { p, tick } = useStore()
  const [others, setOthers] = useState<MissionRun[]>([])
  useEffect(() => { listProjects().then((all) => setOthers(all.filter((x) => x.id !== p.id && x.userId === p.userId).flatMap((x) => x.missions ?? []))).catch(() => {}) }, [p.id])
  return useMemo(() => [...others, ...p.missions], [others, tick, p.missions.length])
}
const bestOf = (runs: MissionRun[], id: string) => runs.filter((r) => r.id === id && r.score !== undefined).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]

export default function Missions() {
  const { p, act } = useStore()
  const runs = useAllRuns()
  const here = MISSIONS.find((m) => { const r = latestRun(p, m.id); return r && r.score === undefined })
  const { arg } = useNav()
  const [open, setOpen] = useState<string | null>(here?.id ?? (arg && MISSIONS.some((m) => m.id === arg) ? arg : null))
  const passed = MISSIONS.filter((m) => bestOf(runs, m.id)?.passed).length
  return (
    <div className="space-y-4">
      <Panel title="Missions" sub="Nineteen scored missions on two studies: M1 to M13 on the hypertension trial HLV-204-201, M14 to M17 on the vaccine trial ALV-3-301 with its e-diary, M18 on HLV-204-201’s decentralised elements under ICH E6(R3) Annex 2, and M19 on its ICH M11 protocol and the Protocol-to-Database Twin. Each starts from a prepared project of its own, so your work elsewhere is never disturbed. Passing ten at 70% or more, on either study, earns the course certificate.">
        <div className="grid grid-cols-3 gap-2 max-w-md"><Stat label="Passed" value={passed} tone="green" /><Stat label="Missions" value={MISSIONS.length} tone="blue" /><Stat label="For certificate" value={`10 of ${MISSIONS.length}`} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-lab-text-muted">Level for new runs</span>
          {(['guided', 'standard', 'expert'] as const).map((l) => <Btn key={l} tone={(p.missionLevel ?? 'standard') === l ? 'solid' : 'grey'} onClick={() => act((pp) => { pp.missionLevel = l })}>{l}</Btn>)}
          <span className="text-[11px] text-lab-text-muted">{LEVEL_TEXT[p.missionLevel ?? 'standard']} The pass mark is 70% at every level; the certificate shows each mission’s level.</span>
        </div>
        {here && <p className="text-xs text-lab-amber">This project is the prepared project for {here.id} {here.title}.</p>}
      </Panel>
      <div className="grid md:grid-cols-2 gap-3">
        {MISSIONS.map((m) => {
          const best = bestOf(runs, m.id)
          const r = latestRun(p, m.id)
          return (
            <Panel key={m.id} title={`${m.id} · ${m.title}`} sub={`Phase ${m.phase} · ${m.phase === 5 ? 'vaccine trial ALV-3-301' : m.phase === 6 ? (m.id === 'M19' ? 'HLV-204-201, ICH M11' : 'HLV-204-201, ICH E6(R3) Annex 2') : 'HLV-204-201'} · Pass: ${m.pass}`} right={r && r.score === undefined ? <Pill tone="blue">In progress here</Pill> : best ? <Pill tone={best.passed ? 'green' : 'red'}>best {best.score}%</Pill> : null}>
              <p className="text-sm text-lab-text-muted">{m.brief}</p>
              <Btn onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? 'Hide' : r && r.score === undefined ? 'Continue' : 'Open'}</Btn>
            </Panel>
          )
        })}
      </div>
      {open && <MissionPanel id={open} />}
      <Certificate runs={runs} />
    </div>
  )
}

// A mission panel: start in a prepared project, or work the active run here.
function MissionPanel({ id }: { id: string }) {
  const { p, replace, setError } = useStore()
  const [busy, setBusy] = useState(false)
  const m = MISSIONS.find((x) => x.id === id)!
  const run = latestRun(p, id)
  const active = run && run.score === undefined ? run : undefined
  if (MISSION_PROJECT[id] === 'none') return id === 'M4' ? <M4 /> : id === 'M17' ? <M17 /> : id === 'M18' ? <M18 /> : id === 'M19' ? <M19 /> : <M13 />
  if (!active) {
    const start = () => {
      setBusy(true)
      setTimeout(() => {
        try { const np = prepareMission(p, id, createProject, { lock: prepareForLock, locked: prepareLocked }); saveProject(p).finally(() => replace(np)) }
        catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      }, 30)
    }
    return (
      <Panel title={`${m.id} · ${m.title}`} sub={m.brief}>
        <p className="text-xs text-lab-text-muted">Starts a new project prepared for this mission (any work done by the training scenario is labelled as such in the audit trail). The level is {p.missionLevel ?? 'standard'}. Your current project stays saved under Project → Saved projects.</p>
        <Btn tone="solid" disabled={busy} onClick={start}>{busy ? 'Preparing the study (a few seconds)…' : 'Start in a new project'}</Btn>
        <Result id={id} />
      </Panel>
    )
  }
  if (id === 'M1') return <M1 run={active} />
  if (id === 'M2') return <M2 run={active} />
  if (id === 'M3') return <M3 />
  if (id === 'M11' || id === 'M12') return <LockMission id={id} />
  if (VAX_P[id]) return <VaxMission id={id} />
  return <Phase2Mission id={id} />
}

function Result({ id }: { id: string }) {
  const { p } = useStore()
  const r = latestRun(p, id)
  if (r?.score === undefined) return null
  return (
    <div className={`rounded border p-3 ${r.passed ? 'border-lab-cdsco/60' : 'border-lab-red/60'}`}>
      <p className="font-mono text-sm">{r.passed ? 'Passed' : 'Not passed'} · {r.score}%</p>
      <ul className="list-disc pl-5 text-xs text-lab-text-muted">{r.detail?.map((d) => <li key={d}>{d}</li>)}</ul>
    </div>
  )
}

function M1({ run }: { run: MissionRun }) {
  const { p, act } = useStore()
  const { go } = useNav()
  return (
    <Panel title="M1 · Fix the DMP" sub="Review the plan on the Start-up tab, flag the statements that are wrong with their corrections, then finish here.">
      <div className="flex gap-2"><Btn onClick={() => go('startup')}>Open the DMP</Btn><Btn tone="solid" onClick={() => act((pp) => scoreM1(pp, pp.missions.find((x) => x.startedUtc === run.startedUtc && x.id === 'M1')!))}>Finish and score</Btn></div>
      <p className="text-xs text-lab-text-muted">{Object.keys(p.startup.dmpFlags).length} statements flagged so far.</p>
      <Progress id="M1" /><Result id="M1" />
    </Panel>
  )
}

function M2({ run }: { run: MissionRun }) {
  const { act } = useStore()
  const { go } = useNav()
  return (
    <Panel title="M2 · Test the checks" sub="On the Edit checks tab, choose “Release under test”, run the twelve checks’ test cases, read each failing case, fix the logic, re-run, and sign the UAT summary.">
      <div className="flex gap-2"><Btn onClick={() => go('checks')}>Open the edit checks</Btn><Btn tone="solid" onClick={() => act((pp) => scoreM2(pp, pp.missions.find((x) => x.startedUtc === run.startedUtc && x.id === 'M2')!))}>Finish and score</Btn></div>
      <Progress id="M2" /><Result id="M2" />
    </Panel>
  )
}

function M3() {
  const { p, act } = useStore()
  const { go } = useNav()
  const run = latestRun(p, 'M3')
  const activeRun = run && run.score === undefined ? run : undefined
  const st = siteIssueStatus(p, '103').filter((x) => x.entered)
  return (
    <Panel title="M3 · Clean a messy site" sub="Site 103 (Sahyadri Heart Institute) has a new study coordinator. Starting the mission moves the clock to 29 June 2026 if it is earlier, and gives you six simulated weeks.">
      {activeRun && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Started" value={activeRun.answers?.start ?? ''} />
            <Stat label="Deadline" value={activeRun.answers?.deadline ?? ''} tone={p.clock > (activeRun.answers?.deadline ?? '') ? 'red' : 'grey'} />
            <Stat label="Study date" value={p.clock} tone="blue" />
            {p.missionLevel === 'guided' && <Stat label="Site 103 issues resolved" value={`${st.filter((x) => x.resolved).length}/${st.length}`} tone="green" />}
          </div>
          <p className="text-xs text-lab-text-muted">Work the queue for site 103: Queries (filter Site 103), the listings, and the casebook. Advance the clock to let the site answer. The issues behind the count stay hidden until you finish.</p>
          <div className="flex gap-2"><Btn onClick={() => go('queries')}>Queries</Btn><Btn tone="grey" onClick={() => go('listings')}>Listings</Btn><Btn tone="solid" onClick={() => act((pp) => scoreM3(pp, activeRun))}>Finish and score</Btn></div>
        </>
      )}
      <Progress id="M3" /><Result id="M3" />
      {run?.score !== undefined && (
        <Table head={['Issue', 'Subject', 'Form · field', 'What it was', 'Resolved']} rows={siteIssueStatus(p, '103').filter((x) => x.entered).map((x) => [x.issue.id, x.issue.subj, `${x.issue.form} ${x.issue.visit} · ${x.issue.field}`, x.issue.note, x.resolved ? <Pill tone="green">Yes</Pill> : x.closedWrong ? <Pill tone="red">Closed on wrong data</Pill> : <Pill tone="amber">No</Pill>])} />
      )}
    </Panel>
  )
}

function M4() {
  const { p, act } = useStore()
  const run = latestRun(p, 'M4')
  const [answers, setAnswers] = useState<Record<string, string>>(run?.answers ?? {})
  return (
    <Panel title="M4 · Write a good query" sub="Each finding comes with the query a hurried colleague drafted. Rewrite it so it is neutral, specific and answerable. Unchanged text scores zero; the score is the average.">
      {M4_SCENARIOS.map((s, i) => {
        const sc = scoreQuery(answers[s.id] ?? '', s.mention)
        return (
          <div key={s.id} className="space-y-1.5 border-t border-lab-line pt-3">
            <p className="text-sm"><span className="font-mono text-lab-fda">Query {String.fromCharCode(65 + i)}.</span> {s.data}</p>
            <p className="text-xs"><span className="text-lab-text-muted">Draft: </span><span className="text-lab-red">“{s.poor}”</span></p>
            <TextArea aria-label={`Rewrite of query ${String.fromCharCode(65 + i)}`} placeholder="Your rewrite" value={answers[s.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [s.id]: e.target.value })} />
            {p.missionLevel !== 'expert' && <QualityMeter score={sc.score} rules={sc.rules} />}
          </div>
        )
      })}
      <Btn tone="solid" onClick={() => act((pp) => { const r = startMission(pp, 'M4'); r.answers = { ...answers }; scoreM4(pp, r) })}>Submit and score</Btn>
      <Result id="M4" />
    </Panel>
  )
}

const P2: Record<string, { view: 'coding' | 'recon' | 'oversight'; label: string; score: typeof scoreM5; tips: string[] }> = {
  M5: { view: 'coding', label: 'Open coding', score: scoreM5, tips: ['Code as Tomás Ibarra (medical coder); approve as Jonas Weber (lead data manager).', 'A trade name codes to its own record; a drug with two classes needs the class that matches the indication.', 'Query combined or ambiguous terms instead of coding them; they come back once the site answers.'] },
  M6: { view: 'recon', label: 'Open reconciliation', score: scoreM6, tips: ['Work as Asha Rao (data manager); sign off as Asha or Jonas and as Dr Ravi Menon (drug safety).', 'Check the SAE report in your head: which side moved away from it?', 'An unmatched pair on both sides may be one event with a mistyped key: link it.', 'Advance the clock so sites and drug safety can answer.'] },
  M7: { view: 'recon', label: 'Open reconciliation', score: scoreM7, tips: ['Load or reject every central-lab transfer on the Vendor transfers tab, then reconcile on Vendor reconciliation.', 'Read the DTA before classing a sample the EDC does not have.', 'A unit problem needs a vendor clarification and a conversion rule.'] },
  M9: { view: 'oversight', label: 'Open oversight', score: scoreM9, tips: ['Work as Maya Lindqvist (CRA) or Asha Rao on Oversight → Centralised monitoring.', 'Ask of each flag: is it a pattern in how the site works, or chance at a small site?', 'A for-cause visit happens a week after it is planned: advance the clock, then score.'] },
  M10: { view: 'oversight', label: 'Open oversight', score: scoreM10, tips: ['Compare each QTL with its limit on Oversight → Quality tolerance limits.', 'Record the breach as Jonas Weber, with root cause and corrective action.', 'Log the deviations behind the breach (category Safety reporting, one per subject) and classify them.', 'Check Reconciliation → SAE for the awareness and receipt dates.'] },
  M8: { view: 'coding', label: 'Open the upgrade', score: scoreM8, tips: ['Read the impact list on Coding → Version upgrade, write the impact note, and apply as Jonas Weber.', 'Recode only the retired terms; review hierarchy changes without recoding.'] },
}
function Phase2Mission({ id }: { id: string }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const run = latestRun(p, id)
  const active = run && run.score === undefined ? run : undefined
  const m = MISSIONS.find((x) => x.id === id)!
  const cfg = P2[id]
  return (
    <Panel title={`${m.id} · ${m.title}`} sub={m.brief}>
      {p.missionLevel !== 'expert' && <ul className="list-disc pl-5 text-xs text-lab-text-muted">{cfg.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      {active && <>
        <p className="text-xs">Started on study date {active.answers?.start}{active.answers?.deadline ? ` · sign-off deadline ${active.answers.deadline}` : ''} · now {p.clock}</p>
        <div className="flex gap-2"><Btn onClick={() => go(cfg.view)}>{cfg.label}</Btn><Btn tone="solid" onClick={() => act((pp) => cfg.score(pp, active))}>Finish and score</Btn></div>
      </>}
      <Progress id={id} /><Result id={id} />
    </Panel>
  )
}

import { createProject } from '../domain/project'
import { prepareForLock, prepareLocked, CLOSE_OUT_REPORT } from '../domain/lock'
import { saveProject } from '../domain/store'

function LockMission({ id }: { id: 'M11' | 'M12' }) {
  const { p, act, replace, setError } = useStore()
  const { go } = useNav()
  const run = latestRun(p, id)
  const active = run && run.score === undefined ? run : undefined
  const m = MISSIONS.find((x) => x.id === id)!
  return (
    <Panel title={`${m.id} · ${m.title}`} sub={m.brief}>
      {active && <>
        {id === 'M12' && <p className="text-sm text-lab-red">{CLOSE_OUT_REPORT}</p>}
        <p className="text-xs">Started on study date {active.answers?.start}{active.answers?.deadline ? ` · lock deadline ${active.answers.deadline}` : ''} · now {p.clock}</p>
        {p.missionLevel !== 'expert' && <ul className="list-disc pl-5 text-xs text-lab-text-muted">{(id === 'M11' ? ['The Lock tab lists what is still missing, with evidence.', 'Open queries need site answers: advance the clock, then close them.', 'The privacy problem is fixed by the site, through a query.', 'Sign casebooks as Dr Elena Marsh (PI, 5555); approve lock as Jonas Weber (2222) and Dr Hana Okafor (sponsor, 8888).'] : ['Request the unlock on the Lock tab for the one subject affected.', 'Raise the query on the subject’s AE log so the site enters the event (the query key is the AE term of a new record).', 'Then code and approve, SDV, re-sign the casebook, review the audit trail, and re-lock.']).map((t) => <li key={t}>{t}</li>)}</ul>}
        <div className="flex gap-2"><Btn onClick={() => go('lock')}>Open the Lock tab</Btn><Btn tone="solid" onClick={() => act((pp) => (id === 'M11' ? scoreM11 : scoreM12)(pp, active))}>Finish and score</Btn></div>
      </>}
      <Progress id={id} /><Result id={id} />
    </Panel>
  )
}

function Certificate({ runs }: { runs: MissionRun[] }) {
  const { p } = useStore()
  const [name, setName] = useState('')
  const c = certificate(runs, p.userId, name || 'Learner')
  return (
    <Panel title="Certificate" sub="Pass ten of the seventeen missions at 70% or more, on either study, in any of your projects in this browser. The certificate shows a verification code made from your name, your scores and your user ID.">
      <p className="text-sm">{c.passed.length} of {MISSIONS.length} missions passed.</p>
      {c.eligible ? (
        <div className="space-y-2">
          <input aria-label="Name on the certificate" className="w-full max-w-sm rounded-md border border-lab-line bg-lab-panel-strong px-2 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name as it should appear" />
          {name.trim() && <div id="certificate" className="rounded-lg border-2 border-lab-cdsco/70 p-6 text-center space-y-2 bg-lab-panel-strong/50">
            <p className="font-mono text-xs uppercase text-lab-text-muted">Certificate of completion · training</p>
            <p className="text-xl">{name.trim()}</p>
            <p className="text-sm">has completed the CDM Query &amp; Edit-Check Console course on the fictional {c.passed.some((r) => Number(r.id.slice(1)) >= 14) ? 'studies HLV-204-201 and ALV-3-301' : `study ${STUDY_PROTOCOL}`}, passing {c.passed.length} of {MISSIONS.length} scored missions:</p>
            <p className="text-xs text-lab-text-muted">{c.passed.map((r) => `${r.id} ${MISSIONS.find((m) => m.id === r.id)!.title} (${r.score}%, ${r.level ?? 'standard'})`).join(' · ')}</p>
            <p className="font-mono text-sm">Verification code {c.code}</p>
            <p className="text-[11px] text-lab-text-muted">Issued {new Date().toISOString().slice(0, 10)}. A practice certificate from a training simulator; not an accredited qualification. Built by Khan Gulrez Shagufa Fazal Ahmed.</p>
          </div>}
          {name.trim() && <Btn tone="grey" onClick={() => window.print()}>Print or save as PDF</Btn>}
        </div>
      ) : <p className="text-xs text-lab-text-muted">{10 - c.passed.length} more to go.</p>}
    </Panel>
  )
}
const STUDY_PROTOCOL = 'HLV-204-201'

import { EXTRACT, ESOURCE_USERS, ATTRS, ATTR_TEXT } from '../domain/alcoa'
function M13() {
  const { p, act } = useStore()
  const run = latestRun(p, 'M13')
  const [a, setA] = useState<Record<string, string>>(run?.score === undefined ? run?.answers ?? {} : {})
  const done = run?.score !== undefined
  return (
    <Panel title="M13 · Audit the trail" sub="Extract from the audit trail of site 106’s electronic source notes system (fictional), exported for the sponsor’s vendor qualification. Times are local to the site (UTC+05:30).">
      <details className="rounded border border-lab-line p-2 text-xs"><summary className="cursor-pointer">ALCOA+ attributes</summary><ul className="mt-1 space-y-0.5">{ATTRS.map((x) => <li key={x}><b>{x}:</b> {ATTR_TEXT[x]}</li>)}</ul></details>
      <Table head={['User ID', 'Who', 'Account active']} rows={ESOURCE_USERS.map((u) => [<span className="font-mono">{u.id}</span>, u.name, u.active])} />
      <Table head={['Seq', 'When', 'User', 'Action', 'Record', 'Old', 'New', 'Reason', 'Your finding']} rows={EXTRACT.map((r) => [r.seq, <span className="font-mono text-[10px]">{r.when}</span>, <span className="font-mono">{r.user}</span>, r.action, r.record, r.old, r.nw, r.reason,
        <select aria-label={`Finding for entry ${r.seq}`} className="rounded border border-lab-line bg-lab-panel-strong px-1 py-0.5 text-xs" value={a[r.seq] ?? ''} disabled={done} onChange={(e) => setA({ ...a, [r.seq]: e.target.value })}>
          <option value="">Choose…</option><option value="none">No issue</option>{ATTRS.map((x) => <option key={x} value={x}>Breaks: {x}</option>)}
        </select>])} />
      {!done && <Btn tone="solid" onClick={() => act((pp) => { const r = startMission(pp, 'M13'); r.answers = { ...a }; scoreM13(pp, r) })}>Submit and score</Btn>}
      <Result id="M13" />
      {done && <Table head={['Seq', 'Answer', 'Why']} rows={EXTRACT.map((r) => [r.seq, r.answer === 'none' ? 'No issue' : r.answer, r.why])} />}
      {done && <Btn tone="grey" onClick={() => setA({})}>Clear my answers to try again</Btn>}
    </Panel>
  )
}

function Progress({ id }: { id: string }) {
  const { p } = useStore()
  const [res, setRes] = useState<{ score: number; detail: string[] } | null>(null)
  if ((p.missionLevel ?? 'standard') !== 'guided') return null
  const run = latestRun(p, id)
  const active = run && run.score === undefined ? run : { id, startedUtc: 'progress', userId: p.currentUserId, level: 'guided' as const, answers: {} }
  return (
    <div className="rounded border border-lab-cdsco/40 p-2 space-y-1">
      <Btn tone="green" onClick={() => setRes(progress(p, active))}>Check my progress (guided)</Btn>
      {res && <><p className="text-xs">If you finished now: <b>{res.score}%</b></p><ul className="list-disc pl-5 text-[11px] text-lab-text-muted">{res.detail.map((d) => <li key={d}>{d}</li>)}</ul></>}
    </div>
  )
}

// ---------- vaccine-study missions ----------
const VAX_P: Record<string, { tab: string; label: string; score: typeof scoreM14; tips: string[] }> = {
  M14: { tab: 'compliance', label: 'Open diary compliance', score: scoreM14, tips: ['Each morning, open E-diary → Compliance and look for days marked “!”: still open until 12:00.', 'Alert the site for every open day; an alert after noon is too late, the day is then missed for good.', 'A participant whose entries keep arriving days late may have a device that is not syncing: an alert gets the site to restart it.', 'Advance the clock one day at a time.'] },
  M15: { tab: 'dcf', label: 'Open the correction requests', score: scoreM15, tips: ['Send to the vendor only when the change is backed by a contemporaneous source: a phone note or email from the participant made when the error happened or was found.', 'A memory weeks later, a monitor’s opinion, or a wish to make data look consistent is not a source: return those with the reason.', 'Check the value: the correction must say exactly what the participant reported.'] },
  M16: { tab: 'recon', label: 'Open diary reconciliation', score: scoreM16, tips: ['A reaction still present on the last diary day needs a continuing-reaction form on the eCRF.', 'Medicine for fever or pain in the diary should appear in concomitant medications.', 'A diary fever entered again as an unsolicited AE is double-counted: the site removes the AE.', 'A device mismatch is for the vendor; a missing eCRF record is for the site.'] },
}
function VaxMission({ id }: { id: string }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const run = latestRun(p, id)
  const active = run && run.score === undefined ? run : undefined
  const m = MISSIONS.find((x) => x.id === id)!
  const cfg = VAX_P[id]
  return (
    <Panel title={`${m.id} · ${m.title}`} sub={m.brief}>
      {p.missionLevel !== 'expert' && <ul className="list-disc pl-5 text-xs text-lab-text-muted">{cfg.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      {active && <>
        <p className="text-xs">Started on study date {active.answers?.start}{active.answers?.deadline ? ` · period ends ${active.answers.deadline}` : ''} · now {p.clock}</p>
        <div className="flex gap-2"><Btn onClick={() => go('diary', cfg.tab)}>{cfg.label}</Btn><Btn tone="solid" onClick={() => act((pp) => cfg.score(pp, active))}>Finish and score</Btn></div>
      </>}
      <Progress id={id} /><Result id={id} />
    </Panel>
  )
}

import { TRAIL, TRAIL_TEXT, DEVICE_LOG } from '../domain/vax/missions'
function M17() {
  const { p, act } = useStore()
  const run = latestRun(p, 'M17')
  const [a, setA] = useState<Record<string, string>>(run?.score === undefined ? run?.answers ?? {} : {})
  const done = run?.score !== undefined
  return (
    <Panel title="M17 · Review the diary trail" sub="Extract from the e-diary audit trail for site 203 (Deccan Clinical Research Institute), exported by the diary vendor for a sponsor audit. Times are local to the site (UTC+05:30). Each diary day is open from the evening of that day until 12:00 the next day; day 1 is the day of vaccination.">
      <details className="rounded border border-lab-line p-2 text-xs"><summary className="cursor-pointer">What a reviewer looks for</summary><ul className="mt-1 space-y-0.5">{Object.values(TRAIL_TEXT).map((x) => <li key={x}>{x}</li>)}</ul></details>
      <Table head={['Participant', 'Device assigned (accountability log)']} rows={DEVICE_LOG.map((d) => [<span className="font-mono">{d.participant}</span>, <span className="font-mono">{d.device}</span>])} />
      <Table head={['Seq', 'When', 'User', 'Device', 'Record', 'Old', 'New', 'Reason', 'Your finding']} rows={TRAIL.map((r) => [r.seq, <span className="font-mono text-[10px]">{r.when}</span>, <span className="font-mono">{r.user}</span>, <span className="font-mono">{r.device}</span>, r.record, r.old, r.nw, r.reason,
        <select aria-label={`Finding for entry ${r.seq}`} className="rounded border border-lab-line bg-lab-panel-strong px-1 py-0.5 text-xs max-w-56" value={a[r.seq] ?? ''} disabled={done} onChange={(e) => setA({ ...a, [r.seq]: e.target.value })}>
          <option value="">Choose…</option><option value="none">No issue</option>{Object.entries(TRAIL_TEXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>])} />
      {!done && <Btn tone="solid" onClick={() => act((pp) => { const r = startMission(pp, 'M17'); r.answers = { ...a }; scoreM17(pp, r) })}>Submit and score</Btn>}
      <Result id="M17" />
      {done && <Table head={['Seq', 'Answer', 'Why']} rows={TRAIL.map((r) => [r.seq, r.answer === 'none' ? 'No issue' : TRAIL_TEXT[r.answer], r.why])} />}
      {done && <Btn tone="grey" onClick={() => setA({})}>Clear my answers to try again</Btn>}
    </Panel>
  )
}

import { ANNEX2, SOURCES, ROWS, HEADS, STREAM_NAMES, ACTION_TEXT } from '../domain/annex2'
function M18() {
  const { p, act } = useStore()
  const run = latestRun(p, 'M18')
  const [a, setA] = useState<Record<string, string>>(run?.score === undefined ? run?.answers ?? {} : {})
  const done = run?.score !== undefined
  const answered = ROWS.filter((r) => a[r.id]).length
  return (
    <Panel title="M18 · Review decentralised data" sub={ANNEX2.status}>
      <p className="text-xs">{ANNEX2.amendment}</p>
      <details className="rounded border border-lab-line p-2 text-xs" open><summary className="cursor-pointer">Data sources added by amendment 2 (from the data management plan)</summary>
        <div className="mt-2"><Table head={['Stream', 'Provider', 'Data', 'How it arrives', 'Investigator', 'Annex 2', 'What the protocol requires']} rows={SOURCES.map((x) => [x.stream, x.provider, x.what, x.route, x.investigator, x.sections, x.controls])} /></div>
      </details>
      <details className="rounded border border-lab-line p-2 text-xs"><summary className="cursor-pointer">The actions</summary><ul className="mt-1 space-y-0.5"><li><b>No issue:</b> the record meets the protocol.</li>{Object.entries(ACTION_TEXT).map(([k, t]) => <li key={k}>{t}.</li>)}</ul><p className="mt-1 text-lab-text-muted">Choose the one action data management takes first. Annex 2 keeps the investigator responsible for activities done by others, and the sponsor responsible for service providers and for data that are fit for purpose.</p></details>
      {STREAM_NAMES.map((name, i) => (
        <div key={name} className="space-y-1">
          <h3 className="text-sm font-semibold">{name}</h3>
          <Table head={['#', ...HEADS[i], 'Your action']} rows={ROWS.filter((r) => r.stream === i).map((r) => [r.id, ...r.cells.map((c, j) => j === 0 ? <span className="font-mono">{c}</span> : c),
            <select aria-label={`Action for record ${r.id}`} className="rounded border border-lab-line bg-lab-panel-strong px-1 py-0.5 text-xs max-w-56" value={a[r.id] ?? ''} disabled={done} onChange={(e) => setA({ ...a, [r.id]: e.target.value })}>
              <option value="">Choose…</option><option value="none">No issue</option>{Object.entries(ACTION_TEXT).map(([k, t]) => <option key={k} value={k}>{t.split(':')[0]}</option>)}
            </select>])} />
        </div>
      ))}
      {!done && <div className="flex items-center gap-2"><Btn tone="solid" onClick={() => act((pp) => { const r = startMission(pp, 'M18'); r.answers = { ...a }; scoreM18(pp, r) })}>Submit and score</Btn><span className="text-xs text-lab-text-muted">{answered} of {ROWS.length} reviewed</span></div>}
      <Result id="M18" />
      {done && <Table head={['#', 'Answer', 'Annex 2', 'Why']} rows={ROWS.map((r) => [r.id, r.answer === 'none' ? 'No issue' : ACTION_TEXT[r.answer].split(':')[0], r.section, r.why])} />}
      {done && <Btn tone="grey" onClick={() => setA({})}>Clear my answers to try again</Btn>}
    </Panel>
  )
}

import { allFindings, TWIN_ANSWERS, TWIN_ACTION_TEXT, M11 } from '../domain/m11'
function M19() {
  const { p, act } = useStore()
  const { go } = useNav()
  const run = latestRun(p, 'M19')
  const [a, setA] = useState<Record<string, string>>(run?.score === undefined ? run?.answers ?? {} : {})
  const done = run?.score !== undefined
  const rows = allFindings()
  return (
    <Panel title="M19 · Twin the protocol" sub={`HLV-204-201 protocol version ${M11.title['Version Number']} in the ICH M11 structure, traced to the database build by the Protocol-to-Database Twin. The protocol is the source the build must follow, unless the protocol contradicts itself.`}>
      <div className="flex gap-2"><Btn tone="grey" onClick={() => go('twin')}>Open the Protocol twin (schedule, sections, burden)</Btn></div>
      <details className="rounded border border-lab-line p-2 text-xs"><summary className="cursor-pointer">Protocol statements the twin reads with the schedule</summary><ul className="mt-1 space-y-0.5">{M11.statements.map((x) => <li key={x.section}><b>{x.section}:</b> {x.text}</li>)}{M11.procedures.filter((x) => x.note).map((x) => <li key={x.id}><b>1.3, {x.name}:</b> {x.note}</li>)}</ul></details>
      <Table head={['#', 'Where', 'Finding', 'M11', 'Your decision']} rows={rows.map((r, i) => [i + 1, r.where, r.text, r.section,
        <select aria-label={`Decision for finding ${i + 1}`} className="rounded border border-lab-line bg-lab-panel-strong px-1 py-0.5 text-xs max-w-56" value={a[r.id] ?? ''} disabled={done} onChange={(e) => setA({ ...a, [r.id]: e.target.value })}>
          <option value="">Choose…</option><option value="none">Keep as it is (justified)</option>{Object.entries(TWIN_ACTION_TEXT).map(([k, t]) => <option key={k} value={k}>{t.split(':')[0]}</option>)}
        </select>])} />
      {!done && <div className="flex items-center gap-2"><Btn tone="solid" onClick={() => act((pp) => { const r = startMission(pp, 'M19'); r.answers = { ...a }; scoreM19(pp, r) })}>Submit and score</Btn><span className="text-xs text-lab-text-muted">{rows.filter((r) => a[r.id]).length} of {rows.length} decided</span></div>}
      <Result id="M19" />
      {done && <Table head={['#', 'Answer', 'Why']} rows={rows.map((r, i) => { const t = TWIN_ANSWERS[r.id]; return [i + 1, t.answer === 'none' ? 'Keep as it is' : TWIN_ACTION_TEXT[t.answer].split(':')[0], t.why] })} />}
      {done && <Btn tone="grey" onClick={() => setA({})}>Clear my answers to try again</Btn>}
    </Panel>
  )
}
