// ALCOA+ (attributable, legible, contemporaneous, original, accurate, plus complete,
// consistent, enduring, available). Two uses: labelling each entry of the console's own
// audit trail with the attributes it demonstrates, and mission M13, where the learner audits
// an audit-trail extract from a fictional site electronic-source system with planted
// violations.

import type { AuditEntry } from './types'

export const ATTRS = ['Attributable', 'Legible', 'Contemporaneous', 'Original', 'Accurate', 'Complete', 'Consistent', 'Enduring', 'Available'] as const
export type Attr = (typeof ATTRS)[number]
export const ATTR_TEXT: Record<Attr, string> = {
  Attributable: 'Who did it is recorded, and that person alone could have done it.',
  Legible: 'It can be read and understood, now and later.',
  Contemporaneous: 'Recorded when it happened, with a reliable timestamp.',
  Original: 'The first record, or a certified copy, is kept; changes do not erase it.',
  Accurate: 'It is correct and matches the source.',
  Complete: 'Nothing is missing, including the reason for every change.',
  Consistent: 'Recorded in the same way and order everywhere (formats, time zone, sequence).',
  Enduring: 'Kept for the whole retention period on durable media.',
  Available: 'Can be retrieved for review or inspection when needed.',
}

// Which attributes one entry of the console's own trail demonstrates.
export function tagsFor(a: AuditEntry): Attr[] {
  const t: Attr[] = ['Attributable', 'Contemporaneous', 'Consistent']
  if (a.action === 'item.create' || a.action === 'form.create') t.push('Original')
  if (a.action === 'item.update') t.push('Original', 'Complete')
  if (a.action.startsWith('query.') || a.action.startsWith('sdv.') || a.action.startsWith('sae.') || a.action.startsWith('ext.') || a.action.startsWith('coding.')) t.push('Accurate')
  if (a.action === 'form.delete') t.push('Complete')
  if (a.action.startsWith('signature') || a.action.startsWith('lock.')) t.push('Legible')
  if (a.action.startsWith('archive') || a.action.startsWith('project.export')) t.push('Enduring', 'Available')
  return t
}

// ---------- mission M13: the site 106 eSource extract ----------

