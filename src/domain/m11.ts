// The Protocol-to-Database Twin. HLV-204-201's protocol written in the ICH M11 structure (the
// Clinical electronic Structured Harmonised Protocol, CeSHarP: ICH Step 4 on 19 November 2025;
// EMA's Step 5 template effective 11 June 2026), held as data so that the database build can be
// traced to it: every schedule-of-activities procedure to the eCRF form and fields that collect
// it, and every collected field back to a procedure. The twin lists what the protocol needs that
// the build does not collect, what the build collects that no procedure needs, windows and
// criteria that disagree, and the data burden of each. Mission M19 reviews those findings.
// Section numbers are the M11 template's. Everything here is fictional.

import { HLV_DEF } from './study'
import { SHIPPED_CHECKS } from './checks'

export interface SoaVisit { id: string; name: string; lo: number; hi: number }
export interface Procedure { id: string; name: string; section: string; form: string; fields: string[]; visits: string[] | 'continuous'; note?: string }
export interface Criterion { code: string; text: string }

export const M11 = {
  version: 'ICH M11 CeSHarP template (Step 4, 19 November 2025; EMA Step 5, effective 11 June 2026)',
  title: {
    'Full Title': 'A randomised, double-blind, placebo-controlled phase 2 study of Vasclarin (VSC-9) in adults with stage 1 or 2 hypertension',
    'Trial Acronym': 'VASCLEAR-2',
    'Sponsor Protocol Identifier': 'HLV-204-201',
    'Original Protocol': 'No',
    'Version Number': '2.0',
    'Version Date': '2026-01-15',
    'Amendment Identifier': '1',
    'Amendment Scope': 'Global',
    "Sponsor's Investigational Product Code(s)": 'VSC-9',
    'Investigational Product Name(s)': 'Vasclarin',
    'Trial Phase': 'Phase 2',
    'Sponsor Name and Address': 'Halvern Therapeutics (fictional)',
  } as Record<string, string>,
  design: {
    'Intervention Model': 'Parallel',
    'Population Type': 'Patients',
    'Population Diagnosis or Condition': 'Stage 1 or 2 essential hypertension',
    'Population Age': '18 to 75 years',
    'Control Type': 'Placebo',
    'Intervention Assignment Method': 'Randomisation, 1:1, stratified by site',
    'Number of Arms': '2',
    'Trial Blind Schema': 'Double blind',
    'Blinded Roles': 'Participant, investigator, outcomes assessor, sponsor study team',
    'Number of Participants': '120 randomised',
    'Duration': '12 weeks of intervention; up to 18 weeks of participation',
    'Site Distribution and Geographic Scope': '6 sites in Germany, India and the United States',
    'Committees': 'Independent data monitoring committee',
  } as Record<string, string>,
  objectives: [
    { section: '3.1.1', kind: 'Primary', objective: 'To compare the effect of Vasclarin with placebo on seated systolic blood pressure', endpoint: 'Change from baseline to Week 12 in mean seated systolic blood pressure', estimand: 'Population: randomised adults with stage 1 or 2 hypertension. Treatment: Vasclarin 10 mg once daily vs placebo for 12 weeks. Intercurrent events: rescue antihypertensive medication and discontinuation of trial intervention, both by treatment policy. Population-level summary: difference in means.' },
    { section: '3.2.1', kind: 'Secondary', objective: 'To compare the effect on seated diastolic blood pressure', endpoint: 'Change from baseline to Week 12 in mean seated diastolic blood pressure', estimand: 'As the primary estimand, for diastolic blood pressure.' },
    { section: '3.2.2', kind: 'Secondary', objective: 'To compare blood pressure control', endpoint: 'Proportion of participants with seated systolic blood pressure below 140 mmHg at Week 12', estimand: 'Intercurrent events: rescue medication by composite strategy (counted as not controlled). Summary: difference in proportions.' },
    { section: '3.2.3', kind: 'Secondary', objective: 'To assess safety', endpoint: 'Adverse events; serum potassium and creatinine; QTcF', estimand: 'Not applicable (descriptive safety).' },
  ],
  inclusion: [
    { code: 'IN01', text: 'Aged 18 to 75 years when consent is signed' },
    { code: 'IN02', text: 'Mean seated systolic blood pressure 140 to 179 mmHg at screening' },
  ] as Criterion[],
  exclusion: [
    { code: 'EX01', text: 'Known or suspected secondary hypertension' },
    { code: 'EX02', text: 'eGFR below 45 mL/min/1.73 m²' },
    { code: 'EX03', text: 'Serum potassium above 5.5 mmol/L at screening' },
    { code: 'EX04', text: 'Use of a potassium-sparing diuretic or potassium supplement within 4 weeks before screening' },
  ] as Criterion[],
  visits: [
    { id: 'SCR', name: 'Screening', lo: -28, hi: -1 },
    { id: 'D1', name: 'Day 1 (randomisation)', lo: 1, hi: 1 },
    { id: 'W2', name: 'Week 2', lo: 12, hi: 18 },
    { id: 'W4', name: 'Week 4', lo: 26, hi: 32 },
    { id: 'W8', name: 'Week 8', lo: 50, hi: 64 },
    { id: 'W12', name: 'Week 12 (end of treatment)', lo: 82, hi: 88 },
    { id: 'FU', name: 'Week 14 follow-up', lo: 96, hi: 102 },
  ] as SoaVisit[],
  procedures: [
    { id: 'P01', name: 'Informed consent', section: '11.3', form: 'IC', fields: ['DSSTDAT', 'ICVER'], visits: ['SCR'] },
    { id: 'P02', name: 'Demographics', section: '8.2', form: 'DM', fields: ['BRTHYR', 'SEX', 'RACE'], visits: ['SCR'] },
    { id: 'P03', name: 'Eligibility criteria', section: '5.2, 5.3', form: 'IE', fields: ['IEYN', 'IETESTCD'], visits: ['SCR'] },
    { id: 'P04', name: 'Medical history', section: '8.2', form: 'MH', fields: ['MHTERM', 'MHSTDAT', 'MHONGO'], visits: ['SCR'] },
    { id: 'P05', name: 'Seated blood pressure and pulse (footnote a)', section: '8.3, 8.4.2', form: 'VS', fields: ['VSDAT', 'SYSBP', 'DIABP', 'PULSE'], visits: ['SCR', 'D1', 'W2', 'W4', 'W8', 'W12', 'FU'], note: 'a: three seated readings 2 minutes apart after 5 minutes’ rest; the mean of the three is recorded.' },
    { id: 'P06', name: 'Weight', section: '8.4.2', form: 'VS', fields: ['WEIGHT', 'BMI'], visits: ['SCR', 'W12'] },
    { id: 'P07', name: 'Height', section: '8.2', form: 'VS', fields: ['HEIGHT'], visits: ['SCR'] },
    { id: 'P08', name: 'Local safety laboratory (potassium, creatinine, ALT)', section: '8.4.4, 12.1', form: 'LB', fields: ['LBDAT', 'K', 'CREAT', 'ALT'], visits: ['SCR', 'W4', 'W12'] },
    { id: 'P09', name: 'Central laboratory sample (glucose, sodium, HbA1c)', section: '8.4.4, 12.1', form: 'LBC', fields: ['LBPERF', 'LBDAT'], visits: ['SCR', 'W4', 'W12'] },
    { id: 'P10', name: '12-lead ECG (central reading)', section: '8.4.3', form: 'EG', fields: ['EGDAT', 'QTCF', 'EGINTP'], visits: ['SCR', 'W4', 'W12'], note: 'Week 4 is at steady state, around the expected time of peak concentration.' },
    { id: 'P11', name: 'Pregnancy test (participants of childbearing potential)', section: '8.4.5', form: 'PREG', fields: ['PREGDAT', 'PREGRES'], visits: ['SCR', 'D1', 'W12'] },
    { id: 'P12', name: 'Dispense trial intervention; accountability and adherence', section: '6.6.3, 6.8', form: 'EX', fields: ['EXDISP', 'EXKIT', 'EXDSPQ', 'EXRET', 'EXCOMPL'], visits: ['D1', 'W2', 'W4', 'W8', 'W12'], note: 'Dispensing on Day 1 to Week 8; tablets returned are counted at every visit after Day 1, including Week 12.' },
    { id: 'P13', name: 'Adverse events (footnote b)', section: '9.2.1', form: 'AE', fields: ['AETERM', 'AESTDAT', 'AEONGO', 'AEENDAT', 'AESEV', 'AESER', 'AESDTH', 'AESLIFE', 'AESHOSP', 'AESDISAB', 'AESCONG', 'AESMIE', 'AEREL', 'AEACN', 'AEOUT', 'AECOM'], visits: 'continuous', note: 'b: the schedule of activities shows adverse events collected from Day 1.' },
    { id: 'P14', name: 'Concomitant and rescue therapy', section: '6.9.2, 6.10', form: 'CM', fields: ['CMTRT', 'CMINDC', 'CMDSTXT', 'CMDOSU', 'CMROUTE', 'CMSTDAT', 'CMONGO', 'CMENDAT'], visits: 'continuous' },
    { id: 'P15', name: 'End of trial status', section: '7.2', form: 'EOS', fields: ['DSDECOD', 'EOSDAT'], visits: ['FU'] },
  ] as Procedure[],
  // Statements elsewhere in the protocol that the twin reads alongside the schedule.
  statements: [
    { section: '1.1.2', text: 'Number of Participants: 120 randomised.' },
    { section: '9.2.1', text: 'Adverse events are collected from the signing of informed consent until the Week 14 follow-up visit.' },
    { section: '10.4.1.1', text: 'The primary analysis uses the mean of the second and third seated systolic readings at each visit.' },
    { section: '10.11', text: 'A sample size of 132 randomised participants (66 per arm) gives 90% power to detect a difference of 6 mmHg, allowing for 10% dropout.' },
    { section: '11.7', text: 'Operational data needed for data integrity (visit occurrence, sample accession numbers and times for reconciliation with the central laboratory) are collected as described in the data management plan.' },
    { section: '11.10', text: 'Protocol deviations are recorded in the eCRF and classified as important or not.' },
  ],
}

