// The fictional vaccine study ALV-3-301 (Phase 5). Forms follow CDISC CDASHIG v2.3 names where
// one exists; codelists use CDISC Controlled Terminology values where one exists. Solicited
// reactions are collected by the participant in an electronic diary, not on the eCRF. Grading
// follows the FDA guidance "Toxicity Grading Scale for Healthy Adult and Adolescent Volunteers
// Enrolled in Preventive Vaccine Clinical Trials" (September 2007), as the protocol's choice.
// Everything here is fictional.

import type { FormDef, Site, Visit } from '../study'

export const VAX_STUDY = {
  protocol: 'ALV-3-301',
  title: 'An observer-blind, randomised, placebo-controlled phase 3 study of the safety, reactogenicity and immunogenicity of two doses of Aurelivax (ALV-3) in healthy adults aged 18 to 64',
  sponsor: 'Aurelis Vaccines (fictional)',
  cro: 'Marrowbridge Clinical (fictional)',
  drug: 'Aurelivax (ALV-3)',
  ctVersion: 'the CDISC Controlled Terminology package current at database build (March 2026 release), frozen for the study',
  cdash: 'CDASHIG v2.3; diary data as an external eCOA transfer',
  start: '2026-04-06',
  design: 'Observer-blind, randomised 2:1 to Aurelivax or saline placebo; doses on Day 1 and Day 29; e-diary for 7 days after each dose',
}

export const VAX_SITES: Site[] = [
  { id: '201', name: 'Harbourside Vaccine Research Unit', country: 'United Kingdom', profile: 'clean', labUnit: 'mmol/L' },
  { id: '202', name: 'Prairie Clinical Trials Center', country: 'United States', profile: 'slow', labUnit: 'mmol/L' },
  { id: '203', name: 'Deccan Clinical Research Institute', country: 'India', profile: 'new-coordinator', labUnit: 'mmol/L' },
  { id: '204', name: 'Elbtal Studienzentrum', country: 'Germany', profile: 'late', labUnit: 'mmol/L' },
]

// Day 1 is the first dose. Phone contacts check the diary and ask about medically attended events.
export const VAX_VISITS: Visit[] = [
  { id: 'D1', name: 'Day 1 (dose 1)', day: 1, lo: 1, hi: 1, forms: ['SV', 'IC', 'DM', 'IE', 'MH', 'VS', 'IMM', 'VAX'] },
  { id: 'PC1', name: 'Day 8 phone contact', day: 8, lo: 8, hi: 10, forms: ['SV', 'CONT'] },
  { id: 'D29', name: 'Day 29 (dose 2)', day: 29, lo: 27, hi: 35, forms: ['SV', 'VS', 'IMM', 'VAX'] },
  { id: 'PC2', name: 'Day 36 phone contact', day: 36, lo: 36, hi: 38, forms: ['SV', 'CONT'] },
  { id: 'D57', name: 'Day 57', day: 57, lo: 54, hi: 64, forms: ['SV', 'VS', 'IMM'] },
  { id: 'D181', name: 'Day 181 (end of study)', day: 181, lo: 167, hi: 195, forms: ['SV', 'CONT', 'EOS'] },
  { id: 'UNS', name: 'Unscheduled', day: 0, lo: -9999, hi: 9999, forms: ['SV', 'VS'] },
]
export const VAX_LOG_FORMS = ['AE', 'CM', 'REACT', 'DV']

