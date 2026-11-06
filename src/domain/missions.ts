// Scored missions. Phase 1 has four; the rest are listed so the path to the certificate shows.

import type { MissionRun, Project } from './types'
import { scoreDmp, DMP_ERRORS } from './dmp'
import { CHECK_BUGS } from './checks'
import { runTest } from './engine'
import { seedStudy } from './seed'
import { advance, value, seedEntry, audit, SYSTEM, me, goLive } from './project'
import { scoreQuery, isActive } from './queries'
import { addDays } from './util'
import { formKeyOf } from './types'

export interface MissionDef { id: string; phase: number; title: string; brief: string; pass: string }
export const MISSIONS: MissionDef[] = [
  { id: 'M1', phase: 1, title: 'Fix the DMP', brief: `The draft data management plan has ${DMP_ERRORS.length} statements that break regulation or good practice. Flag each one and choose the right correction. Flagging a correct statement costs half a point.`, pass: '70% or more' },
  { id: 'M2', phase: 1, title: 'Test the checks', brief: 'Run every UAT test case in the data validation specification. Three checks were programmed wrongly: find them, correct the logic, re-test until every case passes, and sign the UAT summary.', pass: '70% or more' },
  { id: 'M3', phase: 1, title: 'Clean a messy site', brief: 'Site 103 has a new study coordinator. In six simulated weeks, get every data issue at the site resolved: close good answers, re-query poor ones, and raise manual queries for what the checks cannot see. False queries and closing a query on wrong data cost points.', pass: '70% or more' },
  { id: 'M4', phase: 1, title: 'Write a good query', brief: 'Six data problems from manual review. Write the query you would send to the site for each. Queries are scored on the rules data managers use: name the data point, state what you saw, ask, do not lead, stay neutral, be brief.', pass: 'Average 70% or more' },
  { id: 'M5', phase: 2, title: 'Code the backlog', brief: 'Review coder tasks and code AE and medication terms in the study dictionaries.', pass: 'Phase 2' },
  { id: 'M6', phase: 2, title: 'Reconcile SAEs before the cut-off', brief: 'Compare the EDC with the safety database and resolve every discrepancy before the data cut.', pass: 'Phase 2' },
  { id: 'M7', phase: 2, title: 'Reconcile the central lab transfer', brief: 'Match the vendor transfer to the EDC on keys, units and reference ranges under the data transfer agreement.', pass: 'Phase 2' },
  { id: 'M8', phase: 2, title: 'Upgrade the dictionary', brief: 'Assess and apply a dictionary version upgrade with a recoding review.', pass: 'Phase 2' },
  { id: 'M9', phase: 3, title: 'Spot the under-reporting site', brief: 'Use centralised monitoring to find the site with too few adverse events.', pass: 'Phase 3' },
  { id: 'M10', phase: 3, title: 'Keep within the QTLs', brief: 'Track quality tolerance limits and act on a breach.', pass: 'Phase 3' },
  { id: 'M11', phase: 4, title: 'Get to lock on time', brief: 'Complete the lock checklist and hard-lock the database by the planned date.', pass: 'Phase 4' },
  { id: 'M12', phase: 4, title: 'Unlock and correct', brief: 'Follow the unlock procedure for a late finding and re-lock.', pass: 'Phase 4' },
]

export const latestRun = (p: Project, id: string): MissionRun | undefined => [...p.missions].reverse().find((m) => m.id === id)

function finish(p: Project, run: MissionRun, score: number, detail: string[]) {
  run.endedUtc = new Date().toISOString(); run.score = Math.max(0, Math.min(100, Math.round(score))); run.passed = run.score >= 70; run.detail = detail
  audit(p, me(p), 'mission.finish', run.id, undefined, `${run.score}%`, run.passed ? 'Passed' : 'Not passed')
}
export function startMission(p: Project, id: string): MissionRun {
  const run: MissionRun = { id, startedUtc: new Date().toISOString(), userId: p.currentUserId, answers: {} }
  if (id === 'M3') {
    if (!p.live) throw new Error('The study must be live. Finish start-up, or use the prepared start-up.')
    const target = '2026-06-29'
    if (p.clock < target) advance(p, Math.round((Date.parse(target) - Date.parse(p.clock)) / 86400000))
    run.answers = { start: p.clock, deadline: addDays(p.clock, 42) }
  }
  p.missions.push(run)
  audit(p, me(p), 'mission.start', id, undefined, run.answers?.start ?? '', '')
  return run
}

