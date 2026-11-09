// The fictional study HLV-204-201. Forms follow CDISC CDASHIG v2.3 variable names; codelists
// use CDISC Controlled Terminology values where one exists. Everything here is fictional.

export interface Site { id: string; name: string; country: string; profile: SiteProfile; labUnit: 'mmol/L' | 'mg/dL' }
export type SiteProfile = 'clean' | 'slow' | 'new-coordinator' | 'under-reports' | 'other-units' | 'late'

export const STUDY: { protocol: string; title: string; sponsor: string; cro: string; drug: string; ctVersion: string; cdash: string; start: string; design?: string } = {
  protocol: 'HLV-204-201',
  title: 'A randomised, double-blind, placebo-controlled phase 2 study of Vasclarin (VSC-9) in adults with stage 1 or 2 hypertension',
  sponsor: 'Halvern Therapeutics (fictional)',
  cro: 'Marrowbridge Clinical (fictional)',
  drug: 'Vasclarin (VSC-9)',
  ctVersion: 'the CDISC Controlled Terminology package current at database build (December 2025 release), frozen for the study',
  cdash: 'CDASHIG v2.3 with CDASH Model v1.3 and the SAE Supplement v2.0',
  start: '2026-03-02',
}

export const SITES: Site[] = [
  { id: '101', name: 'Rheinfeld Clinical Research Unit', country: 'Germany', profile: 'clean', labUnit: 'mmol/L' },
  { id: '102', name: 'Westbrook Cardiology Associates', country: 'United States', profile: 'slow', labUnit: 'mmol/L' },
  { id: '103', name: 'Sahyadri Heart Institute', country: 'India', profile: 'new-coordinator', labUnit: 'mmol/L' },
  { id: '104', name: 'Lakeshore Hypertension Clinic', country: 'United States', profile: 'under-reports', labUnit: 'mmol/L' },
  { id: '105', name: 'Konkan Medical Research Centre', country: 'India', profile: 'other-units', labUnit: 'mg/dL' },
  { id: '106', name: 'Altstadt Praxis für Innere Medizin', country: 'Germany', profile: 'late', labUnit: 'mmol/L' },
]
export const PROFILE_TEXT: Record<SiteProfile, string> = {
  clean: 'Enters data quickly and answers queries within a few days.',
  slow: 'Enters data on time but takes weeks to answer queries.',
  'new-coordinator': 'A new study coordinator: transcription errors and missed fields.',
  'under-reports': 'Records few adverse events; centralised monitoring should notice.',
  'other-units': 'Its local laboratory reports glucose in mg/dL instead of mmol/L.',
  late: 'Enrolled late; data entry lags behind visits.',
}

// Visits: target study day and window (days). Day 1 = randomisation.
export interface Visit { id: string; name: string; day: number; lo: number; hi: number; forms: string[] }
export const VISITS: Visit[] = [
  { id: 'SCR', name: 'Screening', day: -14, lo: -28, hi: -1, forms: ['SV', 'IC', 'DM', 'IE', 'MH', 'VS', 'LB', 'LBC', 'EG'] },
  { id: 'D1', name: 'Day 1 (randomisation)', day: 1, lo: 1, hi: 1, forms: ['SV', 'VS', 'EX'] },
  { id: 'W2', name: 'Week 2', day: 15, lo: 12, hi: 18, forms: ['SV', 'VS', 'EX'] },
  { id: 'W4', name: 'Week 4', day: 29, lo: 26, hi: 32, forms: ['SV', 'VS', 'LB', 'LBC', 'EX'] },
  { id: 'W8', name: 'Week 8', day: 57, lo: 54, hi: 60, forms: ['SV', 'VS', 'EX'] },
  { id: 'W12', name: 'Week 12 (end of treatment)', day: 85, lo: 82, hi: 88, forms: ['SV', 'VS', 'LB', 'LBC', 'EG', 'EX'] },
  { id: 'FU', name: 'Week 14 follow-up', day: 99, lo: 96, hi: 102, forms: ['SV', 'VS', 'EOS'] },
  { id: 'UNS', name: 'Unscheduled', day: 0, lo: -9999, hi: 9999, forms: ['SV', 'VS'] },
]
export const LOG_FORMS: string[] = ['AE', 'CM', 'DV'] // subject-level, repeating

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'yn'
export interface Field {
  id: string            // CDASH variable name
  label: string
  type: FieldType
  unit?: string
  codelist?: string
  required?: boolean
  derived?: boolean
  showIf?: { field: string; equals: string } // field '__visit' compares with the visit ID
  ctq?: boolean         // critical to quality (risk assessment default)
}
export interface FormDef { id: string; name: string; domain: string; repeating?: boolean; fields: Field[] }

