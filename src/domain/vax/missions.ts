// Missions M14 to M17 on the vaccine study ALV-3-301.

import type { MissionRun, Project } from '../types'
import { addDays } from '../util'
import { vaxSeed } from './seed'
import { compliance, reconRows, dayKey } from './diary'

export const VAX_MISSIONS = [
  { id: 'M14', phase: 5, title: 'Keep the diary complete', brief: 'Runs in a new vaccine-study project on the day before the first dose. For the next 16 study days, check diary compliance every day and alert the site about every diary day still open, while the participant can still complete it (until 12:00 the next day). A missed day cannot be recovered later.', pass: '70% or more (completion and timely alerts)' },
  { id: 'M15', phase: 5, title: 'Correct participant data', brief: 'Runs in a vaccine-study project after the first diaries are in. Six requests to change e-diary data have arrived from sites and a monitor. The diary is electronic source: send a data clarification form to the vendor only where a justified, contemporaneous source supports the change, with the right value; return the rest with the reason.', pass: '70% or more (5 of 6)' },
  { id: 'M16', phase: 5, title: 'Reconcile the diary', brief: 'Runs in a vaccine-study project after the second doses. Work through the reconciliation worksheet: diary against the eCRF, the vendor’s device links and the central lab. Mark each row as matching, or route the discrepancy to the site or to the vendor.', pass: '70% or more' },
  { id: 'M17', phase: 5, title: 'Review the diary trail', brief: 'An extract of the e-diary audit trail for site 203, exported for a sponsor audit. For each of the twenty entries, name the problem the reviewer should raise, or mark it as fine.', pass: '70% or more' },
]
export const VAX_MISSION_IDS = VAX_MISSIONS.map((m) => m.id)
export const M14_DAYS = 16

export function startVaxMission(p: Project, run: MissionRun, days: (n: number) => number) {
  if (run.id === 'M14') run.answers = { start: p.clock, deadline: addDays(p.clock, days(M14_DAYS)) }
  if (run.id === 'M15') run.answers = { start: p.clock }
  if (run.id === 'M16') run.answers = { start: p.clock, key: JSON.stringify(reconRows(p).map((r) => ({ id: r.id, expected: r.expected }))) }
}
// The clock a prepared project is moved to before the mission starts.
export const vaxMissionClock = (id: string) => id === 'M15' ? addDays(vaxSeed().vax.requests.map((r) => r.date).sort().pop()!, 1) : id === 'M16' ? '2026-06-22' : undefined

export function scoreM14(p: Project, run: MissionRun) {
  const start = run.answers?.start ?? p.clock, deadline = run.answers?.deadline ?? p.clock
  const end = p.clock < deadline ? p.clock : deadline
  const c = compliance(p, addDays(start, 1), addDays(end, -2))
  const opened = Object.entries(p.vax?.days ?? {}).filter(([, d]) => d.openedOn && d.openedOn > start && d.openedOn <= end)
  const timely = opened.filter(([, d]) => d.alertDate && d.alertDate === d.openedOn).length
  const compPts = Math.max(0, Math.min(50, ((c.pct - 85) / 12) * 50))
  const alertPts = opened.length ? (timely / opened.length) * 50 : 50
  const k = run.level === 'expert' ? 2 : 1
  const early = p.clock < deadline ? 10 * k : 0
  return { score: compPts + alertPts - early, detail: [`Diary completion ${c.pct}% (${c.entered} of ${c.due} days due)`, `${timely} of ${opened.length} open diary days alerted while still open`, early ? `Finished before the ${M14_DAYS}-day period ended` : `Period ended ${deadline}`] }
}

export function scoreM15(p: Project, run: MissionRun) {
  const reqs = vaxSeed().vax.requests
  const dec = p.vax?.dcf ?? {}
  let right = 0; const detail: string[] = []
  for (const r of reqs) {
    const d = dec[r.id]
    const ok = !!d && d.decision === r.expected && (d.decision === 'return' || Number(d.value) === Number(r.to))
    if (ok) right++
    detail.push(`${r.id} (${r.subj}): ${!d ? 'not decided' : ok ? 'correct' : d.decision !== r.expected ? `${d.decision === 'send' ? 'sent' : 'returned'}; should be ${r.expected === 'send' ? 'sent to the vendor' : 'returned to the site'}` : `sent with value ${d.value}; should be ${r.to}`}`)
  }
  const k = run.level === 'expert' ? 2 : 1
  const wrongSend = reqs.filter((r) => dec[r.id]?.decision === 'send' && r.expected === 'return').length
  return { score: (right / reqs.length) * 100 - (k - 1) * 10 * wrongSend, detail: [`${right} of ${reqs.length} requests handled correctly`, ...detail] }
}