// ---------- the twin: protocol against the database build ----------

// Fields that hold structure rather than data the protocol asks for.
const STRUCTURAL = new Set(['VISOCCUR', 'VISDAT', 'UNSREAS'])
export type TwinKind = 'not-collected' | 'form-missing' | 'not-needed' | 'window' | 'criterion' | 'protocol'
export interface TwinFinding { id: string; kind: TwinKind; where: string; text: string; section: string; points: number }

type Def = typeof HLV_DEF
const visitIds = M11.visits.map((v) => v.id)

export function twin(def: Def = HLV_DEF): TwinFinding[] {
  const out: TwinFinding[] = []
  const buildVisits = new Map(def.visits.map((v) => [v.id, v]))
  const formsAt = (form: string) => def.visits.filter((v) => visitIds.includes(v.id) && v.forms.includes(form)).map((v) => v.id)
  const logForm = (form: string) => def.logForms.includes(form)
  // Procedures the build does not collect where the protocol asks.
  for (const pr of M11.procedures) {
    const f = def.forms[pr.form as keyof typeof def.forms]
    if (!f) { out.push({ id: `T-form-${pr.form}`, kind: 'form-missing', where: pr.name, text: `${pr.name} is in the schedule at ${(pr.visits as string[]).join(', ')}, but the build has no ${pr.form} form.`, section: pr.section, points: (pr.visits as string[]).length * pr.fields.length }); continue }
    if (pr.visits === 'continuous') continue
    const missing = pr.visits.filter((v) => !formsAt(pr.form).includes(v))
    if (missing.length) out.push({ id: `T-miss-${pr.form}-${missing.join('-')}`, kind: 'not-collected', where: `${pr.form} at ${missing.join(', ')}`, text: `${pr.name} is in the schedule at ${missing.join(', ')}, but the ${f.name} form is not on ${missing.length === 1 ? 'that visit' : 'those visits'} in the build.`, section: pr.section, points: missing.length * pr.fields.length })
  }
  // Fields and forms the build collects that no procedure needs.
  for (const [fid, f] of Object.entries(def.forms)) {
    const procs = M11.procedures.filter((p) => p.form === fid)
    const at = logForm(fid) ? [] : formsAt(fid)
    if (!procs.length) {
      if (fid === 'SV') continue
      out.push({ id: `T-extra-form-${fid}`, kind: 'not-needed', where: f.name, text: `The ${f.name} form (${f.fields.length} fields) is collected but is not in the schedule of activities.`, section: '1.3', points: (at.length || 1) * f.fields.length })
      continue
    }
    const unneeded = f.fields.filter((x) => !STRUCTURAL.has(x.id) && !procs.some((p) => p.fields.includes(x.id)))
    if (unneeded.length) out.push({ id: `T-extra-${fid}-${unneeded.map((x) => x.id).join('-')}`, kind: 'not-needed', where: `${f.name}: ${unneeded.map((x) => x.id).join(', ')}`, text: `${unneeded.map((x) => `${x.id} (${x.label})`).join(', ')} ${unneeded.length === 1 ? 'is' : 'are'} collected on ${f.name} at ${at.join(', ')}, but no procedure in the protocol asks for ${unneeded.length === 1 ? 'it' : 'them'}.`, section: procs.map((p) => p.section).join('; '), points: at.length * unneeded.length })
    if (logForm(fid)) continue
    for (const fld of f.fields.filter((x) => !STRUCTURAL.has(x.id) && !unneeded.includes(x))) {
      const need = new Set(procs.filter((p) => p.fields.includes(fld.id)).flatMap((p) => p.visits as string[]))
      const extra = at.filter((v) => !need.has(v))
      if (extra.length && extra.length < at.length && !fld.derived) {
        out.push({ id: `T-extra-${fid}-${fld.id}-visits`, kind: 'not-needed', where: `${f.name}: ${fld.id}`, text: `${fld.label.replace(/ \(.*\)$/, '')} is collected at every ${f.name} visit, including ${extra.join(', ')}, but the protocol asks for it only at ${[...need].join(', ')}.`, section: procs.filter((p) => p.fields.includes(fld.id)).map((p) => p.section).join('; '), points: extra.length })
      }
    }
  }
  // Windows.
  for (const v of M11.visits) {
    const b = buildVisits.get(v.id)
    if (b && (b.lo !== v.lo || b.hi !== v.hi)) out.push({ id: `T-window-${v.id}`, kind: 'window', where: v.name, text: `The protocol window for ${v.name} is study day ${v.lo} to ${v.hi}; the build (and edit check SV-04) uses day ${b.lo} to ${b.hi}.`, section: '1.3', points: 0 })
  }
  // Eligibility criteria the eCRF cannot record.
  const codes = new Set((def.codelists.IETEST ?? []).map((c) => c.value))
  for (const c of [...M11.inclusion, ...M11.exclusion]) if (!codes.has(c.code)) out.push({ id: `T-crit-${c.code}`, kind: 'criterion', where: c.code, text: `${c.code} “${c.text}” is not in the eCRF’s list of criteria not met, so a participant who fails it cannot be recorded correctly.`, section: c.code.startsWith('IN') ? '5.2' : '5.3', points: 0 })
  return out
}

