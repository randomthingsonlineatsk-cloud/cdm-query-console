import { useStore } from '../../state'
import { useNav } from '../../App'
import { STUDY, SITES, VISITS, PROFILE_TEXT, FORMS } from '../../domain/study'
import { isActive } from '../../domain/queries'
import { value, me, audit } from '../../domain/project'
import { vaxSeed } from '../../domain/vax/seed'
import { compliance, viewOf, dcfVisible } from '../../domain/vax/diary'
import { AppLinks } from '../Links'
import { Panel, Pill, Stat, Table, Btn } from '../ui'

export default function VaxOverview() {
  const { p, act } = useStore()
  const u = me(p)
  const { go } = useNav()
  const subjects = new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))
  const dose = (n: 'D1' | 'D29') => Object.keys(p.forms).filter((k) => k.endsWith(`|${n}|VAX|1`) && value(p, `${k}|EXOCCUR`) === 'Y').length
  const c = compliance(p)
  const open = vaxSeed().vax.diary.filter((x) => viewOf(p, x) === 'open').length
  const dcf = dcfVisible(p).filter((r) => !p.vax?.dcf[r.id]).length
  return (
    <div className="space-y-4">
      <Panel title={STUDY.title} sub={`Protocol ${STUDY.protocol} · Sponsor ${STUDY.sponsor} · CRO ${STUDY.cro}`} right={<Pill tone="purple">Vaccine trial · e-diary</Pill>}>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <Stat label="Participants with data" value={subjects.size} />
          <Stat label="Dose 1 given" value={dose('D1')} tone="blue" />
          <Stat label="Dose 2 given" value={dose('D29')} tone="blue" />
          <Stat label="Diary completion" value={`${c.pct}%`} tone={c.pct >= 90 ? 'green' : 'amber'} />
          <Stat label="Diary days open now" value={open} tone={open ? 'amber' : 'grey'} />
          <Stat label="Active queries" value={p.queries.filter(isActive).length} tone="amber" />
        </div>
        <p className="text-xs text-lab-text-muted">{STUDY.design}. The study is observer-blind: you see no treatment allocation, and an unblinded pharmacist outside the data management team prepares the syringes. Solicited reactions come from the participants’ e-diary, an external electronic source held by the diary vendor; everything else is on the eCRF ({STUDY.cdash}). Controlled terminology is {STUDY.ctVersion}.</p>
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="What this study teaches" sub="Start-up, coding, SAE and lab reconciliation, oversight and lock are practised on HLV-204-201; here the focus is participant-reported data.">
          <ol className="space-y-1.5 text-sm list-decimal pl-5">
            <li><button className="text-left hover:text-lab-fda" onClick={() => go('diary', 'compliance')}>Watch diary compliance and alert sites while a day is still open</button></li>
            <li><button className="text-left hover:text-lab-fda" onClick={() => go('diary', 'data')}>Review diary data and the grades derived on the FDA 2007 scale</button></li>
            <li><button className="text-left hover:text-lab-fda" onClick={() => go('diary', 'dcf')}>Handle requests to change participant data{dcf ? ` (${dcf} waiting)` : ''}</button></li>
            <li><button className="text-left hover:text-lab-fda" onClick={() => go('diary', 'recon')}>Reconcile the diary with the eCRF, the vendor and the central lab</button></li>
            <li><button className="text-left hover:text-lab-fda" onClick={() => go('queries')}>Clean the eCRF: the edit checks raise queries as usual</button></li>
          </ol>
          <div className="flex gap-2"><Btn onClick={() => go('missions')}>Missions M14 to M17</Btn><Btn tone="grey" onClick={() => go('diary')}>Open the e-diary</Btn></div>
        </Panel>
        <Panel title="Schedule" sub="Day 1 is the first dose. Windows are in study days.">
          <Table head={['Visit or contact', 'Target day', 'Window', 'Forms']} rows={VISITS.map((v) => [v.name, v.id === 'UNS' ? '' : v.day, v.id === 'UNS' ? 'as needed' : v.lo === v.hi ? `day ${v.lo}` : `${v.lo} to ${v.hi}`, v.forms.map((f) => FORMS[f].name).join(', ')])} />
          <p className="text-[11px] text-lab-text-muted">E-diary: days 1 to 7 after each dose, one entry each evening, open until 12:00 the next day. Unsolicited AEs to 28 days after each dose; medically attended AEs and SAEs to Day 181.</p>
        </Panel>
      </div>
      <Panel title="Treatment allocation" sub="Observer-blind: data management, the CRA, the investigator and the participants do not know who received vaccine or placebo. Only the unblinded pharmacist, who prepares the syringes, holds the allocation." right={<Pill tone={u.role === 'pharm' ? 'red' : 'grey'}>{u.role === 'pharm' ? 'Unblinded view' : 'Blinded'}</Pill>}>
        {u.role !== 'pharm' ? <>
          <p className="text-sm">Not available to you as {u.name}. Blinded staff never see the allocation, and you should not try to work it out: local reactions are much more common after the vaccine than after saline, so reaction rates split by participant can point to the arm. Listings here are by participant, never by arm.</p>
          <p className="text-xs text-lab-text-muted">If an investigator needs to know the allocation to treat a participant, emergency unblinding goes through the IRT and the safety physician, not through data management. Switch to Lena Haas (unblinded pharmacist) in the user menu only to see how the separation works.</p>
        </> : <>
          <p className="text-xs text-lab-red">Unblinded information. Viewing it is recorded in the audit trail. Never share it with the blinded team.</p>
          {!p.audit.some((a) => a.action === 'allocation.view' && a.userId === u.id && a.utc.slice(0, 10) === p.clock)
            ? <Btn tone="red" onClick={() => act((pp) => audit(pp, me(pp), 'allocation.view', 'ALV-3-301 allocation', undefined, 'viewed', 'Unblinded pharmacist: syringe preparation'))}>Show the allocation (recorded)</Btn>
            : <Table head={['Participant', 'Site', 'Allocated to']} rows={vaxSeed().subjects.filter((s) => s.d1 && s.d1 <= p.clock).map((s) => [<span className="font-mono">{s.id}</span>, s.site, s.arm === 'ALV-3' ? 'Aurelivax (ALV-3)' : 'Saline placebo'])} empty="No participant has been dosed yet." />}
        </>}
      </Panel>
      <Panel title="Sites" sub="Each site behaves differently, as real sites do.">
        <Table head={['Site', 'Name', 'Country', 'Behaviour', 'Participants', 'Active queries']} rows={SITES.map((s) => [
          <span className="font-mono">{s.id}</span>, s.name, s.country, <span className="text-lab-text-muted">{PROFILE_TEXT[s.profile]}</span>,
          [...subjects].filter((x) => x.startsWith(s.id)).length, p.queries.filter((q) => isActive(q) && q.key.startsWith(s.id)).length,
        ])} />
        <p className="text-[11px] text-lab-text-muted">All names, sites and data are fictional. <Pill>Training</Pill></p>
      </Panel>
      <Panel title="Related apps" sub="The vaccine study's diary data map to SDTM through the CDISC Vaccines user guide (CE, FACE, VS, IS), the next step in the SDTM Mapping Trainer."><AppLinks ids={['sdtm', 'pvi', 'pvd', 'tlf']} /></Panel>
    </div>
  )
}
