import { useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { MISSIONS, M4_SCENARIOS, latestRun, startMission, scoreM1, scoreM2, scoreM3, scoreM4, scoreM5, scoreM6, scoreM7, scoreM8, scoreM9, scoreM10, scoreM11, scoreM12, certificate, preparedStartup, siteIssueStatus } from '../domain/missions'
import { scoreQuery } from '../domain/queries'
import { Panel, Pill, Btn, TextArea, Table, Stat } from './ui'
import { QualityMeter } from './Queries'

export default function Missions() {
  const { p } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const passed = MISSIONS.filter((m) => latestRun(p, m.id)?.passed).length
  return (
    <div className="space-y-4">
      <Panel title="Missions" sub="Twelve scored missions across four phases. Passing ten at 70% or more earns the course certificate (Phase 4).">
        <div className="grid grid-cols-3 gap-2 max-w-md"><Stat label="Passed" value={passed} tone="green" /><Stat label="Available now" value={MISSIONS.length} tone="blue" /><Stat label="For certificate" value="10 of 12" /></div>
      </Panel>
      <div className="grid md:grid-cols-2 gap-3">
        {MISSIONS.map((m) => {
          const r = latestRun(p, m.id)
          return (
            <Panel key={m.id} title={`${m.id} · ${m.title}`} sub={m.phase > 4 ? `Coming in Phase ${m.phase}` : `Phase ${m.phase} · Pass: ${m.pass}`} right={r?.score !== undefined ? <Pill tone={r.passed ? 'green' : 'red'}>{r.score}%</Pill> : r ? <Pill tone="blue">In progress</Pill> : m.phase > 4 ? <Pill>Locked</Pill> : null}>
              <p className="text-sm text-lab-text-muted">{m.brief}</p>
              {<Btn onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? 'Hide' : r ? 'Continue' : 'Start'}</Btn>}
            </Panel>
          )
        })}
      </div>
      {open === 'M1' && <M1 />}
      {open === 'M2' && <M2 />}
      {open === 'M3' && <M3 />}
      {open === 'M4' && <M4 />}
      {['M5', 'M6', 'M7', 'M8', 'M9', 'M10'].includes(open ?? '') && <Phase2Mission id={open!} />}
      {(open === 'M11' || open === 'M12') && <LockMission id={open} />}
      <Certificate />
    </div>
  )
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

function M1() {
  const { p, act } = useStore()
  const { go } = useNav()
  return (
    <Panel title="M1 · Fix the DMP" sub="Review the plan on the Start-up tab, then score your review here. You can score more than once; the latest score counts.">
      <div className="flex gap-2"><Btn onClick={() => go('startup')}>Open the DMP</Btn><Btn tone="solid" onClick={() => act((pp) => scoreM1(pp, startMission(pp, 'M1')))}>Score my review</Btn></div>
      <p className="text-xs text-lab-text-muted">{Object.keys(p.startup.dmpFlags).length} statements flagged so far.</p>
      <Result id="M1" />
    </Panel>
  )
}

function M2() {
  const { act } = useStore()
  const { go } = useNav()
  return (
    <Panel title="M2 · Test the checks" sub="Run the test cases on the Edit checks tab. Read each failing case, decide whether the check or the test is wrong (here, it is the check), fix the logic, re-run, and sign the UAT summary.">
      <div className="flex gap-2"><Btn onClick={() => go('checks')}>Open the edit checks</Btn><Btn tone="solid" onClick={() => act((pp) => scoreM2(pp, startMission(pp, 'M2')))}>Score my UAT</Btn></div>
      <Result id="M2" />
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
      {!p.live && (
        <div className="rounded border border-lab-amber/60 p-3 space-y-2">
          <p className="text-sm">The study is not live yet. Finish start-up yourself (missions M1 and M2 cover most of it), or use a prepared start-up: the training scenario corrects the faulty checks, runs UAT and signs. It is recorded in the audit trail as done by the scenario, not by you.</p>
          <Btn tone="amber" onClick={() => act((pp) => preparedStartup(pp))}>Use the prepared start-up</Btn>
        </div>
      )}
      {p.live && !activeRun && <Btn tone="solid" onClick={() => act((pp) => { startMission(pp, 'M3') })}>{run ? 'Start again' : 'Start the mission'}</Btn>}
      {activeRun && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Started" value={activeRun.answers?.start ?? ''} />
            <Stat label="Deadline" value={activeRun.answers?.deadline ?? ''} tone={p.clock > (activeRun.answers?.deadline ?? '') ? 'red' : 'grey'} />
            <Stat label="Study date" value={p.clock} tone="blue" />
            <Stat label="Site 103 issues resolved" value={`${st.filter((x) => x.resolved).length}/${st.length}`} tone="green" />
          </div>
          <p className="text-xs text-lab-text-muted">Work the queue for site 103: Queries (filter Site 103), the listings, and the casebook. Advance the clock to let the site answer. The issues behind the count stay hidden until you finish.</p>
          <div className="flex gap-2"><Btn onClick={() => go('queries')}>Queries</Btn><Btn tone="grey" onClick={() => go('listings')}>Listings</Btn><Btn tone="solid" onClick={() => act((pp) => scoreM3(pp, activeRun))}>Finish and score</Btn></div>
        </>
      )}
      <Result id="M3" />
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
    <Panel title="M4 · Write a good query" sub="For each finding, write the query you would send. Live feedback shows the rules; the score is the average.">
      {M4_SCENARIOS.map((s, i) => {
        const sc = scoreQuery(answers[s.id] ?? '', s.mention)
        return (
          <div key={s.id} className="space-y-1.5 border-t border-lab-line pt-3">
            <p className="text-sm"><span className="font-mono text-lab-fda">Scenario {String.fromCharCode(65 + i)}.</span> {s.data}</p>
            <TextArea aria-label={`Query for scenario ${String.fromCharCode(65 + i)}`} value={answers[s.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [s.id]: e.target.value })} />
            <QualityMeter score={sc.score} rules={sc.rules} />
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
      {!p.live && <div className="rounded border border-lab-amber/60 p-3 space-y-2"><p className="text-sm">The study must be live first.</p><Btn tone="amber" onClick={() => act((pp) => preparedStartup(pp))}>Use the prepared start-up</Btn></div>}
      <ul className="list-disc pl-5 text-xs text-lab-text-muted">{cfg.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      {p.live && !active && <Btn tone="solid" onClick={() => act((pp) => { startMission(pp, id) })}>{run ? 'Start again' : 'Start the mission'}</Btn>}
      {active && <>
        <p className="text-xs">Started on study date {active.answers?.start}{active.answers?.deadline ? ` · sign-off deadline ${active.answers.deadline}` : ''} · now {p.clock}</p>
        <div className="flex gap-2"><Btn onClick={() => go(cfg.view)}>{cfg.label}</Btn><Btn tone="solid" onClick={() => act((pp) => cfg.score(pp, active))}>Finish and score</Btn></div>
      </>}
      <Result id={id} />
    </Panel>
  )
}

import { createProject } from '../domain/project'
import { prepareForLock, prepareLocked, CLOSE_OUT_REPORT } from '../domain/lock'
import { saveProject } from '../domain/store'

function LockMission({ id }: { id: 'M11' | 'M12' }) {
  const { p, act, replace, setError } = useStore()
  const { go } = useNav()
  const [busy, setBusy] = useState(false)
  const run = latestRun(p, id)
  const active = run && run.score === undefined ? run : undefined
  const m = MISSIONS.find((x) => x.id === id)!
  const fresh = () => {
    setBusy(true)
    setTimeout(() => {
      try {
        const np = createProject(p.userId, p.classId)
        np.name = id === 'M11' ? 'M11 Lock on time' : 'M12 Unlock correctly'
        if (id === 'M11') prepareForLock(np); else prepareLocked(np)
        startMission(np, id)
        saveProject(p).finally(() => replace(np))
      } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
    }, 30)
  }
  return (
    <Panel title={`${m.id} · ${m.title}`} sub={m.brief}>
      {!active && <div className="space-y-2">
        <p className="text-xs text-lab-text-muted">This mission runs in a new project, prepared by the training scenario (its work is labelled as such in the audit trail). Your current project stays saved under Project → Saved projects.</p>
        {id === 'M12' && p.lock.status === 'hard' && <Btn tone="blue" onClick={() => act((pp) => { startMission(pp, 'M12') })}>Start in this hard-locked project</Btn>}
        <Btn tone="solid" disabled={busy} onClick={fresh}>{busy ? 'Preparing the study (a few seconds)…' : 'Start in a new project'}</Btn>
      </div>}
      {active && <>
        {id === 'M12' && <p className="text-sm text-lab-red">{CLOSE_OUT_REPORT}</p>}
        <p className="text-xs">Started on study date {active.answers?.start}{active.answers?.deadline ? ` · lock deadline ${active.answers.deadline}` : ''} · now {p.clock}</p>
        <ul className="list-disc pl-5 text-xs text-lab-text-muted">{(id === 'M11' ? ['The Lock tab lists what is still missing, with evidence.', 'Open queries need site answers: advance the clock, then close them.', 'The privacy problem is fixed by the site, through a query.', 'Sign casebooks as Dr Elena Marsh (PI, 5555); approve lock as Jonas Weber (2222) and Dr Hana Okafor (sponsor, 8888).'] : ['Request the unlock on the Lock tab for the one subject affected.', 'Raise the query on the subject’s AE log so the site enters the event (the query key is the AE term of a new record).', 'Then code and approve, SDV, re-sign the casebook, review the audit trail, and re-lock.']).map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="flex gap-2"><Btn onClick={() => go('lock')}>Open the Lock tab</Btn><Btn tone="solid" onClick={() => act((pp) => (id === 'M11' ? scoreM11 : scoreM12)(pp, active))}>Finish and score</Btn></div>
      </>}
      <Result id={id} />
    </Panel>
  )
}

function Certificate() {
  const { p } = useStore()
  const [name, setName] = useState('')
  const c = certificate(p, name || 'Learner')
  return (
    <Panel title="Certificate" sub="Pass ten of the twelve missions at 70% or more. The certificate shows a verification code made from your name, your scores and this project.">
      <p className="text-sm">{c.passed.length} of 12 missions passed.</p>
      {c.eligible ? (
        <div className="space-y-2">
          <input aria-label="Name on the certificate" className="w-full max-w-sm rounded-md border border-lab-line bg-lab-panel-strong px-2 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name as it should appear" />
          {name.trim() && <div id="certificate" className="rounded-lg border-2 border-lab-cdsco/70 p-6 text-center space-y-2 bg-lab-panel-strong/50">
            <p className="font-mono text-xs uppercase text-lab-text-muted">Certificate of completion · training</p>
            <p className="text-xl">{name.trim()}</p>
            <p className="text-sm">has completed the CDM Query &amp; Edit-Check Console course on the fictional study {STUDY_PROTOCOL}, passing {c.passed.length} of 12 scored missions:</p>
            <p className="text-xs text-lab-text-muted">{c.passed.map((r) => `${r.id} ${MISSIONS.find((m) => m.id === r.id)!.title} (${r.score}%)`).join(' · ')}</p>
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