// Inconsistencies inside the protocol, which the twin finds by reading sections together.
export const PROTOCOL_FINDINGS: TwinFinding[] = [
  { id: 'P-bp', kind: 'protocol', where: '1.3 footnote a and 10.4.1.1', text: 'The schedule says the mean of three seated readings is recorded; the statistical section analyses the mean of the second and third. The eCRF cannot serve both.', section: '1.3, 10.4.1.1', points: 0 },
  { id: 'P-ae', kind: 'protocol', where: '1.3 footnote b and 9.2.1', text: 'The schedule shows adverse events from Day 1; section 9.2.1 collects them from informed consent.', section: '1.3, 9.2.1', points: 0 },
  { id: 'P-n', kind: 'protocol', where: '1.1.2 and 10.11', text: 'The synopsis says 120 participants; the sample size section says 132.', section: '1.1.2, 10.11', points: 0 },
]

export const allFindings = (def: Def = HLV_DEF) => [...twin(def), ...PROTOCOL_FINDINGS]

// ---------- data burden ----------

// Data points per participant: every field on every scheduled form, plus the logs at an assumed
// number of records. Conditional fields count at the share of records that show them.
export const LOG_RECORDS: Record<string, number> = { AE: 3, CM: 4, MH: 3, DV: 1 }
export interface Burden { perParticipant: number; total: number; forms: number; checks: number; queries: number; hours: number }
export interface Assumptions { participants: number; queryRate: number; minutesPerQuery: number }
export const DEFAULT_ASSUMPTIONS: Assumptions = { participants: 120, queryRate: 2.5, minutesPerQuery: 25 }

