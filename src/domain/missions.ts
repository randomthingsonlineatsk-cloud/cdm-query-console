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
import { signals, expectedFinding, qtlStatus, sdvState } from './oversight'
import { CLOSE_OUT_REPORT, piCurrent } from './lock'
import { CLOSE_OUT } from './seed'
import { scoreQuery, isActive } from './queries'
import { addDays } from './util'
import { formKeyOf, type Level } from './types'

export interface MissionDef { id: string; phase: number; title: string; brief: string; pass: string }
export const MISSIONS: MissionDef[] = [
  { id: 'M1', phase: 1, title: 'Fix the DMP', brief: `The draft data management plan has ${DMP_ERRORS.length} statements that break regulation or good practice. Flag each one and choose the right correction. Flagging a correct statement costs half a point.`, pass: '70% or more' },
  { id: 'M2', phase: 1, title: 'Test the checks', brief: 'A release of twelve edit checks is ready for UAT; the rest of the specification is already validated. Run the twelve checks’ test cases, find the two programmed wrongly, correct the logic, re-test until every case passes, and sign the UAT summary.', pass: '70% or more' },
  { id: 'M3', phase: 1, title: 'Clean a messy site', brief: 'Site 103 has a new study coordinator. In six simulated weeks, get every data issue at the site resolved: close good answers, re-query poor ones, and raise manual queries for what the checks cannot see. False queries and closing a query on wrong data cost points.', pass: '70% or more' },
  { id: 'M4', phase: 1, title: 'Write a good query', brief: 'Ten queries written by a hurried colleague: leading, vague, shouting or blaming. Rewrite each one so it is neutral, specific and answerable. Queries are scored on the rules data managers use: name the data point, state what you saw, ask, do not lead, stay neutral, be brief.', pass: 'Average 70% or more' },
  { id: 'M5', phase: 2, title: 'Code the AEs', brief: 'The auto-coder is switched off for adverse events, and 30 AE verbatims wait for coding on 3 August 2026. Code each to the most accurate lowest-level term, prefer a diagnosis to its symptoms, query combined or ambiguous terms instead of coding them, then have the coding reviewer approve.', pass: '70% or more' },
  { id: 'M6', phase: 2, title: 'Reconcile SAEs before the cut-off', brief: 'Starting the mission moves the clock to 14 September 2026 and sets the data cut-off. Compare all twelve SAEs in the EDC with the safety database, class every discrepancy, get each one resolved, and have data management and drug safety sign off within three weeks. Safety queries are chased by the CRA, so sites answer them within a week.', pass: '70% or more' },
  { id: 'M7', phase: 2, title: 'Reconcile the central lab transfer', brief: 'Starting the mission moves the clock to 10 August 2026. Check every central-lab transfer against its data transfer agreement, load or reject it, reconcile the latest load against the EDC, and fix the unit problem at one site with a documented conversion rule.', pass: '70% or more' },
  { id: 'M8', phase: 2, title: 'Upgrade the dictionary', brief: 'Version 1.1 of the Study Medical Dictionary retires some terms and moves others. Review the impact, apply the upgrade with a signature, recode only what must be recoded, review the hierarchy changes and document the impact.', pass: '70% or more' },
  { id: 'M9', phase: 3, title: 'Spot the suspicious sites', brief: 'Starting the mission moves the clock to 31 August 2026. Review every flag in centralised monitoring. Decide which are real problems and act on them (a for-cause visit, retraining or escalation), and record why the others need no action. Then let the for-cause visit happen.', pass: '70% or more' },
  { id: 'M10', phase: 3, title: 'Keep within the QTLs', brief: 'Starting the mission moves the clock to 5 October 2026. Check the quality tolerance limits, find the one that is breached, record its root cause and corrective action with a signature, and log and classify the deviations behind it.', pass: '70% or more' },
  { id: 'M11', phase: 4, title: 'Lock on time', brief: 'Runs in a new project prepared to just after last subject last visit, with most of the cleaning done. In 30 study days, finish what is left (open queries, uncoded terms, SDV at two subjects, unclassified deviations, a privacy problem, the investigator signatures and the audit trail review), soft-lock, and hard-lock with the lead data manager’s and the sponsor’s signatures.', pass: '70% or more' },
  { id: 'M13', phase: 4, title: 'Audit the trail', brief: 'Before relying on site 106’s electronic source system, audit an extract of its audit trail. For each of the twenty entries, name the ALCOA+ attribute it breaks, or mark it as fine. Twelve entries break one attribute each.', pass: '70% or more' },
  { id: 'M12', phase: 4, title: 'Unlock correctly', brief: 'After hard lock, the close-out visit finds an adverse event that was never entered. Follow the unlock procedure: a justified request limited to the affected subject, two approvals, the correction through a query, re-coding, re-SDV and a new investigator signature, then re-lock.', pass: '70% or more' },
]