export function scoreM1(p: Project, run: MissionRun) {
  const s = scoreDmp(p.startup.dmpFlags)
  finish(p, run, s.score, [`${s.right} of ${DMP_ERRORS.length} errors corrected`, `${s.wrongFix} flagged with the wrong correction`, `${s.falseFlag} correct statements flagged`, `${s.missed} errors not found`])
}

export function scoreM2(p: Project, run: MissionRun) {
  const total = p.checks.reduce((n, c) => n + c.tests.length, 0)
  const executed = new Set(p.startup.uat.map((u) => `${u.checkId}#${u.test}`)).size
  const fixed = Object.keys(CHECK_BUGS).filter((id) => { const c = p.checks.find((x) => x.id === id)!; return c.tests.every((t) => runTest(c, t) === t.fire) })
  const allPass = p.checks.every((c) => c.tests.every((t) => runTest(c, t) === t.fire))
  const signed = !!p.startup.uatSigned
  const score = 30 * Math.min(1, executed / total) + 20 * fixed.length + (signed && allPass ? 10 : 0)
  finish(p, run, score, [`${executed} of ${total} test cases executed`, `${fixed.length} of 3 faulty checks corrected (${fixed.join(', ') || 'none'})`, allPass ? 'Every test case now passes' : 'Some test cases still fail', signed ? 'UAT summary signed' : 'UAT summary not signed'])
}

export function siteIssueStatus(p: Project, site: string) {
  const issues = seedStudy().issues.filter((i) => i.site === site)
  return issues.map((i) => {
    const fk = `${i.subj}|${i.visit}|${i.form}|${i.inst}`
    const entered = !!p.forms[fk]
    const truth = seedEntry(fk)?.truth[i.field] ?? ''
    const qs = p.queries.filter((q) => formKeyOf(q.key) === fk)
    let resolved = false
    if (!entered) resolved = false
    else if ('listing' in i.find && i.find.listing === 'ae-dup') resolved = !!p.forms[fk].deleted
    else if ('listing' in i.find && i.find.listing === 'cm-ae') resolved = qs.some((q) => q.status === 'closed') && Object.keys(p.forms).some((k) => k.startsWith(`${i.subj}|LOG|AE|`) && value(p, `${k}|AETERM`) === 'Knee pain')
    else if (i.kind === 'error') resolved = value(p, `${fk}|${i.field}`) === truth && !qs.some(isActive)
    else resolved = qs.some((q) => q.status === 'closed' && q.msgs.some((m) => m.kind === 'close'))
    const closedWrong = i.kind === 'error' && entered && value(p, `${fk}|${i.field}`) !== truth && qs.some((q) => q.status === 'closed' && q.msgs.some((m) => m.kind === 'close'))
    return { issue: i, entered, resolved, closedWrong }
  })
}