function fieldsCounted(def: Def, form: string, only?: string[]) {
  const f = def.forms[form as keyof typeof def.forms]; if (!f) return 0
  return f.fields.filter((x) => !x.derived && (!only || only.includes(x.id) || STRUCTURAL.has(x.id))).reduce((n, x) => n + (x.showIf ? 0.5 : 1), 0)
}
// The build as it is.
export function buildBurden(def: Def = HLV_DEF, a: Assumptions = DEFAULT_ASSUMPTIONS, extra: { points: number; forms: number; checks: number } = { points: 0, forms: 0, checks: 0 }): Burden {
  let pts = 0, forms = 0
  for (const v of def.visits.filter((x) => visitIds.includes(x.id))) for (const f of v.forms) { pts += fieldsCounted(def, f); forms++ }
  for (const f of def.logForms) { pts += fieldsCounted(def, f) * (LOG_RECORDS[f] ?? 1); forms++ }
  pts += extra.points; forms += extra.forms
  const checks = SHIPPED_CHECKS.length + extra.checks
  return finishBurden(pts, forms, checks, a)
}
// What the protocol asks for: only the fields its procedures name, only at their visits.
export function protocolBurden(def: Def = HLV_DEF, a: Assumptions = DEFAULT_ASSUMPTIONS, procs: Procedure[] = M11.procedures): Burden {
  let pts = 0
  const formVisits = new Set<string>()
  for (const p of procs) {
    const f = def.forms[p.form as keyof typeof def.forms]
    const n = f ? f.fields.filter((x) => p.fields.includes(x.id) && !x.derived).reduce((s, x) => s + (x.showIf ? 0.5 : 1), 0) : p.fields.length
    if (p.visits === 'continuous') { pts += n * (LOG_RECORDS[p.form] ?? 1); formVisits.add(p.form) }
    else for (const v of p.visits) { pts += n; formVisits.add(`${p.form}|${v}`) }
  }
  for (const v of M11.visits) { pts += 2; formVisits.add(`SV|${v.id}`) }
  pts += fieldsCounted(def, 'DV') * LOG_RECORDS.DV
  const checks = generatedChecks(procs).length
  return finishBurden(pts, formVisits.size + 1, checks, a)
}
function finishBurden(pts: number, forms: number, checks: number, a: Assumptions): Burden {
  const per = Math.round(pts)
  const total = per * a.participants
  const queries = Math.round(total * a.queryRate / 100)
  return { perParticipant: per, total, forms, checks, queries, hours: Math.round(queries * a.minutesPerQuery / 60) }
}