export const latestRun = (p: Project, id: string): MissionRun | undefined => [...p.missions].reverse().find((m) => m.id === id)

export const LEVEL_TEXT: Record<Level, string> = { guided: 'Guided: tips, a progress check while you work, and 50% more time.', standard: 'Standard: tips and the usual time.', expert: 'Expert: no tips or live feedback, 25% less time, and mistakes cost double.' }
const k = (run: MissionRun) => (run.level === 'expert' ? 2 : 1)
const days = (p: Project, n: number) => Math.round(n * ({ guided: 1.5, standard: 1, expert: 0.75 }[p.missionLevel ?? 'standard']))
function finish(p: Project, run: MissionRun, score: number, detail: string[]) {
  run.endedUtc = new Date().toISOString(); run.score = Math.max(0, Math.min(100, Math.round(score))); run.passed = run.score >= 70; run.detail = [...detail, `Level: ${run.level ?? 'standard'}`]
  audit(p, me(p), 'mission.finish', run.id, undefined, `${run.score}%`, run.passed ? 'Passed' : 'Not passed')
}
export function startMission(p: Project, id: string): MissionRun {
  const run: MissionRun = { id, startedUtc: new Date().toISOString(), userId: p.currentUserId, answers: {}, level: p.missionLevel ?? 'standard' }
  const jump = (target: string) => { if (!p.live) throw new Error('The study must be live. Finish start-up, or use the prepared start-up (mission M3).'); if (p.clock < target) advance(p, Math.round((Date.parse(target) - Date.parse(p.clock)) / 86400000)) }
  if (id === 'M2') {
    run.answers = { startUtc: nowUtc(p), scope: JSON.stringify(M2_SCOPE) }
  }
  if (id === 'M5') {
    p.noAutoAe = true
    jump('2026-08-03')
    const ae = Object.values(p.coding).filter((r) => r.key.split('|')[2] === 'AE' && r.status === 'uncoded').sort((a, b) => Number(!needsCoder(a)) - Number(!needsCoder(b)) || a.key.localeCompare(b.key))
    run.answers = { start: p.clock, scope: JSON.stringify(ae.slice(0, 30).map((r) => r.key)) }
  }
  if (id === 'M7') { jump('2026-08-10'); run.answers = { start: p.clock } }
  if (id === 'M6') {
    jump('2026-09-14')
    p.sae.cutoff = p.clock; p.sae.signoffDm = undefined; p.sae.signoffSafety = undefined
    run.answers = { start: p.clock, deadline: addDays(p.clock, days(p, 21)), key: JSON.stringify(discrepancies(p).map((d) => ({ id: d.id, expected: d.expected, fk: d.pair.edc?.fk ?? '' }))) }
  }
  if (id === 'M8') {
    if (p.smdVersion !== '1.0') throw new Error('This project is already on version 1.1. Start a new project to repeat the upgrade.')
    if (!Object.values(p.coding).some((r) => r.code)) throw new Error('Nothing is coded yet. Go live and advance the clock first.')
    run.answers = { start: p.clock, startUtc: nowUtc(p) }
  }
  if (id === 'M9') { jump('2026-08-31'); run.answers = { start: p.clock, flags: JSON.stringify(signals(p).filter((x) => x.flagged).map((x) => x.id)) } }
  if (id === 'M10') { jump('2026-10-05'); run.answers = { start: p.clock, startUtc: nowUtc(p) } }
  if (id === 'M11') { run.answers = { start: p.clock, deadline: addDays(p.clock, days(p, 30)), startUtc: nowUtc(p) } }
  if (id === 'M12') { if (p.lock.status !== 'hard') throw new Error('M12 needs a hard-locked study.'); run.answers = { start: p.clock, startUtc: nowUtc(p), report: CLOSE_OUT_REPORT } }
  if (id === 'M3') {
    if (!p.live) throw new Error('The study must be live. Finish start-up, or use the prepared start-up.')
    const target = '2026-06-29'
    if (p.clock < target) advance(p, Math.round((Date.parse(target) - Date.parse(p.clock)) / 86400000))
    run.answers = { start: p.clock, deadline: addDays(p.clock, days(p, 42)) }
  }
  p.missions.push(run)
  audit(p, me(p), 'mission.start', id, undefined, run.answers?.start ?? '', '')
  return run
}

