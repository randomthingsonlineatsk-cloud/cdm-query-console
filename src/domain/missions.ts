// Scored missions. Phase 1 has four; the rest are listed so the path to the certificate shows.

import type { MissionRun, Project } from './types'
import { scoreDmp, DMP_ERRORS } from './dmp'
import { CHECK_BUGS } from './checks'
import { runTest } from './engine'
import { seedStudy } from './seed'
import { advance, value, seedEntry, audit, SYSTEM, me, goLive, nowUtc } from './project'
import { isCorrect, expected as expectedCode } from './coding'
import { exactLlt } from './dictmed'
import { exactDrug } from './dictdrug'
import { discrepancies, statusOf, inScope } from './safety'
import { transferLog, shouldAccept, extDiscrepancies } from './external'
import { scoreQuery, isActive } from './queries'
import { addDays } from './util'
import { formKeyOf } from './types'

export interface MissionDef { id: string; phase: number; title: string; brief: string; pass: string }
export const MISSIONS: MissionDef[] = [
  { id: 'M1', phase: 1, title: 'Fix the DMP', brief: `The draft data management plan has ${DMP_ERRORS.length} statements that break regulation or good practice. Flag each one and choose the right correction. Flagging a correct statement costs half a point.`, pass: '70% or more' },
  { id: 'M2', phase: 1, title: 'Test the checks', brief: 'Run every UAT test case in the data validation specification. Three checks were programmed wrongly: find them, correct the logic, re-test until every case passes, and sign the UAT summary.', pass: '70% or more' },
  { id: 'M3', phase: 1, title: 'Clean a messy site', brief: 'Site 103 has a new study coordinator. In six simulated weeks, get every data issue at the site resolved: close good answers, re-query poor ones, and raise manual queries for what the checks cannot see. False queries and closing a query on wrong data cost points.', pass: '70% or more' },
  { id: 'M4', phase: 1, title: 'Write a good query', brief: 'Six data problems from manual review. Write the query you would send to the site for each. Queries are scored on the rules data managers use: name the data point, state what you saw, ask, do not lead, stay neutral, be brief.', pass: 'Average 70% or more' },
  { id: 'M5', phase: 2, title: 'Code the backlog', brief: 'Starting the mission moves the clock to 3 August 2026 if it is earlier. Code every term the auto-coder could not: pick the most accurate lowest-level term, choose the drug class that fits the indication, query terms that cannot be coded safely, then have the coding reviewer approve.', pass: '70% or more' },
  { id: 'M6', phase: 2, title: 'Reconcile SAEs before the cut-off', brief: 'Starting the mission moves the clock to 14 September 2026 and sets the data cut-off. Compare all twelve SAEs in the EDC with the safety database, class every discrepancy, get each one resolved, and have data management and drug safety sign off within three weeks. Safety queries are chased by the CRA, so sites answer them within a week.', pass: '70% or more' },
  { id: 'M7', phase: 2, title: 'Reconcile the central lab transfer', brief: 'Starting the mission moves the clock to 10 August 2026. Check every central-lab transfer against its data transfer agreement, load or reject it, reconcile the latest load against the EDC, and fix the unit problem at one site with a documented conversion rule.', pass: '70% or more' },
  { id: 'M8', phase: 2, title: 'Upgrade the dictionary', brief: 'Version 1.1 of the Study Medical Dictionary retires some terms and moves others. Review the impact, apply the upgrade with a signature, recode only what must be recoded, review the hierarchy changes and document the impact.', pass: '70% or more' },
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
  const jump = (target: string) => { if (!p.live) throw new Error('The study must be live. Finish start-up, or use the prepared start-up (mission M3).'); if (p.clock < target) advance(p, Math.round((Date.parse(target) - Date.parse(p.clock)) / 86400000)) }
  if (id === 'M5') { jump('2026-08-03'); run.answers = { start: p.clock } }
  if (id === 'M7') { jump('2026-08-10'); run.answers = { start: p.clock } }
  if (id === 'M6') {
    jump('2026-09-14')
    p.sae.cutoff = p.clock; p.sae.signoffDm = undefined; p.sae.signoffSafety = undefined
    run.answers = { start: p.clock, deadline: addDays(p.clock, 21), key: JSON.stringify(discrepancies(p).map((d) => ({ id: d.id, expected: d.expected, fk: d.pair.edc?.fk ?? '' }))) }
  }
  if (id === 'M8') {
    if (p.smdVersion !== '1.0') throw new Error('This project is already on version 1.1. Start a new project to repeat the upgrade.')
    if (!Object.values(p.coding).some((r) => r.code)) throw new Error('Nothing is coded yet. Go live and advance the clock first.')
    run.answers = { start: p.clock, startUtc: nowUtc(p) }
  }
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

// ---------- Phase 2 scoring ----------

const indicationOf = (p: Project, key: string) => value(p, key.replace(/\|CMTRT$/, '|CMINDC'))
const needsCoder = (r: { dict: string; verbatim: string }) => r.dict === 'SMD' ? !exactLlt(SMD10, r.verbatim) : !(exactDrug(r.verbatim)?.atc.length === 1)
import { SMD_10 as SMD10 } from './dictmed'

export function scoreM5(p: Project, run: MissionRun) {
  const all = Object.values(p.coding)
  const scope = all.filter((r) => needsCoder(r) && expectedCode(r.key.split('|')[2], r.verbatim, indicationOf(p, r.key), p.smdVersion))
  const right = scope.filter((r) => isCorrect(p, r, indicationOf(p, r.key)))
  const coded = all.filter((r) => r.status === 'coded' || r.status === 'approved')
  const approved = coded.filter((r) => r.status === 'approved').length
  const wrong = scope.filter((r) => (r.status === 'coded' || r.status === 'approved') && !isCorrect(p, r, indicationOf(p, r.key)))
  const score = 80 * (scope.length ? right.length / scope.length : 1) + 20 * (coded.length ? approved / coded.length : 0)
  finish(p, run, score, [`${right.length} of ${scope.length} terms that needed a coder handled correctly`, `${wrong.length} coded to the wrong term or class: ${wrong.map((r) => `"${r.verbatim}"`).join(', ') || 'none'}`, `${scope.filter((r) => r.status === 'uncoded').length} still uncoded`, `${approved} of ${coded.length} coded terms approved`])
}

export function scoreM6(p: Project, run: MissionRun) {
  const key: { id: string; expected: string; fk: string }[] = JSON.parse(run.answers?.key ?? '[]')
  let right = 0
  const detail: string[] = []
  for (const k of key) {
    const ok = k.expected === 'link' ? Object.keys(p.sae.links).length > 0 && (!k.fk || !!p.sae.links[k.fk]) : p.sae.decisions[k.id]?.cls === k.expected
    if (ok) right++; else detail.push(`${k.id.split('#')[1]} for ${k.id.split('|')[0] || k.id.split('~')[1]}: expected ${k.expected === 'link' ? 'a manual link to the misnumbered case' : k.expected}, got ${p.sae.decisions[k.id]?.cls ?? 'no decision'}`)
  }
  const open = discrepancies(p).filter((d) => inScope(p, d) && statusOf(p, d) !== 'accepted').length
  const dl = run.answers?.deadline ?? ''
  const signed = !!p.sae.signoffDm && !!p.sae.signoffSafety && p.sae.signoffDm.utc.slice(0, 10) <= dl && p.sae.signoffSafety.utc.slice(0, 10) <= dl
  const score = 60 * (key.length ? right / key.length : 0) + (open === 0 ? 20 : 0) + (signed ? 20 : 0)
  finish(p, run, score, [`${right} of ${key.length} discrepancies classed correctly`, ...detail, `${open} discrepancies still open or waiting`, signed ? 'Signed off by data management and drug safety by the deadline' : 'Not signed off by both by the deadline'])
}

export function scoreM7(p: Project, run: MissionRun) {
  const ts = transferLog(p.clock).filter((t) => t.vendor === 'CL')
  const tRight = ts.filter((t) => p.ext.transfers[t.id]?.status === (shouldAccept(p, t) ? 'accepted' : 'rejected')).length
  const ds = extDiscrepancies(p, 'CL')
  const decided = Object.entries(p.ext.decisions).filter(([id]) => id.startsWith('CL:'))
  const current = new Map(ds.map((d) => [d.id, d]))
  const dRight = decided.filter(([id, dec]) => !current.has(id) || current.get(id)!.expected === dec.cls).length
  const undecided = ds.filter((d) => !p.ext.decisions[d.id]).length
  const rule = p.ext.rules.find((r) => r.test === 'GLUC' && r.from === 'mg/dL' && r.to === 'mmol/L' && Math.abs(r.factor - 18.0) <= 0.2)
  const score = 30 * (ts.length ? tRight / ts.length : 0) + 40 * (decided.length + undecided ? dRight / (decided.length + undecided) : 0) + (rule ? 20 : 0) + (undecided === 0 ? 10 : 0)
  finish(p, run, score, [`${tRight} of ${ts.length} transfers correctly loaded or rejected`, `${dRight} of ${decided.length + undecided} discrepancies classed correctly`, `${undecided} discrepancies in the latest load not yet classed`, rule ? `Glucose conversion rule present (÷ ${rule.factor})` : 'No correct glucose mg/dL → mmol/L conversion rule'])
}

export function scoreM8(p: Project, run: MissionRun) {
  const up = p.smdUpgrade
  const recode = Object.values(p.coding).filter((r) => r.history.some((h) => h.action === 'upgrade: needs recoding'))
  const recodedOk = recode.filter((r) => (r.status === 'coded' || r.status === 'approved') && isCorrect(p, r))
  const reviewNeeded = Object.values(p.coding).filter((r) => r.history.some((h) => h.action === 'upgrade: hierarchy changed'))
  const reviewed = reviewNeeded.filter((r) => !r.review)
  const unnecessary = Object.values(p.coding).filter((r) => up && !r.history.some((h) => h.action.startsWith('upgrade')) && r.history.some((h) => h.action === 'coded' && h.utc > up.utc) && r.previous?.reason !== 'Verbatim changed at the site')
  const score = (up?.signature ? 20 : 0) + 50 * (recode.length ? recodedOk.length / recode.length : up ? 1 : 0) + 20 * (reviewNeeded.length ? reviewed.length / reviewNeeded.length : up ? 1 : 0) + ((up?.note.length ?? 0) >= 40 ? 10 : 0) - 5 * unnecessary.length
  finish(p, run, score, [up ? 'Upgrade applied with signature' : 'Upgrade not applied', `${recodedOk.length} of ${recode.length} retired terms recoded correctly`, `${reviewed.length} of ${reviewNeeded.length} hierarchy changes reviewed`, (up?.note.length ?? 0) >= 40 ? 'Impact documented' : 'Impact note missing or too short', `${unnecessary.length} unnecessary recodes`])
}