const yn = (v: string, l: string) => ({ value: v, label: l })
export const VAX_CODELISTS: Record<string, { value: string; label: string }[]> = {
  NY: [yn('Y', 'Yes'), yn('N', 'No')],
  SEX: [{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }, { value: 'U', label: 'Unknown' }],
  RACE: ['AMERICAN INDIAN OR ALASKA NATIVE', 'ASIAN', 'BLACK OR AFRICAN AMERICAN', 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER', 'WHITE', 'NOT REPORTED'].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() })),
  AESEV: [{ value: 'MILD', label: 'Mild (grade 1)' }, { value: 'MODERATE', label: 'Moderate (grade 2)' }, { value: 'SEVERE', label: 'Severe (grade 3)' }, { value: 'POTENTIALLY LIFE THREATENING', label: 'Potentially life-threatening (grade 4)' }],
  AEREL: [{ value: 'NOT RELATED', label: 'Not related' }, { value: 'RELATED', label: 'Related' }],
  AEACN: [{ value: 'NOT APPLICABLE', label: 'Not applicable (no further dose due)' }, { value: 'DOSE NOT CHANGED', label: 'Next dose given as planned' }, { value: 'DRUG WITHDRAWN', label: 'Next dose not given' }],
  AEOUT: [{ value: 'RECOVERED/RESOLVED', label: 'Recovered/resolved' }, { value: 'RECOVERING/RESOLVING', label: 'Recovering/resolving' }, { value: 'NOT RECOVERED/NOT RESOLVED', label: 'Not recovered/not resolved' }, { value: 'RECOVERED/RESOLVED WITH SEQUELAE', label: 'Recovered with sequelae' }, { value: 'FATAL', label: 'Fatal' }, { value: 'UNKNOWN', label: 'Unknown' }],
  ROUTE: [{ value: 'ORAL', label: 'Oral' }, { value: 'INTRAMUSCULAR', label: 'Intramuscular' }, { value: 'TOPICAL', label: 'Topical' }, { value: 'INHALATION', label: 'Inhalation' }],
  DOSU: [{ value: 'mg', label: 'mg' }, { value: 'g', label: 'g' }, { value: 'mL', label: 'mL' }, { value: 'TABLET', label: 'tablet' }],
  DSDECOD: [{ value: 'COMPLETED', label: 'Completed' }, { value: 'SCREEN FAILURE', label: 'Screen failure' }, { value: 'ADVERSE EVENT', label: 'Adverse event' }, { value: 'WITHDRAWAL BY SUBJECT', label: 'Withdrawal by subject' }, { value: 'LOST TO FOLLOW-UP', label: 'Lost to follow-up' }, { value: 'PHYSICIAN DECISION', label: 'Physician decision' }],
  DVCAT: ['Eligibility', 'Informed consent', 'Visit window', 'Prohibited medication', 'Investigational product', 'Safety reporting', 'Procedure not done', 'Other'].map((v) => ({ value: v.toUpperCase(), label: v })),
  IETEST: [{ value: 'IN01', label: 'IN01 Age 18 to 64 years' }, { value: 'IN02', label: 'IN02 Healthy on history and examination' }, { value: 'EX01', label: 'EX01 Fever of 38.0 °C or more, or acute illness, on Day 1' }, { value: 'EX02', label: 'EX02 Any respiratory vaccine in the last 12 months' }, { value: 'EX03', label: 'EX03 Immunosuppression or immunosuppressive therapy' }],
  LOC: [{ value: 'LEFT DELTOID', label: 'Left deltoid' }, { value: 'RIGHT DELTOID', label: 'Right deltoid' }],
  DOSENUM: [{ value: '1', label: 'Dose 1' }, { value: '2', label: 'Dose 2' }],
  SOLICIT: [
    { value: 'PAIN', label: 'Pain at the injection site' }, { value: 'REDNESS', label: 'Redness at the injection site' }, { value: 'SWELLING', label: 'Swelling at the injection site' },
    { value: 'FEVER', label: 'Fever' }, { value: 'HEADACHE', label: 'Headache' }, { value: 'FATIGUE', label: 'Fatigue' }, { value: 'MYALGIA', label: 'Muscle pain' },
    { value: 'ARTHRALGIA', label: 'Joint pain' }, { value: 'CHILLS', label: 'Chills' }, { value: 'NAUSEA', label: 'Nausea or vomiting' }, { value: 'DIARRHOEA', label: 'Diarrhoea' },
  ],
  GRADE: [{ value: '1', label: 'Grade 1 (mild)' }, { value: '2', label: 'Grade 2 (moderate)' }, { value: '3', label: 'Grade 3 (severe)' }, { value: '4', label: 'Grade 4 (potentially life-threatening)' }],
}

const SAE = { field: 'AESER', equals: 'Y' }
export const VAX_FORMS: Record<string, FormDef> = {
  SV: { id: 'SV', name: 'Visit or contact', domain: 'SV', fields: [
    { id: 'VISOCCUR', label: 'Did the visit or contact occur?', type: 'yn', codelist: 'NY', required: true },
    { id: 'VISDAT', label: 'Date', type: 'date', required: true, showIf: { field: 'VISOCCUR', equals: 'Y' }, ctq: true },
    { id: 'UNSREAS', label: 'Reason for the unscheduled visit', type: 'text', showIf: { field: '__visit', equals: 'UNS' } },
  ] },
  IC: { id: 'IC', name: 'Informed consent', domain: 'DS', fields: [
    { id: 'DSSTDAT', label: 'Date informed consent signed', type: 'date', required: true, ctq: true },
    { id: 'ICVER', label: 'Informed consent form version', type: 'text', required: true },
  ] },
  DM: { id: 'DM', name: 'Demographics', domain: 'DM', fields: [
    { id: 'BRTHYR', label: 'Year of birth', type: 'number', required: true },
    { id: 'SEX', label: 'Sex', type: 'select', codelist: 'SEX', required: true },
    { id: 'RACE', label: 'Race', type: 'select', codelist: 'RACE', required: true },
  ] },
  IE: { id: 'IE', name: 'Eligibility', domain: 'IE', fields: [
    { id: 'IEYN', label: 'Were all eligibility criteria met?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'IETESTCD', label: 'Criterion not met', type: 'select', codelist: 'IETEST', showIf: { field: 'IEYN', equals: 'N' } },
  ] },
  MH: { id: 'MH', name: 'Medical history', domain: 'MH', repeating: true, fields: [
    { id: 'MHTERM', label: 'Condition or event', type: 'text', required: true },
    { id: 'MHSTDAT', label: 'Start date', type: 'date' },
    { id: 'MHONGO', label: 'Ongoing?', type: 'yn', codelist: 'NY', required: true },
  ] },
  VS: { id: 'VS', name: 'Vital signs (before vaccination)', domain: 'VS', fields: [
    { id: 'VSDAT', label: 'Date of measurement', type: 'date', required: true },
    { id: 'TEMP', label: 'Oral temperature', type: 'number', unit: '°C', required: true, ctq: true },
    { id: 'SYSBP', label: 'Systolic blood pressure', type: 'number', unit: 'mmHg', required: true },
    { id: 'DIABP', label: 'Diastolic blood pressure', type: 'number', unit: 'mmHg', required: true },
    { id: 'PULSE', label: 'Pulse rate', type: 'number', unit: 'beats/min', required: true },
  ] },
  IMM: { id: 'IMM', name: 'Immunogenicity blood sample', domain: 'IS', fields: [
    { id: 'ISPERF', label: 'Was the blood sample taken?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'ISDAT', label: 'Collection date', type: 'date', showIf: { field: 'ISPERF', equals: 'Y' } },
    { id: 'ISTIM', label: 'Collection time (24-hour HH:MM, before vaccination on dosing days)', type: 'text', showIf: { field: 'ISPERF', equals: 'Y' } },
    { id: 'ISREFID', label: 'Tube barcode (BX followed by six digits)', type: 'text', showIf: { field: 'ISPERF', equals: 'Y' } },
  ] },
  VAX: { id: 'VAX', name: 'Vaccination', domain: 'EX', fields: [
    { id: 'EXOCCUR', label: 'Was the dose given?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'EXSTDAT', label: 'Date of vaccination', type: 'date', showIf: { field: 'EXOCCUR', equals: 'Y' }, ctq: true },
    { id: 'EXSTTIM', label: 'Time of vaccination (24-hour HH:MM)', type: 'text', showIf: { field: 'EXOCCUR', equals: 'Y' } },
    { id: 'EXLOC', label: 'Injection site', type: 'select', codelist: 'LOC', showIf: { field: 'EXOCCUR', equals: 'Y' } },
    { id: 'EXREFID', label: 'Blinded syringe ID (S followed by five digits)', type: 'text', showIf: { field: 'EXOCCUR', equals: 'Y' } },
    { id: 'OBS30', label: 'Any reaction in the 30-minute observation?', type: 'yn', codelist: 'NY', showIf: { field: 'EXOCCUR', equals: 'Y' } },
    { id: 'DIARYDEV', label: 'E-diary device ID issued or checked (ED followed by four digits)', type: 'text', showIf: { field: 'EXOCCUR', equals: 'Y' } },
  ] },
  CONT: { id: 'CONT', name: 'Safety contact', domain: 'SV', fields: [
    { id: 'DIARYREV', label: 'Was the e-diary reviewed with the participant?', type: 'yn', codelist: 'NY', required: true },
    { id: 'MAEVT', label: 'Any medically attended event since the last contact?', type: 'yn', codelist: 'NY', required: true, ctq: true },
  ] },
  DV: { id: 'DV', name: 'Protocol deviations', domain: 'DV', repeating: true, fields: [
    { id: 'DVSTDAT', label: 'Date the deviation occurred or was identified', type: 'date', required: true },
    { id: 'DVTERM', label: 'Description of the deviation', type: 'text', required: true },
    { id: 'DVDECOD', label: 'Deviation category', type: 'select', codelist: 'DVCAT', required: true },
    { id: 'DVIMPT', label: 'Important deviation?', type: 'yn', codelist: 'NY' },
  ] },
  EOS: { id: 'EOS', name: 'End of study', domain: 'DS', fields: [
    { id: 'DSDECOD', label: 'Status at end of study', type: 'select', codelist: 'DSDECOD', required: true, ctq: true },
    { id: 'EOSDAT', label: 'Date of completion or discontinuation', type: 'date', required: true },
  ] },
  REACT: { id: 'REACT', name: 'Solicited reaction continuing after the diary', domain: 'CE', repeating: true, fields: [
    { id: 'CETERM', label: 'Reaction', type: 'select', codelist: 'SOLICIT', required: true, ctq: true },
    { id: 'CEDOSE', label: 'After which dose?', type: 'select', codelist: 'DOSENUM', required: true },
    { id: 'CESTDAT', label: 'Start date (from the diary)', type: 'date', required: true },
    { id: 'CEENDAT', label: 'End date', type: 'date' },
    { id: 'CEMAXGR', label: 'Highest grade after the diary period', type: 'select', codelist: 'GRADE', required: true },
    { id: 'CEMA', label: 'Medically attended?', type: 'yn', codelist: 'NY', required: true },
  ] },
  AE: { id: 'AE', name: 'Unsolicited adverse events', domain: 'AE', repeating: true, fields: [
    { id: 'AETERM', label: 'Adverse event (verbatim)', type: 'text', required: true, ctq: true },
    { id: 'AESTDAT', label: 'Start date', type: 'date', required: true, ctq: true },
    { id: 'AEONGO', label: 'Ongoing?', type: 'yn', codelist: 'NY', required: true },
    { id: 'AEENDAT', label: 'End date', type: 'date', showIf: { field: 'AEONGO', equals: 'N' } },
    { id: 'AESEV', label: 'Severity (FDA toxicity grade)', type: 'select', codelist: 'AESEV', required: true },
    { id: 'AEMAAE', label: 'Medically attended?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'AESER', label: 'Serious?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'AESDTH', label: 'Results in death', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESLIFE', label: 'Is life-threatening', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESHOSP', label: 'Requires or prolongs hospitalisation', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESDISAB', label: 'Persistent or significant disability', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESCONG', label: 'Congenital anomaly', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESMIE', label: 'Other medically important event', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AEREL', label: 'Relationship to study vaccine', type: 'select', codelist: 'AEREL', required: true },
    { id: 'AEACN', label: 'Action taken with the next dose', type: 'select', codelist: 'AEACN', required: true },
    { id: 'AEOUT', label: 'Outcome', type: 'select', codelist: 'AEOUT', required: true },
  ] },
  CM: { id: 'CM', name: 'Concomitant medications', domain: 'CM', repeating: true, fields: [
    { id: 'CMTRT', label: 'Medication (trade or generic name)', type: 'text', required: true },
    { id: 'CMINDC', label: 'Indication', type: 'text', required: true },
    { id: 'CMDSTXT', label: 'Dose per administration', type: 'number', required: true },
    { id: 'CMDOSU', label: 'Dose unit', type: 'select', codelist: 'DOSU', required: true },
    { id: 'CMROUTE', label: 'Route', type: 'select', codelist: 'ROUTE', required: true },
    { id: 'CMSTDAT', label: 'Start date', type: 'date', required: true },
    { id: 'CMONGO', label: 'Ongoing?', type: 'yn', codelist: 'NY', required: true },
    { id: 'CMENDAT', label: 'End date', type: 'date', showIf: { field: 'CMONGO', equals: 'N' } },
  ] },
}

export const VAX_CCG_FORM: Record<string, string[]> = {
  SV: ['Record every clinic visit and phone contact. If a contact did not happen, select No and leave the other forms of that contact blank.'],
  IC: ['Record the date the participant signed consent and the version signed (current version v1.1).'],
  VS: ['Measure oral temperature before vaccination. If it is 38.0 °C or more, do not vaccinate: reschedule within the window.'],
  IMM: ['Take the blood sample before vaccination on dosing days. Copy the barcode from the tube label.'],
  VAX: ['Record the blinded syringe ID from the label; the unblinded pharmacist keeps the allocation. Observe the participant for 30 minutes. Check the e-diary device is charged and paired.'],
  CONT: ['At each phone contact, review the diary with the participant and ask about any visit to a doctor or hospital since the last contact.'],
  REACT: ['Complete only when a solicited reaction is still present on the last diary day (day 7). Follow it until it ends. Do not re-enter it as an unsolicited adverse event.'],
  AE: ['Unsolicited events: anything not on the diary list, or a diary reaction that a doctor diagnosed as something else. A diary fever is not entered again as an AE. A diary reaction that needed a doctor or hospital is also recorded here, marked medically attended.'],
  CM: ['Record antipyretics and pain relievers taken for reactions, with the reaction as the indication, as well as other medicines.'],
  EOS: ['Complete at Day 181 or on discontinuation.'],
}

// ---------- the e-diary and its grading ----------

export interface DiaryItem { id: string; label: string; kind: 'local' | 'systemic' | 'other'; type: 'mm' | 'temp' | 'scale' | 'yn' }
export const DIARY_ITEMS: DiaryItem[] = [
  { id: 'PAIN', label: 'Pain at the injection site', kind: 'local', type: 'scale' },
  { id: 'REDNESS', label: 'Redness (largest diameter, mm)', kind: 'local', type: 'mm' },
  { id: 'SWELLING', label: 'Swelling (largest diameter, mm)', kind: 'local', type: 'mm' },
  { id: 'TEMP', label: 'Oral temperature (°C)', kind: 'systemic', type: 'temp' },
  { id: 'HEADACHE', label: 'Headache', kind: 'systemic', type: 'scale' },
  { id: 'FATIGUE', label: 'Fatigue', kind: 'systemic', type: 'scale' },
  { id: 'MYALGIA', label: 'Muscle pain', kind: 'systemic', type: 'scale' },
  { id: 'ARTHRALGIA', label: 'Joint pain', kind: 'systemic', type: 'scale' },
  { id: 'CHILLS', label: 'Chills', kind: 'systemic', type: 'scale' },
  { id: 'NAUSEA', label: 'Nausea or vomiting', kind: 'systemic', type: 'scale' },
  { id: 'DIARRHOEA', label: 'Diarrhoea', kind: 'systemic', type: 'scale' },
  { id: 'MEDS', label: 'Took a medicine for fever or pain', kind: 'other', type: 'yn' },
  { id: 'MEDVISIT', label: 'Saw a doctor or went to hospital because of a reaction', kind: 'other', type: 'yn' },
]
export const SCALE_TEXT = ['None', 'Mild: does not interfere with activity', 'Moderate: some interference with activity', 'Severe: prevents daily activity']
export const DIARY_DAYS = 7

// FDA 2007 scale. Redness and swelling: grade 1 at 25 to 50 mm, grade 2 at 51 to 100 mm,
// grade 3 above 100 mm (grade 4, necrosis, is assessed by the investigator). Fever (oral):
// grade 1 at 38.0 to 38.4, grade 2 at 38.5 to 38.9, grade 3 at 39.0 to 40.0, grade 4 above 40.0.
// The participant's scale (mild, moderate, severe) maps to grades 1 to 3; grade 4 needs an
// emergency room visit or hospitalisation, confirmed by the site.
export function gradeMm(mm: number | null): number { if (mm === null || !Number.isFinite(mm)) return 0; return mm > 100 ? 3 : mm > 50 ? 2 : mm >= 25 ? 1 : 0 }
export function gradeTemp(t: number | null): number { if (t === null || !Number.isFinite(t)) return 0; const x = Math.round(t * 10) / 10; return x > 40 ? 4 : x >= 39 ? 3 : x >= 38.5 ? 2 : x >= 38 ? 1 : 0 }
export function gradeOf(item: string, raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0
  const d = DIARY_ITEMS.find((i) => i.id === item); if (!d) return 0
  const n = Number(raw)
  if (d.type === 'mm') return gradeMm(n)
  if (d.type === 'temp') return gradeTemp(n)
  if (d.type === 'scale') return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0
  return 0
}
export const GRADE_WORD = ['None', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']