export function scoreM1(p: Project, run: MissionRun) {
  const s = scoreDmp(p.startup.dmpFlags)
  const sc = k(run) === 2 ? Math.max(0, Math.round(((s.right - s.falseFlag) / DMP_ERRORS.length) * 100)) : s.score
  finish(p, run, sc, [`${s.right} of ${DMP_ERRORS.length} errors corrected`, `${s.wrongFix} flagged with the wrong correction`, `${s.falseFlag} correct statements flagged`, `${s.missed} errors not found`])
}

export const M2_SCOPE = ['SV-04', 'VS-07', 'VS-08', 'VS-09', 'VS-10', 'LB-07', 'LB-08', 'LB-09', 'AE-10', 'AE-13', 'EX-07', 'CM-10']
export function scoreM2(p: Project, run: MissionRun) {
  const scope: string[] = run.answers?.scope ? JSON.parse(run.answers.scope) : p.checks.map((c) => c.id)
  const checks = p.checks.filter((c) => scope.includes(c.id))
  const total = checks.reduce((n, c) => n + c.tests.length, 0)
  const executed = new Set(p.startup.uat.filter((u) => scope.includes(u.checkId) && u.utc >= (run.answers?.startUtc ?? '')).map((u) => `${u.checkId}#${u.test}`)).size
  const bugs = Object.keys(CHECK_BUGS).filter((id) => scope.includes(id))
  const fixed = bugs.filter((id) => { const c = p.checks.find((x) => x.id === id)!; return c.tests.every((t) => runTest(c, t) === t.fire) })
  const allPass = checks.every((c) => c.tests.every((t) => runTest(c, t) === t.fire))
  const signed = !!p.startup.uatSigned
  const score = 30 * Math.min(1, executed / total) + (60 / bugs.length) * fixed.length + (signed && allPass ? 10 : 0)
  finish(p, run, score, [`${executed} of ${total} test cases executed in the ${checks.length} checks under test`, `${fixed.length} of ${bugs.length} faulty checks corrected (${fixed.join(', ') || 'none'})`, allPass ? 'Every test case now passes' : 'Some test cases still fail', signed ? 'UAT summary signed' : 'UAT summary not signed'])
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
  const score = 80 * (st.length ? resolved / st.length : 0) + 0.1 * quality + (open === 0 ? 10 : 0) - 3 * k(run) * falseQ - 5 * k(run) * closedWrong - (late ? 10 : 0)
  finish(p, run, score, [`${resolved} of ${st.length} issues at site 103 resolved`, `${open} queries still open or answered at site 103`, `${falseQ} false queries on correct data`, `${closedWrong} queries closed while the data were still wrong`, `Manual query quality ${Math.round(quality)}%`, late ? 'Finished after the deadline (−10)' : 'Finished by the deadline'])
}