export function scoreM3(p: Project, run: MissionRun) {
  const st = siteIssueStatus(p, '103').filter((x) => x.entered)
  const resolved = st.filter((x) => x.resolved).length
  const closedWrong = st.filter((x) => x.closedWrong).length
  const site = p.queries.filter((q) => q.key.startsWith('103-') && q.raisedUtc.slice(0, 10) >= (run.answers?.start ?? ''))
  const manual = site.filter((q) => q.source === 'manual')
  const falseQ = manual.filter((q) => { const fk = formKeyOf(q.key); const issue = seedStudy().issues.some((i) => `${i.subj}|${i.visit}|${i.form}|${i.inst}` === fk); const t = seedEntry(fk)?.truth[q.key.split('|')[4]]; return !issue && t !== undefined && q.msgs[0] && (q.valueAtClose ?? value(p, q.key)) === t }).length
  const open = p.queries.filter((q) => q.key.startsWith('103-') && isActive(q)).length
  const quality = manual.length ? manual.reduce((s, q) => s + scoreQuery(q.msgs[0].text).score, 0) / manual.length : 100
  const late = p.clock > (run.answers?.deadline ?? '9999')
  const score = 80 * (st.length ? resolved / st.length : 0) + 0.1 * quality + (open === 0 ? 10 : 0) - 3 * falseQ - 5 * closedWrong - (late ? 10 : 0)
  finish(p, run, score, [`${resolved} of ${st.length} issues at site 103 resolved`, `${open} queries still open or answered at site 103`, `${falseQ} false queries on correct data`, `${closedWrong} queries closed while the data were still wrong`, `Manual query quality ${Math.round(quality)}%`, late ? 'Finished after the deadline (−10)' : 'Finished by the deadline'])
}

export const M4_SCENARIOS = [
  { id: 'a', data: 'Subject 103-005, Week 4, Local laboratory: Potassium = 45 mmol/L. Screening value 4.4 mmol/L.', mention: ['potassium', 'K '] },
  { id: 'b', data: 'Subject 102-003, Adverse events #2: "Dizziness", start 2026-04-11, Ongoing = No, End date blank.', mention: ['end date', 'dizziness'] },
  { id: 'c', data: 'Subject 105-007, Concomitant medications #3: "Ibuprofen 400 mg" for "knee pain", start 2026-05-02. No adverse event of knee pain is recorded.', mention: ['knee pain', 'ibuprofen'] },
  { id: 'd', data: 'Subject 101-006, Week 8, Vital signs: SBP 132, 132, 132, 132 mmHg at Day 1, Week 2, Week 4 and Week 8 (DBP also identical at 86).', mention: ['blood pressure', 'sbp', 'systolic'] },
  { id: 'e', data: 'Subject 106-002, Week 2, Visit: visit date 2026-06-09, which is study day 22 (window days 12 to 18).', mention: ['visit date', 'window'] },
  { id: 'f', data: 'Subject 104-006, Adverse events #1: "Pneumonia", Serious = No, Requires hospitalisation = Yes.', mention: ['serious', 'hospital'] },
]
export function scoreM4(p: Project, run: MissionRun) {
  const per = M4_SCENARIOS.map((s) => scoreQuery(run.answers?.[s.id] ?? '', s.mention).score)
  const avg = per.reduce((a, b) => a + b, 0) / per.length
  finish(p, run, avg, per.map((s, i) => `Scenario ${String.fromCharCode(65 + i)}: ${s}%`))
}

// For learners who want to go straight to the live study: complete start-up as a prepared
// scenario. Recorded in the audit trail as done by the training scenario, not by the user.
export function preparedStartup(p: Project) {
  for (const [id, b] of Object.entries(CHECK_BUGS)) { const c = p.checks.find((x) => x.id === id)!; c.expr = b.correct }
  const utc = `${p.clock}T08:00:00Z`
  for (const c of p.checks) for (const t of c.tests) p.startup.uat.push({ checkId: c.id, test: t.name, expected: t.fire, actual: runTest(c, t), utc, userId: 'system' })
  const sig = (meaning: string, what: string) => ({ meaning, userId: 'system', role: 'system' as const, utc, what })
  p.startup.dmpApproved ??= sig('Approved (prepared scenario)', 'DMP')
  p.startup.ccgApproved ??= sig('Approved (prepared scenario)', 'CRF completion guidelines')
  p.startup.uatSigned ??= sig('UAT passed (prepared scenario)', 'UAT summary')
  p.startup.riskApproved ??= sig('Approved (prepared scenario)', 'Risk assessment')
  for (const u of p.users) u.trained = true
  p.startup.goLive ??= sig('Released (prepared scenario)', 'Go-live')
  audit(p, SYSTEM, 'startup.prepared', 'Start-up', undefined, 'complete', 'Start-up completed by the prepared training scenario', utc)
  goLive(p)
}