export const CODELISTS: Record<string, { value: string; label: string }[]> = {
  NY: [{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }],
  SEX: [{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }, { value: 'U', label: 'Unknown' }],
  RACE: ['AMERICAN INDIAN OR ALASKA NATIVE', 'ASIAN', 'BLACK OR AFRICAN AMERICAN', 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER', 'WHITE', 'NOT REPORTED'].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() })),
  AESEV: [{ value: 'MILD', label: 'Mild' }, { value: 'MODERATE', label: 'Moderate' }, { value: 'SEVERE', label: 'Severe' }],
  AEREL: [{ value: 'NOT RELATED', label: 'Not related' }, { value: 'UNLIKELY RELATED', label: 'Unlikely related' }, { value: 'POSSIBLY RELATED', label: 'Possibly related' }, { value: 'RELATED', label: 'Related' }],
  AEACN: [{ value: 'DOSE NOT CHANGED', label: 'Dose not changed' }, { value: 'DRUG INTERRUPTED', label: 'Drug interrupted' }, { value: 'DRUG WITHDRAWN', label: 'Drug withdrawn' }, { value: 'NOT APPLICABLE', label: 'Not applicable' }],
  AEOUT: [{ value: 'RECOVERED/RESOLVED', label: 'Recovered/resolved' }, { value: 'RECOVERING/RESOLVING', label: 'Recovering/resolving' }, { value: 'NOT RECOVERED/NOT RESOLVED', label: 'Not recovered/not resolved' }, { value: 'RECOVERED/RESOLVED WITH SEQUELAE', label: 'Recovered with sequelae' }, { value: 'FATAL', label: 'Fatal' }, { value: 'UNKNOWN', label: 'Unknown' }],
  ROUTE: [{ value: 'ORAL', label: 'Oral' }, { value: 'INTRAVENOUS', label: 'Intravenous' }, { value: 'SUBCUTANEOUS', label: 'Subcutaneous' }, { value: 'TOPICAL', label: 'Topical' }, { value: 'INHALATION', label: 'Inhalation' }],
  DOSU: [{ value: 'mg', label: 'mg' }, { value: 'g', label: 'g' }, { value: 'ug', label: 'µg' }, { value: 'mL', label: 'mL' }, { value: 'TABLET', label: 'tablet' }, { value: 'PUFF', label: 'puff' }],
  EGINTP: [{ value: 'NORMAL', label: 'Normal' }, { value: 'ABNORMAL NCS', label: 'Abnormal, not clinically significant' }, { value: 'ABNORMAL CS', label: 'Abnormal, clinically significant' }],
  GLUCU: [{ value: 'mmol/L', label: 'mmol/L' }, { value: 'mg/dL', label: 'mg/dL' }],
  DSDECOD: [{ value: 'COMPLETED', label: 'Completed' }, { value: 'SCREEN FAILURE', label: 'Screen failure' }, { value: 'DEATH', label: 'Death' },{ value: 'ADVERSE EVENT', label: 'Adverse event' }, { value: 'WITHDRAWAL BY SUBJECT', label: 'Withdrawal by subject' }, { value: 'LOST TO FOLLOW-UP', label: 'Lost to follow-up' }, { value: 'PROTOCOL DEVIATION', label: 'Protocol deviation' }, { value: 'PHYSICIAN DECISION', label: 'Physician decision' }],
  DVCAT: ['Eligibility', 'Informed consent', 'Visit window', 'Prohibited medication', 'Investigational product', 'Safety reporting', 'Procedure not done', 'Other'].map((v) => ({ value: v.toUpperCase(), label: v })),
  IETEST: [{ value: 'IN01', label: 'IN01 Age 18 to 75 years' }, { value: 'IN02', label: 'IN02 Seated SBP 140 to 179 mmHg at screening' }, { value: 'EX01', label: 'EX01 Secondary hypertension' }, { value: 'EX02', label: 'EX02 eGFR below 45 mL/min/1.73 m²' }, { value: 'EX03', label: 'EX03 Serum potassium above 5.5 mmol/L' }],
}

const SAE = { field: 'AESER', equals: 'Y' }
export const FORMS: Record<string, FormDef> = {
  SV: { id: 'SV', name: 'Visit', domain: 'SV', fields: [
    { id: 'VISOCCUR', label: 'Did the visit occur?', type: 'yn', codelist: 'NY', required: true },
    { id: 'VISDAT', label: 'Visit date', type: 'date', required: true, showIf: { field: 'VISOCCUR', equals: 'Y' }, ctq: true },
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
  VS: { id: 'VS', name: 'Vital signs', domain: 'VS', fields: [
    { id: 'VSDAT', label: 'Date of measurement', type: 'date', required: true },
    { id: 'SYSBP', label: 'Systolic blood pressure (seated)', type: 'number', unit: 'mmHg', required: true, ctq: true },
    { id: 'DIABP', label: 'Diastolic blood pressure (seated)', type: 'number', unit: 'mmHg', required: true, ctq: true },
    { id: 'PULSE', label: 'Pulse rate', type: 'number', unit: 'beats/min', required: true },
    { id: 'WEIGHT', label: 'Weight', type: 'number', unit: 'kg', required: true },
    { id: 'HEIGHT', label: 'Height (screening only)', type: 'number', unit: 'cm' },
    { id: 'BMI', label: 'Body mass index (derived)', type: 'number', unit: 'kg/m²', derived: true },
  ] },
  LB: { id: 'LB', name: 'Local laboratory', domain: 'LB', fields: [
    { id: 'LBDAT', label: 'Date of sample collection', type: 'date', required: true },
    { id: 'GLUC', label: 'Fasting glucose', type: 'number', required: true },
    { id: 'GLUCU', label: 'Glucose unit', type: 'select', codelist: 'GLUCU', required: true },
    { id: 'K', label: 'Potassium', type: 'number', unit: 'mmol/L', required: true, ctq: true },
    { id: 'CREAT', label: 'Creatinine', type: 'number', unit: 'µmol/L', required: true },
    { id: 'ALT', label: 'Alanine aminotransferase', type: 'number', unit: 'U/L', required: true },
  ] },
  LBC: { id: 'LBC', name: 'Central lab sample', domain: 'LB', fields: [
    { id: 'LBPERF', label: 'Was the central laboratory sample collected?', type: 'yn', codelist: 'NY', required: true },
    { id: 'LBREFID', label: 'Accession number (from the requisition)', type: 'text', showIf: { field: 'LBPERF', equals: 'Y' } },
    { id: 'LBDAT', label: 'Collection date', type: 'date', showIf: { field: 'LBPERF', equals: 'Y' } },
    { id: 'LBTIM', label: 'Collection time (24-hour HH:MM)', type: 'text', showIf: { field: 'LBPERF', equals: 'Y' } },
  ] },
  EG: { id: 'EG', name: '12-lead ECG', domain: 'EG', fields: [
    { id: 'EGDAT', label: 'Date of ECG', type: 'date', required: true },
    { id: 'QTCF', label: 'QTcF', type: 'number', unit: 'ms', required: true },
    { id: 'EGINTP', label: 'Investigator interpretation', type: 'select', codelist: 'EGINTP', required: true },
  ] },
  EX: { id: 'EX', name: 'Study drug', domain: 'EX', fields: [
    { id: 'EXDISP', label: 'Was study drug dispensed at this visit?', type: 'yn', codelist: 'NY', required: true },
    { id: 'EXKIT', label: 'Kit number dispensed', type: 'text', showIf: { field: 'EXDISP', equals: 'Y' } },
    { id: 'EXDSPQ', label: 'Tablets dispensed (drug accountability)', type: 'number', unit: 'tablets', showIf: { field: 'EXDISP', equals: 'Y' } },
    { id: 'EXRET', label: 'Tablets returned from the previous kit', type: 'number', unit: 'tablets' },
    { id: 'EXCOMPL', label: 'Compliance since the previous kit (derived)', type: 'number', unit: '%', derived: true },
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
  AE: { id: 'AE', name: 'Adverse events', domain: 'AE', repeating: true, fields: [
    { id: 'AETERM', label: 'Adverse event (verbatim)', type: 'text', required: true, ctq: true },
    { id: 'AESTDAT', label: 'Start date', type: 'date', required: true, ctq: true },
    { id: 'AEONGO', label: 'Ongoing?', type: 'yn', codelist: 'NY', required: true },
    { id: 'AEENDAT', label: 'End date', type: 'date', showIf: { field: 'AEONGO', equals: 'N' } },
    { id: 'AESEV', label: 'Severity', type: 'select', codelist: 'AESEV', required: true },
    { id: 'AESER', label: 'Serious?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'AESDTH', label: 'Results in death', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESLIFE', label: 'Is life-threatening', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESHOSP', label: 'Requires or prolongs hospitalisation', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESDISAB', label: 'Persistent or significant disability', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESCONG', label: 'Congenital anomaly', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AESMIE', label: 'Other medically important event', type: 'yn', codelist: 'NY', showIf: SAE },
    { id: 'AEREL', label: 'Relationship to study drug', type: 'select', codelist: 'AEREL', required: true },
    { id: 'AEACN', label: 'Action taken with study drug', type: 'select', codelist: 'AEACN', required: true },
    { id: 'AEOUT', label: 'Outcome', type: 'select', codelist: 'AEOUT', required: true },
    { id: 'AECOM', label: 'Comment', type: 'text' },
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

// Which study the console is running. Three studies share the same tools: HLV-204-201 (the
// hypertension trial), ALV-3-301 (the vaccine trial with an e-diary, Phase 5) and HRP-301
// (VERDANT-1, the Ostrevia trial in chronic hand eczema that the lifecycle journey follows). The study
// definition above is swapped in place when a project of the other study is opened
// (applyStudy in build.ts); HLV_DEF keeps the shipped hypertension study.
export const HLV_ID = 'HLV-204-201'
export const VAX_ID = 'ALV-3-301'
export const OST_ID = 'HRP-301'
export const ACTIVE = { id: HLV_ID as string }
export const isVax = () => ACTIVE.id === VAX_ID
export const isOst = () => ACTIVE.id === OST_ID
export const HLV_DEF = structuredClone({ study: STUDY, sites: SITES, visits: VISITS, logForms: LOG_FORMS, forms: FORMS, codelists: CODELISTS })

export const visitById = (id: string) => VISITS.find((v) => v.id === id)!
export const fieldOf = (form: string, field: string) => FORMS[form].fields.find((f) => f.id === field)
// SDTM target shown in the annotated CRF view (links to the SDTM Mapping Trainer).
export const sdtmTarget = (form: string, field: string): string => {
  const f = FORMS[form]
  const map: Record<string, string> = { EXDSPQ: 'DA.DAORRES (DATESTCD = DISPAMT)', EXRET: 'DA.DAORRES (DATESTCD = RETAMT)', EXCOMPL: 'Derived for review (not submitted)', UNSREAS: 'SV.SVREASOC', DVSTDAT: 'DV.DVSTDTC', DVTERM: 'DV.DVTERM', DVDECOD: 'DV.DVDECOD', DVIMPT: 'DV.DVCAT', LBREFID: 'LB.LBREFID', LBTIM: 'LB.LBDTC (time part)', LBPERF: 'LB.LBSTAT (NOT DONE when No)', VISDAT: 'SV.SVSTDTC', DSSTDAT: 'DS.DSSTDTC (DSDECOD = INFORMED CONSENT OBTAINED)', BRTHYR: 'DM.BRTHDTC', SYSBP: 'VS.VSORRES (VSTESTCD = SYSBP)', DIABP: 'VS.VSORRES (VSTESTCD = DIABP)', PULSE: 'VS.VSORRES (VSTESTCD = PULSE)', WEIGHT: 'VS.VSORRES (VSTESTCD = WEIGHT)', HEIGHT: 'VS.VSORRES (VSTESTCD = HEIGHT)', BMI: 'VS.VSORRES (VSTESTCD = BMI)', GLUC: 'LB.LBORRES (LBTESTCD = GLUC)', GLUCU: 'LB.LBORRESU', K: 'LB.LBORRES (LBTESTCD = K)', CREAT: 'LB.LBORRES (LBTESTCD = CREAT)', ALT: 'LB.LBORRES (LBTESTCD = ALT)', QTCF: 'EG.EGORRES (EGTESTCD = QTCFAG)', EOSDAT: 'DS.DSSTDTC', AESTDAT: 'AE.AESTDTC', AEENDAT: 'AE.AEENDTC', CMSTDAT: 'CM.CMSTDTC', CMENDAT: 'CM.CMENDTC', CMDSTXT: 'CM.CMDOSE', MHSTDAT: 'MH.MHSTDTC', VSDAT: 'VS.VSDTC', LBDAT: 'LB.LBDTC', EGDAT: 'EG.EGDTC', IETESTCD: 'IE.IETESTCD' }
  return map[field] ?? `${f.domain}.${field}`
}