// Protocol changes to price before they are made.
export interface WhatIf { id: string; label: string; section: string; apply: (procs: Procedure[]) => Procedure[] }
export const WHAT_IFS: WhatIf[] = [
  { id: 'dropW2', label: 'Drop the Week 2 visit', section: '1.3', apply: (ps) => ps.map((p) => p.visits === 'continuous' ? p : { ...p, visits: p.visits.filter((v) => v !== 'W2') }) },
  { id: 'pk', label: 'Add sparse PK sampling: 3 samples at Week 4 and Week 12', section: '8.5', apply: (ps) => [...ps, { id: 'P16', name: 'PK sampling (3 timed samples)', section: '8.5', form: 'PC', fields: ['PCDAT', 'PCTIM1', 'PCTIM2', 'PCTIM3', 'PCREFID1', 'PCREFID2', 'PCREFID3', 'EXLDOSTM'], visits: ['W4', 'W12'] }] },
  { id: 'abpm', label: 'Add 24-hour ambulatory BP at Day 1 and Week 12', section: '8.3', apply: (ps) => [...ps, { id: 'P17', name: 'Ambulatory BP monitoring (24 h)', section: '8.3', form: 'ABPM', fields: ['ABPMSTDTC', 'ABPMENDTC', 'ABPMVALID', 'ABPMSYS24', 'ABPMDIA24', 'ABPMSYSD', 'ABPMSYSN'], visits: ['D1', 'W12'] }] },
  { id: 'qol', label: 'Add a 12-item quality-of-life questionnaire at Day 1, Week 4 and Week 12', section: '8.3', apply: (ps) => [...ps, { id: 'P18', name: 'Quality of life (12 items)', section: '8.3', form: 'QS', fields: ['QSDAT', ...Array.from({ length: 12 }, (_, i) => `QS${String(i + 1).padStart(2, '0')}`)], visits: ['D1', 'W4', 'W12'] }] },
  { id: 'labsW8', label: 'Add local safety labs at Week 8', section: '8.4.4', apply: (ps) => ps.map((p) => p.id === 'P08' ? { ...p, visits: [...(p.visits as string[]), 'W8'] } : p) },
]

