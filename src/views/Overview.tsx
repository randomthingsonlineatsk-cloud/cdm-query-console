import { useStore } from '../state'
import { useNav } from '../App'
import { STUDY, SITES, VISITS, PROFILE_TEXT, FORMS } from '../domain/study'
import { isActive } from '../domain/queries'
import { outdatedSeed } from '../domain/project'
import { AppLinks } from './Links'
import { Panel, Pill, Stat, Table, Btn } from './ui'

export default function Overview() {
  const { p } = useStore()
  const { go } = useNav()
  const subjects = new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))
  const randomised = new Set(Object.keys(p.forms).filter((k) => k.includes('|D1|SV|')).map((k) => k.slice(0, 7)))
  const st = p.startup
  const steps = [
    { done: !!st.dmpApproved, text: 'Review and approve the data management plan', view: 'startup' as const },
    { done: !!st.ccgApproved, text: 'Approve the CRF completion guidelines', view: 'startup' as const },
    { done: !!st.uatSigned, text: 'Run UAT on every edit check and sign the summary', view: 'checks' as const },
    { done: !!st.riskApproved, text: 'Complete the risk assessment and set quality tolerance limits', view: 'startup' as const },
    { done: p.live, text: 'Release the database for data entry (go-live)', view: 'startup' as const },
    { done: p.live && p.clock > '2026-04-01', text: 'Advance the study clock; sites enter data and checks raise queries', view: 'queries' as const },
    { done: p.queries.some((q) => q.status === 'closed' && q.msgs.some((m) => m.kind === 'close')), text: 'Review answers: close, re-query or cancel', view: 'queries' as const },
  ]
  return (
    <div className="space-y-4">
      {outdatedSeed(p) && <div role="status" className="rounded border border-lab-amber/60 bg-lab-amber-soft px-3 py-2 text-sm text-lab-amber">This project was started with an earlier version of the study data. Coding and reconciliation work best on a new project: export this one if you want to keep it, then start a new project on the Project tab.</div>}
      <Panel title={STUDY.title} sub={`Protocol ${STUDY.protocol} · Sponsor ${STUDY.sponsor} · CRO ${STUDY.cro}`}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Subjects with data" value={subjects.size} />
          <Stat label="Randomised" value={randomised.size} tone="blue" />
          <Stat label="Forms entered" value={Object.values(p.forms).filter((f) => !f.deleted).length} />
          <Stat label="Active queries" value={p.queries.filter(isActive).length} tone="amber" />
          <Stat label="Coder tasks" value={p.coderTasks.filter((t) => t.status === 'pending').length} tone="purple" />
        </div>
        <p className="text-xs text-lab-text-muted">You are the data management team at the CRO for this study, from start-up to the cleaning of live data. Switch roles at the top to act as the site, the CRA, the coder or the investigator. The eCRF follows {STUDY.cdash}; controlled terminology is {STUDY.ctVersion}.</p>
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Where to start" sub="The study moves through the same steps as a real one.">
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={s.done ? 'text-lab-cdsco' : 'text-lab-amber'}>{s.done ? '●' : '○'}</span>
                <button className="text-left hover:text-lab-fda" onClick={() => go(s.view)}>{s.text}</button>
              </li>
            ))}
          </ol>
          <div className="flex gap-2"><Btn onClick={() => go('missions')}>Missions</Btn><Btn tone="grey" onClick={() => go('startup')}>Open start-up</Btn></div>
        </Panel>
        <Panel title="Visit schedule" sub="Study day 1 is randomisation. Windows are in study days.">
          <Table head={['Visit', 'Target day', 'Window', 'Forms']} rows={VISITS.map((v) => [v.name, v.day, v.id === 'SCR' ? 'day −28 to −1' : v.id === 'UNS' ? 'as needed' : `${v.lo} to ${v.hi}`, v.forms.map((f) => FORMS[f].name).join(', ')])} />
          <p className="text-[11px] text-lab-text-muted">Adverse events and concomitant medications are subject-level logs; medical history is taken at screening.</p>
        </Panel>
      </div>
      <Panel title="Sites" sub="Each site behaves differently, as real sites do. Their behaviour drives data entry lag, errors and query turnaround.">
        <Table head={['Site', 'Name', 'Country', 'Behaviour', 'Subjects', 'Active queries']} rows={SITES.map((s) => [
          <span className="font-mono">{s.id}</span>, s.name, s.country, <span className="text-lab-text-muted">{PROFILE_TEXT[s.profile]}</span>,
          [...subjects].filter((x) => x.startsWith(s.id)).length,
          p.queries.filter((q) => isActive(q) && q.key.startsWith(s.id)).length,
        ])} />
        <p className="text-[11px] text-lab-text-muted">All names, sites and data are fictional. <Pill>Training</Pill></p>
      </Panel>
      <Panel title="Companion apps" sub="Other apps in the same portfolio. Links open in a new tab; each app keeps its own data.">
        <AppLinks ids={['trial', 'edc', 'coding', 'sdtm', 'tlf', 'pvi', 'pvd', 'ectd']} />
      </Panel>
    </div>
  )
}