export const ESOURCE_USERS = [
  { id: 'n.deshmukh', name: 'Study nurse N. Deshmukh', active: 'since 2026-04-20' },
  { id: 'r.kale', name: 'Study coordinator R. Kale', active: '2026-04-20 to 2026-05-31 (account closed when she left the site)' },
  { id: 'a.joshi', name: 'Investigator Dr A. Joshi', active: 'since 2026-04-20' },
  { id: 'site106', name: 'Generic site account', active: 'since 2026-04-20 (shared by front-desk staff)' },
]
export interface ExtractRow { seq: string; when: string; user: string; action: string; record: string; old: string; nw: string; reason: string; answer: Attr | 'none'; why: string }
export const EXTRACT: ExtractRow[] = [
  { seq: '1001', when: '2026-06-02T09:14:05+05:30', user: 'n.deshmukh', action: 'Create', record: '106-002 Week 2 · Systolic BP', old: '', nw: '140', reason: 'Initial entry', answer: 'none', why: 'Named user, timestamp at the visit, initial value.' },
  { seq: '1002', when: '2026-06-02T09:20:41+05:30', user: 'site106', action: 'Update', record: '106-002 Week 2 · Systolic BP', old: '140', nw: '150', reason: 'Correction', answer: 'Attributable', why: 'A shared login: nobody can say who changed the value.' },
  { seq: '1003', when: '2026-06-02T09:31:12+05:30', user: 'n.deshmukh', action: 'Create', record: '106-002 Week 2 · Weight', old: '', nw: '82.0', reason: 'Initial entry', answer: 'none', why: 'Recorded at the visit by a named user.' },
  { seq: '1004', when: '2026-06-09T16:02:33+05:30', user: 'a.joshi', action: 'Update', record: '106-002 Week 2 · Weight', old: '82.0', nw: '78.0', reason: '', answer: 'Complete', why: 'No reason for the change.' },
  { seq: '1005', when: '2026-06-30T11:45:00+05:30', user: 'n.deshmukh', action: 'Create', record: '106-003 Week 2 visit note (visit 2026-06-03)', old: '', nw: 'Seen, no complaints', reason: 'Initial entry', answer: 'Contemporaneous', why: 'Written 27 days after the visit, with no late-entry note.' },
  { seq: '1006', when: '2026-06-03T10:05:19+05:30', user: 'n.deshmukh', action: 'Create', record: '106-003 Week 2 · Pulse', old: '', nw: '72', reason: 'Initial entry', answer: 'none', why: 'Normal entry.' },
  { seq: '1007', when: '2026-06-03T10:07:52+05:30', user: 'n.deshmukh', action: 'Create', record: '106-003 Week 2 · Fasting glucose', old: '', nw: 'see paper', reason: 'Initial entry', answer: 'Original', why: 'The real result lives on a loose sheet; the electronic record is not the original.' },
  { seq: '1008', when: '06/07/2026 14:02', user: 'a.joshi', action: 'Create', record: '106-004 Day 1 · Investigator note', old: '', nw: 'Eligible, randomise', reason: 'Initial entry', answer: 'Consistent', why: 'Timestamp in a different format with no time zone, unlike every other entry.' },
  { seq: '1009', when: '2026-06-08T12:10:44+05:30', user: 'n.deshmukh', action: 'Delete', record: '106-004 AE #2', old: 'Headache', nw: '', reason: 'Duplicate of AE #1, entered twice', answer: 'none', why: 'Deletion with a reason, by a named user.' },
  { seq: '1010', when: '2026-06-08T12:31:09+05:30', user: 'a.joshi', action: 'Update', record: '106-004 Day 1 · Diastolic BP', old: '[not kept]', nw: '90', reason: 'Re-measured', answer: 'Original', why: 'The previous value was not kept: the change erased the original.' },
  { seq: '1011', when: '2026-06-10T09:02:27+05:30', user: 'n.deshmukh', action: 'Create', record: '106-005 Day 1 · Haemoglobin', old: '', nw: 'Hb 1Z.4 g/dL', reason: 'Initial entry', answer: 'Legible', why: 'Garbled value that cannot be read reliably.' },
  { seq: '1012', when: '2026-06-12T15:40:03+05:30', user: 'r.kale', action: 'Update', record: '106-005 Day 1 · Weight', old: '91.0', nw: '89.0', reason: 'Transcription error', answer: 'Attributable', why: 'Made with an account that was closed on 31 May: someone else used it.' },
  { seq: '1013', when: '2026-06-15T10:12:55+05:30', user: 'n.deshmukh', action: 'Create', record: '106-006 Day 1 · Systolic BP', old: '', nw: '150', reason: 'Initial entry', answer: 'none', why: 'Normal entry.' },
  { seq: '1016', when: '2026-06-15T10:20:30+05:30', user: 'n.deshmukh', action: 'Create', record: '106-006 Day 1 · Pulse', old: '', nw: '80', reason: 'Initial entry', answer: 'Complete', why: 'Sequence jumps from 1013 to 1016: entries 1014 and 1015 are missing from the trail.' },
  { seq: '1017', when: '2026-06-15T10:24:18+05:30', user: 'n.deshmukh', action: 'Create', record: '106-006 Day 1 · Fasting glucose', old: '', nw: '5.4 mmol/L', reason: 'Initial entry (device printout attached: 4.5 mmol/L)', answer: 'Accurate', why: 'The value typed does not match the attached device printout.' },
  { seq: '1018', when: '2026-06-16T08:55:47+05:30', user: 'a.joshi', action: 'Sign', record: '106-006 Day 1 casebook', old: '', nw: 'Signed', reason: 'Investigator review', answer: 'none', why: 'Signature by the investigator, with meaning.' },
  { seq: '1019', when: '2026-06-20T00:00:00+05:30', user: 'system', action: 'Purge', record: 'Audit log entries older than 90 days', old: '', nw: '', reason: 'Scheduled housekeeping', answer: 'Enduring', why: 'The audit trail must be kept for the whole retention period, not purged.' },
  { seq: '1020', when: '2026-06-21T10:30:00+05:30', user: 'n.deshmukh', action: 'Export request', record: 'Full audit trail for the monitor', old: '', nw: 'Refused', reason: 'Available from the system vendor on request, 6 weeks', answer: 'Available', why: 'The trail cannot be produced for review when needed.' },
  { seq: '1021', when: '2026-06-22T11:14:39+05:30', user: 'n.deshmukh', action: 'Update', record: '106-007 Day 1 · Pulse', old: '68', nw: '86', reason: 'Digits transposed; corrected per source', answer: 'none', why: 'Named user, old value kept, reason given.' },
  { seq: '1022', when: '2026-06-22T11:20:02+05:30', user: 'a.joshi', action: 'Create', record: '106-007 Day 1 · Eligibility confirmed', old: '', nw: 'Yes', reason: 'Initial entry', answer: 'none', why: 'Normal entry.' },
]
export function scoreExtract(answers: Record<string, string>) {
  const right = EXTRACT.filter((r) => answers[r.seq] === r.answer)
  const found = EXTRACT.filter((r) => r.answer !== 'none' && answers[r.seq] === r.answer).length
  const violations = EXTRACT.filter((r) => r.answer !== 'none').length
  const falseFlags = EXTRACT.filter((r) => r.answer === 'none' && answers[r.seq] && answers[r.seq] !== 'none').length
  return { score: Math.round((right.length / EXTRACT.length) * 100), found, violations, falseFlags, unanswered: EXTRACT.filter((r) => !answers[r.seq]).length }
}