export function scoreM16(p: Project, run: MissionRun) {
  const key: { id: string; expected: string }[] = JSON.parse(run.answers?.key ?? '[]')
  const marks = p.vax?.recon ?? {}
  const right = key.filter((x) => marks[x.id] === x.expected).length
  const disc = key.filter((x) => x.expected !== 'match')
  const found = disc.filter((x) => marks[x.id] && marks[x.id] !== 'match').length
  const routed = disc.filter((x) => marks[x.id] === x.expected).length
  const falseFlags = key.filter((x) => x.expected === 'match' && marks[x.id] && marks[x.id] !== 'match').length
  const unmarked = key.filter((x) => !marks[x.id]).length
  const k = run.level === 'expert' ? 2 : 1
  return { score: key.length ? (right / key.length) * 100 - (k - 1) * 5 * falseFlags : 0, detail: [`${right} of ${key.length} rows marked correctly`, `${found} of ${disc.length} discrepancies found; ${routed} routed to the right party`, `${falseFlags} matching rows flagged as discrepancies`, `${unmarked} rows not marked`] }
}

// ---------- M17: an extract of the e-diary audit trail ----------
export type TrailIssue = 'none' | 'backfill' | 'odd-hour' | 'device' | 'pattern' | 'site-entry' | 'no-dcf' | 'future'
export const TRAIL_TEXT: Record<Exclude<TrailIssue, 'none'>, string> = {
  backfill: 'Back-filled: several days saved together, long after the window',
  'odd-hour': 'Saved at an implausible hour for an evening diary: ask the site',
  device: 'Saved from a device not assigned to this participant',
  pattern: 'Implausible pattern: identical values every day',
  'site-entry': 'Entered by site staff into the participant’s diary',
  'no-dcf': 'Value changed after saving without a data clarification form',
  future: 'Saved for a diary day that had not happened yet',
}
export interface TrailRow { seq: string; when: string; user: string; device: string; record: string; old: string; nw: string; reason: string; answer: TrailIssue; why: string }
export const DEVICE_LOG = [
  { participant: '203-002', device: 'ED1302' }, { participant: '203-004', device: 'ED1304' }, { participant: '203-006', device: 'ED1306' }, { participant: '203-008', device: 'ED1308' },
]
export const TRAIL: TrailRow[] = [
  { seq: '5101', when: '2026-04-20T20:41:10+05:30', user: 'participant 203-002', device: 'ED1302', record: '203-002 dose 1 day 2 · Pain', old: '', nw: 'Mild', reason: 'Diary entry', answer: 'none', why: 'An evening entry for that day, from the participant’s own device.' },
  { seq: '5102', when: '2026-04-21T21:05:52+05:30', user: 'participant 203-002', device: 'ED1302', record: '203-002 dose 1 day 3 · Temperature', old: '', nw: '36.8', reason: 'Diary entry', answer: 'none', why: 'Normal entry.' },
  { seq: '5103', when: '2026-04-22T03:12:40+05:30', user: 'participant 203-002', device: 'ED1302', record: '203-002 dose 1 day 4 · Temperature', old: '', nw: '36.9', reason: 'Diary entry', answer: 'odd-hour', why: 'An entry at 03:12 for an evening diary is not wrong in itself, but it is a review trigger: ask the site whether the participant had a reason.' },
  { seq: '5104', when: '2026-04-26T11:58:03+05:30', user: 'participant 203-004', device: 'ED1304', record: '203-004 dose 1 day 1 · Pain', old: '', nw: 'Moderate', reason: 'Diary entry', answer: 'none', why: 'Day 1 is 25 April; saved before noon on 26 April, inside the window.' },
  { seq: '5105', when: '2026-05-02T10:14:20+05:30', user: 'participant 203-004', device: 'ED1304', record: '203-004 dose 1 day 3 · Redness', old: '', nw: '20', reason: 'Diary entry', answer: 'backfill', why: 'Days 3 to 7 (27 April to 1 May) were all saved within four minutes on 2 May, at the clinic. The window design should have prevented it; the vendor must explain.' },
  { seq: '5106', when: '2026-05-02T10:15:02+05:30', user: 'participant 203-004', device: 'ED1304', record: '203-004 dose 1 day 4 · Redness', old: '', nw: '20', reason: 'Diary entry', answer: 'backfill', why: 'Part of the same back-filled block.' },
  { seq: '5107', when: '2026-05-02T10:17:41+05:30', user: 'participant 203-004', device: 'ED1304', record: '203-004 dose 1 day 7 · Redness', old: '', nw: '20', reason: 'Diary entry', answer: 'backfill', why: 'Part of the same back-filled block.' },
  { seq: '5108', when: '2026-05-08T20:30:15+05:30', user: 'participant 203-006', device: 'ED1308', record: '203-006 dose 1 day 2 · Fatigue', old: '', nw: 'None', reason: 'Diary entry', answer: 'device', why: 'ED1308 belongs to 203-008. Either the devices were swapped or data are attributed to the wrong person.' },
  { seq: '5109', when: '2026-05-09T19:55:47+05:30', user: 'participant 203-006', device: 'ED1306', record: '203-006 dose 1 day 3 · Fatigue', old: '', nw: 'None', reason: 'Diary entry', answer: 'none', why: 'Back on the participant’s own device.' },
  { seq: '5110', when: '2026-05-10T09:02:11+05:30', user: 'r.patil (site 203)', device: 'SITE-PC-03', record: '203-006 dose 1 day 4 · Temperature', old: '', nw: '36.7', reason: 'Entered on behalf of participant', answer: 'site-entry', why: 'Site staff may not enter data in a participant-reported diary. The participant is the data originator.' },
  { seq: '5111', when: '2026-05-10T20:44:36+05:30', user: 'participant 203-006', device: 'ED1306', record: '203-006 dose 1 day 5 · Headache', old: '', nw: 'Mild', reason: 'Diary entry', answer: 'none', why: 'Normal entry.' },
  { seq: '5112', when: '2026-05-14T20:12:08+05:30', user: 'participant 203-008', device: 'ED1308', record: '203-008 dose 1 day 1 · Temperature', old: '', nw: '36.6', reason: 'Diary entry', answer: 'none', why: 'Normal entry.' },
  { seq: '5113', when: '2026-05-15T20:13:30+05:30', user: 'participant 203-008', device: 'ED1308', record: '203-008 dose 1 day 2 · Temperature', old: '', nw: '36.6', reason: 'Diary entry', answer: 'none', why: 'The same temperature on two days is ordinary.' },
  { seq: '5114', when: '2026-05-20T20:10:59+05:30', user: 'participant 203-008', device: 'ED1308', record: '203-008 dose 1 days 1 to 7 · all items', old: '', nw: 'Identical: pain mild, redness 0, temperature 36.6, all others none', reason: 'Diary entries', answer: 'pattern', why: 'Every item identical on all seven days, saved at the same minute each evening: a pattern to review with the site (the participant may be tapping through).' },
  { seq: '5115', when: '2026-05-16T21:30:00+05:30', user: 'participant 203-008', device: 'ED1308', record: '203-008 dose 1 day 4 · Swelling', old: '', nw: '0', reason: 'Diary entry', answer: 'future', why: 'Day 4 is 17 May; this was saved on 16 May, before the day had happened. Check the device clock and the time source.' },
  { seq: '5116', when: '2026-05-22T15:40:18+05:30', user: 'vendor.support', device: 'SERVER', record: '203-002 dose 1 day 2 · Temperature', old: '38.9', nw: '37.9', reason: 'Corrected', answer: 'no-dcf', why: 'A vendor change to participant data with no data clarification form or site request behind it.' },
  { seq: '5117', when: '2026-05-23T11:02:44+05:30', user: 'vendor.support', device: 'SERVER', record: '203-004 dose 1 day 2 · Pain', old: 'Severe', nw: 'Moderate', reason: 'DCF-203-07: participant phoned site on 26 April (phone note)', answer: 'none', why: 'A correction through a DCF, citing a contemporaneous source.' },
  { seq: '5118', when: '2026-05-24T20:20:12+05:30', user: 'participant 203-002', device: 'ED1302', record: '203-002 dose 2 day 1 · Pain', old: '', nw: 'Mild', reason: 'Diary entry', answer: 'none', why: 'Normal entry.' },
  { seq: '5119', when: '2026-05-25T20:31:55+05:30', user: 'participant 203-002', device: 'ED1302', record: '203-002 dose 2 day 2 · Redness', old: '', nw: '35', reason: 'Diary entry', answer: 'none', why: 'Normal entry; grade 1 redness.' },
  { seq: '5120', when: '2026-05-27T09:48:31+05:30', user: 'participant 203-002', device: 'ED1302', record: '203-002 dose 2 day 3 · Redness', old: '', nw: '30', reason: 'Diary entry', answer: 'none', why: 'Day 3 is 26 May; saved before noon on 27 May, inside the window.' },
]
export function scoreTrail(answers: Record<string, string>) {
  const right = TRAIL.filter((r) => answers[r.seq] === r.answer).length
  const issues = TRAIL.filter((r) => r.answer !== 'none').length
  const found = TRAIL.filter((r) => r.answer !== 'none' && answers[r.seq] === r.answer).length
  const falseFlags = TRAIL.filter((r) => r.answer === 'none' && answers[r.seq] && answers[r.seq] !== 'none').length
  return { score: Math.round((right / TRAIL.length) * 100), found, issues, falseFlags, unanswered: TRAIL.filter((r) => !answers[r.seq]).length }
}
export const diaryDayKey = dayKey