// ---------- generated core edit checks ----------
export interface GenCheck { id: string; source: string; text: string }
export function generatedChecks(procs: Procedure[] = M11.procedures): GenCheck[] {
  const out: GenCheck[] = []
  for (const v of M11.visits) if (v.id !== 'D1') out.push({ id: `W-${v.id}`, source: '1.3', text: `${v.name} on study day ${v.lo} to ${v.hi}` })
  for (const c of M11.inclusion) out.push({ id: `E-${c.code}`, source: '5.2', text: `Eligible but ${c.code} not met: ${c.text}` })
  for (const c of M11.exclusion) out.push({ id: `E-${c.code}`, source: '5.3', text: `Eligible but ${c.code} applies: ${c.text}` })
  out.push({ id: 'R-SYSBP', source: '8.4.2', text: 'Systolic BP 80 to 220 mmHg' }, { id: 'R-DIABP', source: '8.4.2', text: 'Diastolic BP 40 to 130 mmHg' }, { id: 'R-K', source: '8.4.4, 12.1', text: 'Potassium above 5.5 mmol/L after Day 1 (safety follow-up)' })
  const def = HLV_DEF
  for (const p of procs) for (const fid of p.fields) {
    const f = def.forms[p.form as keyof typeof def.forms]?.fields.find((x) => x.id === fid)
    const isNew = !def.forms[p.form as keyof typeof def.forms]
    if (f?.required || isNew) out.push({ id: `M-${p.form}-${fid}`, source: p.section, text: `${f?.label ?? fid} missing on ${p.form}${isNew ? ' (new form: assumed required)' : ''}` })
  }
  return out
}