export const M4_SCENARIOS = [
  { id: 'a', data: 'Subject 103-005, Week 4, Local laboratory: Potassium = 45 mmol/L (screening 4.4 mmol/L).', poor: 'Potassium is wrong, please change to 4.5.', mention: ['potassium'] },
  { id: 'b', data: 'Subject 102-003, AE #2 "Dizziness": Ongoing = No, end date blank.', poor: 'END DATE MISSING!!', mention: ['end date', 'dizziness'] },
  { id: 'c', data: 'Subject 105-007, CM #3 "Ibuprofen 400 mg" for "knee pain", started 2026-05-02. No AE of knee pain.', poor: 'You forgot to report an AE again. Please add knee pain as an AE.', mention: ['knee pain', 'ibuprofen'] },
  { id: 'd', data: 'Subject 101-006: SBP 132/86 mmHg at Day 1, Week 2, Week 4 and Week 8.', poor: 'BP values copied?', mention: ['blood pressure', 'systolic', 'sbp'] },
  { id: 'e', data: 'Subject 106-002, Week 2 visit on 2026-06-09: study day 22, window days 12 to 18.', poor: 'Visit is out of window, should be within days 12-18, please correct the date.', mention: ['visit date', 'window'] },
  { id: 'f', data: 'Subject 104-006, AE #1 "Pneumonia": Serious = No, Requires hospitalisation = Yes.', poor: 'Serious must be Yes.', mention: ['serious', 'hospital'] },
  { id: 'g', data: 'Subject 103-009, Week 2, Study drug: kit number "2094".', poor: 'Kit no. format err', mention: ['kit'] },
  { id: 'h', data: 'Subject 101-003, Informed consent: version v1.0 recorded; v2.0 was current when the site opened.', poor: 'Wrong ICF version entered. Change to v2.0.', mention: ['consent', 'version'] },
  { id: 'i', data: 'Subject 105-006, Week 4, Local laboratory: fasting glucose 111 with unit mmol/L.', poor: 'Glucose obviously in mg/dL, update the unit.', mention: ['glucose', 'unit'] },
  { id: 'j', data: 'Subject 102-007, Demographics: year of birth 1931, giving age 95 at consent (inclusion IN01: 18 to 75).', poor: 'Pt too old, ineligible. Explain.', mention: ['year of birth', 'birth'] },
]
export function scoreM4(p: Project, run: MissionRun) {
  const per = M4_SCENARIOS.map((s) => { const t = (run.answers?.[s.id] ?? '').trim(); return t && t !== s.poor ? scoreQuery(t, s.mention).score : 0 })
  const avg = per.reduce((a, b) => a + b, 0) / per.length
  finish(p, run, avg, per.map((s, i) => `Query ${String.fromCharCode(65 + i)}: ${s}%`))
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
  const keys: string[] | undefined = run.answers?.scope ? JSON.parse(run.answers.scope) : undefined
  const scope = keys ? keys.map((k) => p.coding[k]).filter(Boolean) : all.filter((r) => needsCoder(r) && expectedCode(r.key.split('|')[2], r.verbatim, indicationOf(p, r.key), p.smdVersion))
  const right = scope.filter((r) => isCorrect(p, r, indicationOf(p, r.key)))
  const coded = (keys ? scope : all).filter((r) => r.status === 'coded' || r.status === 'approved')
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

export function scoreM9(p: Project, run: MissionRun) {
  const flags: string[] = JSON.parse(run.answers?.flags ?? '[]')
  const sigs = new Map(signals(p).map((x) => [x.id, x]))
  let right = 0
  const detail: string[] = []
  for (const id of flags) {
    const s = sigs.get(id); const dec = p.monitoring.decisions[id]
    const exp = s ? expectedFinding(s) : { finding: 'explained' as const, why: '' }
    const ok = !!dec && (exp.finding === 'either' || dec.finding === exp.finding) && (dec.finding === 'explained' || (exp.actions ?? []).includes(dec.action))
    if (ok) right++; else detail.push(`${id}: expected ${exp.finding === 'action' ? `action (${exp.actions!.join(' or ')})` : 'explained, no action'} (${'why' in exp ? exp.why : ''}), got ${dec ? dec.finding + (dec.action ? ` (${dec.action})` : '') : 'no decision'}`)
  }
  const visit = String(p.monitoring.forCause['104'] ?? '').startsWith('done')
  const falseActions = flags.filter((id) => { const s = sigs.get(id); return s && expectedFinding(s).finding === 'explained' && p.monitoring.decisions[id]?.finding === 'action' }).length
  const score = 70 * (flags.length ? right / flags.length : 0) + (visit ? 20 : 0) + (falseActions === 0 ? 10 : 0) - (k(run) - 1) * 10 * falseActions
  finish(p, run, score, [`${right} of ${flags.length} flags handled correctly`, ...detail, visit ? 'For-cause visit at site 104 done; the missing AEs are now in the EDC' : 'No for-cause visit at site 104 yet (advance the clock after planning it)', `${falseActions} actions on flags that needed none`])
}

export function scoreM10(p: Project, run: MissionRun) {
  const st = qtlStatus(p)
  const breached = st.filter((x) => x.state === 'breached').map((x) => x.id)
  const logged = p.qtlLog.filter((l) => l.utc >= (run.answers?.startUtc ?? ''))
  const hit = breached.filter((id) => logged.some((l) => l.qtl === id))
  const falseLogs = logged.filter((l) => !breached.includes(l.qtl)).length
  const late = safetyDbLate(p)
  const dvs = p.deviations.filter((d) => d.category === 'Safety reporting' && late.includes(d.subj))
  const dvOk = late.filter((s) => dvs.some((d) => d.subj === s && d.important === true)).length
  const score = 50 * (breached.length ? hit.length / breached.length : 1) + 30 * (late.length ? dvOk / late.length : 1) + (falseLogs === 0 ? 20 : 0) - (k(run) - 1) * 10 * falseLogs
  finish(p, run, score, [`${hit.length} of ${breached.length} breached limits recorded with root cause and action`, `${dvOk} of ${late.length} late SAE reports logged as important safety-reporting deviations`, `${falseLogs} breach records for limits that were not breached`])
}
import { safetyDb } from './safety'
import { daysBetween as dBetween } from './util'
const safetyDbLate = (p: Project) => safetyDb(p).filter((c) => dBetween(c.aware, c.received) > 1).map((c) => c.subj)

export function scoreM11(p: Project, run: MissionRun) {
  const hard = p.lock.events.find((e) => e.action === 'hard')
  const onTime = !!hard && hard.utc.slice(0, 10) <= (run.answers?.deadline ?? '')
  const priv = Object.values(p.items).find((it) => it.key.endsWith('|AECOM') && it.versions.some((v) => /98201/.test(v.value)))
  const privOk = !!priv && priv.versions.at(-1)!.role === 'site' && !/98201/.test(priv.versions.at(-1)!.value)
  const review = p.lock.auditReview && !p.lock.auditReview.userId.startsWith('scenario')
  const pi = Object.values(p.lock.piSign).some((x) => x.userId === 'emarsh')
  const score = (onTime ? 60 : hard ? 30 : 0) + (privOk ? 15 : 0) + (review ? 10 : 0) + (pi ? 15 : 0)
  finish(p, run, score, [hard ? `Hard-locked on ${hard.utc.slice(0, 10)}${onTime ? ', within 30 study days' : ', after the deadline'}` : 'Not hard-locked', privOk ? 'Personal data removed by the site in answer to a query' : 'Personal data in the comment not removed through a query', review ? 'Audit trail review recorded' : 'No audit trail review by you', pi ? 'Investigator signed the casebooks' : 'No investigator signature'])
}

export function scoreM12(p: Project, run: MissionRun) {
  const since = run.answers?.startUtc ?? ''
  const r = p.lock.unlocks.find((x) => x.utc >= since)
  const scope = r ? (r.subjects.length === 1 && r.subjects[0] === CLOSE_OUT.subj ? 20 : r.subjects.includes(CLOSE_OUT.subj) ? 10 : 0) : 0
  const just = r && new RegExp(`${CLOSE_OUT.subj}|nose`, 'i').test(r.justification) ? 10 : 0
  const appr = r && r.approvals.some((a) => a.role === 'dmlead') && r.approvals.some((a) => a.role === 'sponsor') ? 10 : 0
  const fk = `${CLOSE_OUT.subj}|LOG|AE|${CLOSE_OUT.inst}`
  const entered = p.forms[fk] ? 20 : 0
  const cod = p.coding[`${fk}|AETERM`]?.status === 'approved'
  const sdv = ['AETERM', 'AESTDAT', 'AESER'].every((f) => sdvState(p, `${fk}|${f}`) === 'verified')
  const pi = piCurrent(p, CLOSE_OUT.subj) && p.lock.piSign[CLOSE_OUT.subj].utc >= since
  const follow = ((cod ? 1 : 0) + (sdv ? 1 : 0) + (pi ? 1 : 0)) / 3 * 20
  const relock = r?.status === 'relocked' ? 20 : 0
  finish(p, run, scope + just + appr + entered + follow + relock, [r ? `Unlock request ${r.id} for ${r.subjects.join(', ')}` : 'No unlock request', just ? 'Justification names the finding' : 'Justification does not name the subject or the finding', appr ? 'Approved by the lead data manager and the sponsor' : 'Not approved by both', entered ? 'The AE was entered by the site' : 'The AE is not in the EDC', `New AE coded and approved: ${cod ? 'yes' : 'no'}; SDV: ${sdv ? 'yes' : 'no'}; investigator re-signed: ${pi ? 'yes' : 'no'}`, relock ? 'Re-locked' : 'Not re-locked'])
}

// Certificate: ten of the twelve missions passed at 70% or more, with a verification code.
export function scoreM13(p: Project, run: MissionRun) {
  const r = scoreExtract(run.answers ?? {})
  finish(p, run, r.score - (k(run) - 1) * 5 * r.falseFlags, [`${r.found} of ${r.violations} violations named correctly`, `${r.falseFlags} sound entries flagged as violations`, `${r.unanswered} entries not reviewed`])
}

export function certificate(runs: MissionRun[], userId: string, name: string) {
  const passed = MISSIONS.map((m) => runs.filter((r) => r.id === m.id && r.passed).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]).filter((r): r is MissionRun => !!r)
  const code = hashStr(`${name.trim().toLowerCase()}|${passed.map((r) => `${r.id}:${r.score}`).join(',')}|${userId}`).slice(-10).toUpperCase()
  return { eligible: passed.length >= 10, passed, code: `CDM-${code.slice(0, 5)}-${code.slice(5)}` }
}
import { hash as hashStr } from './util'
import { scoreExtract } from './alcoa'