// ---------- mission M19 ----------
export type TwinAction = 'none' | 'build' | 'remove' | 'protocol'
export const TWIN_ACTION_TEXT: Record<Exclude<TwinAction, 'none'>, string> = {
  build: 'Change the build: add or correct what the protocol requires',
  remove: 'Stop collecting it: the data are not needed by the protocol',
  protocol: 'Raise with the protocol author: the protocol contradicts itself',
}
export const TWIN_ANSWERS: Record<string, { answer: TwinAction; why: string }> = {
  'T-form-PREG': { answer: 'build', why: 'Section 8.4.5 schedules a pregnancy test for participants of childbearing potential at three visits; without a form the result cannot be recorded or checked. Add a pregnancy test form at Screening, Day 1 and Week 12.' },
  'T-miss-EG-W4': { answer: 'build', why: 'The schedule adds an ECG at Week 4, at steady state near peak concentration. It is a safety assessment the build misses: add the ECG form to Week 4 (and the central ECG transfer agreement will need the visit too).' },
  'T-window-W8': { answer: 'build', why: 'The protocol is the source: the Week 8 window is day 50 to 64. The build’s narrower window would query visits the protocol allows. Correct the visit window (SV-04 uses it).' },
  'T-crit-EX04': { answer: 'build', why: 'A participant excluded by EX04 cannot be recorded with the right criterion. Add EX04 to the criteria list (and an edit check against concomitant medications).' },
  'T-extra-VS-WEIGHT-visits': { answer: 'remove', why: 'Weight is needed at Screening and Week 12 only (8.4.2). Collecting it at five more visits is about 600 data points across the study for no analysis: show the field at Screening and Week 12 only.' },
  'T-extra-VS-HEIGHT-visits': { answer: 'remove', why: 'Height is a screening measurement (8.2). The field shows at every visit; hide it after Screening so sites are not asked for it.' },
  'T-extra-LB-GLUC-GLUCU': { answer: 'remove', why: 'Glucose comes from the central laboratory (12.1); the local laboratory panel is potassium, creatinine and ALT. Local glucose duplicates the central result and adds unit problems: remove it from the local form.' },
  'T-extra-LBC-LBREFID-LBTIM': { answer: 'none', why: 'Accession number and collection time are not protocol procedures, but section 11.7 and the data management plan need them to reconcile the central laboratory transfer. They stay.' },
  'T-extra-form-DV': { answer: 'none', why: 'Protocol deviations are not a schedule procedure but section 11.10 requires them to be recorded and classified. The form stays.' },
  'P-bp': { answer: 'protocol', why: 'Recording the mean of three while analysing the mean of the second and third cannot both be served by one field. The protocol author resolves it (by amendment or clarification) before the eCRF is changed to collect individual readings or the agreed mean.' },
  'P-ae': { answer: 'protocol', why: 'Two sections disagree on when AE collection starts. Events between consent and Day 1 are lost or over-collected depending on which the site follows. The protocol author must align 1.3 and 9.2.1; the eCRF follows.' },
  'P-n': { answer: 'protocol', why: 'The synopsis and the sample size section disagree on the number of participants. That affects drug supply, the data volume and the plan; the protocol author corrects it.' },
}
export function scoreTwin(answers: Record<string, string>) {
  const rows = allFindings()
  const right = rows.filter((r) => answers[r.id] === TWIN_ANSWERS[r.id]?.answer).length
  const falseFlags = rows.filter((r) => TWIN_ANSWERS[r.id]?.answer === 'none' && answers[r.id] && answers[r.id] !== 'none').length
  const missed = rows.filter((r) => TWIN_ANSWERS[r.id]?.answer !== 'none' && answers[r.id] === 'none').length
  return { score: Math.round((right / rows.length) * 100), right, total: rows.length, falseFlags, missed, unanswered: rows.filter((r) => !answers[r.id]).length }
}