// A progress check for guided runs: score a copy of the project without finishing the run.
export const SCORERS: Record<string, (p: Project, r: MissionRun) => void> = {}
export function progress(p: Project, run: MissionRun): { score: number; detail: string[] } | null {
  const f = SCORERS[run.id]; if (!f) return null
  const c: Project = structuredClone(p)
  const r = c.missions.find((x) => x.id === run.id && x.startedUtc === run.startedUtc) ?? { ...run }
  f(c, r)
  return { score: r.score ?? 0, detail: (r.detail ?? []).filter((d) => !d.startsWith('Level:')) }
}
Object.assign(SCORERS, { M1: scoreM1, M2: scoreM2, M3: scoreM3, M5: scoreM5, M6: scoreM6, M7: scoreM7, M8: scoreM8, M9: scoreM9, M10: scoreM10, M11: scoreM11, M12: scoreM12 })

// Every mission starts from its own prepared project (a snapshot of the study at the right
// moment); the learner's other projects are left untouched.
export const MISSION_PROJECT: Record<string, 'fresh' | 'live' | 'lock' | 'locked' | 'none'> = { M1: 'fresh', M2: 'fresh', M3: 'live', M4: 'none', M5: 'live', M6: 'live', M7: 'live', M8: 'live', M9: 'live', M10: 'live', M11: 'lock', M12: 'locked', M13: 'none' }
export function prepareMission(base: Project, id: string, create: (userId: string, classId: string) => Project, prep: { lock: (p: Project) => void; locked: (p: Project) => void }): Project {
  const np = create(base.userId, base.classId)
  np.name = `${id} ${MISSIONS.find((m) => m.id === id)!.title}`
  np.missionLevel = base.missionLevel
  const kind = MISSION_PROJECT[id]
  if (id === 'M2') {
    // Everything outside the release is already validated: its UAT results are on file and its logic is correct.
    for (const c of np.checks) {
      if (M2_SCOPE.includes(c.id)) continue
      if (CHECK_BUGS[c.id]) c.expr = CHECK_BUGS[c.id].correct
      for (const t of c.tests) np.startup.uat.push({ checkId: c.id, test: t.name, expected: t.fire, actual: runTest(c, t), utc: `${np.clock}T08:00:00Z`, userId: 'system' })
    }
    audit(np, SYSTEM, 'scenario.prepare', 'UAT release 1.1', undefined, '12 checks under test', 'Checks outside the release were validated in release 1.0')
  }
  if (id === 'M8') { np.currentUserId = 'tibarra' }
  if (kind === 'live') preparedStartup(np)
  if (id === 'M8') {
    advance(np, 150)
    // A coded study to upgrade: the scenario codes what the auto-coder left.
    np.users.push({ id: 'scenario-coder', name: 'Training scenario (Medical coder)', role: 'coder', pin: '', trained: true })
    np.currentUserId = 'scenario-coder'
    for (const r of Object.values(np.coding)) if (r.status === 'uncoded') { const e = expectedCode(r.key.split('|')[2], r.verbatim, indicationOf(np, r.key)); if (e?.kind === 'pt') { const llt = [...SMD10.terms.values()].find((t) => t.level === 'LLT' && t.current && t.name.toLowerCase() === r.verbatim.toLowerCase()) ?? [...SMD10.terms.values()].find((t) => t.level === 'LLT' && t.current && ptOf10(t.code) === e.pt); if (llt) codeTermFn(np, r.key, llt.code, undefined, false) } }
    np.currentUserId = 'arao'
  }
  if (kind === 'lock') prep.lock(np)
  if (kind === 'locked') prep.locked(np)
  startMission(np, id)
  return np
}
import { codeTerm as codeTermFn } from './coding'
import { ptOf } from './dictmed'
const ptOf10 = (code: string) => ptOf(SMD10, code)?.name
