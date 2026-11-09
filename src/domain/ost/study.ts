// The Ostrevia trial HRP-301 (VERDANT-1): lumiravostat 10 mg or 25 mg or placebo once daily for
// 16 weeks in adults with moderate to severe chronic hand eczema. It is the pivotal study in the
// Ostrevia NDA of the eCTD Dossier Builder, and the study the SDTM Mapping Trainer maps after
// lock (the Ostrevia lifecycle journey). The console holds the trial's four training sites.
// Severity is the Investigator Global Assessment for chronic hand eczema (IGA-CHE, 0 to 4) and the
// Hand Eczema Severity Index (HECSI, 0 to 360); itch is the participant's worst itch over the last
// 24 hours on a 0 to 10 numeric rating scale, recorded at each visit. Lumiravostat is an
// immunomodulator, so hepatitis B status is checked at screening: HBsAg positive excludes;
// anti-HBc positive with HBV DNA undetectable may enter with HBV DNA monitored by the central
// laboratory every 4 weeks. Forms follow CDISC CDASHIG v2.3 names; codelists use CDISC
// Controlled Terminology values where one exists. Everything here is fictional.

import type { FormDef, Site, Visit } from '../study'

export const OST_STUDY = {
  protocol: 'HRP-301',
  title: 'VERDANT-1: a randomised, double-blind, placebo-controlled phase 3 study of lumiravostat (Ostrevia) 10 mg and 25 mg once daily for 16 weeks in adults with moderate to severe chronic hand eczema',
  sponsor: 'Halcyon Ridge Pharmaceuticals (fictional)',
  cro: 'Marrowbridge Clinical (fictional)',
  drug: 'Ostrevia (lumiravostat) 10 mg and 25 mg film-coated tablets',
  ctVersion: 'the CDISC Controlled Terminology package current at database build (March 2026 release), frozen for the study',
  cdash: 'CDASHIG v2.3; central laboratory and IRT data by transfer',
  start: '2026-04-06',
  design: 'Randomised 1:1:1 to lumiravostat 10 mg, lumiravostat 25 mg or placebo once daily for 16 weeks, then 4 weeks off treatment; primary endpoint IGA-CHE 0 or 1 with at least a 2-grade improvement at Week 16',
}

export const OST_SITES: Site[] = [
  { id: '301', name: 'Lindenhof Dermatologie Studienzentrum', country: 'Germany', profile: 'clean', labUnit: 'mmol/L' },
  { id: '302', name: 'Bayview Dermatology Research', country: 'United States', profile: 'slow', labUnit: 'mmol/L' },
  { id: '303', name: 'Malabar Skin Research Centre', country: 'India', profile: 'new-coordinator', labUnit: 'mmol/L' },
  { id: '304', name: 'Kestrel Clinical Dermatology', country: 'Canada', profile: 'late', labUnit: 'mmol/L' },
]

// Day 1 = randomisation. Bottles are dispensed every 4 weeks; tablets are counted back at the
// next visit. The central laboratory sample is taken at every visit from screening to follow-up.
export const OST_VISITS: Visit[] = [
  { id: 'SCR', name: 'Screening', day: -14, lo: -28, hi: -1, forms: ['SV', 'IC', 'DM', 'IE', 'MH', 'VS', 'HBV', 'LBC', 'HEA'] },
  { id: 'D1', name: 'Day 1 (randomisation)', day: 1, lo: 1, hi: 1, forms: ['SV', 'VS', 'HEA', 'EX'] },
  { id: 'W2', name: 'Week 2', day: 15, lo: 12, hi: 18, forms: ['SV', 'LBC', 'HEA'] },
  { id: 'W4', name: 'Week 4', day: 29, lo: 26, hi: 32, forms: ['SV', 'VS', 'LBC', 'HEA', 'EX'] },
  { id: 'W8', name: 'Week 8', day: 57, lo: 53, hi: 61, forms: ['SV', 'VS', 'LBC', 'HEA', 'EX'] },
  { id: 'W12', name: 'Week 12', day: 85, lo: 81, hi: 89, forms: ['SV', 'LBC', 'HEA', 'EX'] },
  { id: 'W16', name: 'Week 16 (end of treatment)', day: 113, lo: 109, hi: 117, forms: ['SV', 'VS', 'LBC', 'HEA', 'EX'] },
  { id: 'FU', name: 'Week 20 follow-up', day: 141, lo: 134, hi: 148, forms: ['SV', 'LBC', 'EOS'] },
  { id: 'UNS', name: 'Unscheduled', day: 0, lo: -9999, hi: 9999, forms: ['SV', 'VS'] },
]
export const OST_LOG_FORMS = ['AE', 'CM', 'DV']

const opt = (v: string, l: string) => ({ value: v, label: l })
export const OST_CODELISTS: Record<string, { value: string; label: string }[]> = {
  NY: [opt('Y', 'Yes'), opt('N', 'No')],
  SEX: [opt('F', 'Female'), opt('M', 'Male'), opt('U', 'Unknown')],
  RACE: ['AMERICAN INDIAN OR ALASKA NATIVE', 'ASIAN', 'BLACK OR AFRICAN AMERICAN', 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER', 'WHITE', 'NOT REPORTED'].map((v) => opt(v, v.charAt(0) + v.slice(1).toLowerCase())),
  AESEV: [opt('MILD', 'Mild'), opt('MODERATE', 'Moderate'), opt('SEVERE', 'Severe')],
  AEREL: [opt('NOT RELATED', 'Not related'), opt('UNLIKELY RELATED', 'Unlikely related'), opt('POSSIBLY RELATED', 'Possibly related'), opt('RELATED', 'Related')],
  AEACN: [opt('DOSE NOT CHANGED', 'Dose not changed'), opt('DRUG INTERRUPTED', 'Drug interrupted'), opt('DRUG WITHDRAWN', 'Drug withdrawn'), opt('NOT APPLICABLE', 'Not applicable')],
  AEOUT: [opt('RECOVERED/RESOLVED', 'Recovered/resolved'), opt('RECOVERING/RESOLVING', 'Recovering/resolving'), opt('NOT RECOVERED/NOT RESOLVED', 'Not recovered/not resolved'), opt('RECOVERED/RESOLVED WITH SEQUELAE', 'Recovered with sequelae'), opt('FATAL', 'Fatal'), opt('UNKNOWN', 'Unknown')],
  ROUTE: [opt('ORAL', 'Oral'), opt('TOPICAL', 'Topical'), opt('INTRAVENOUS', 'Intravenous'), opt('SUBCUTANEOUS', 'Subcutaneous'), opt('INHALATION', 'Inhalation')],
  DOSU: [opt('mg', 'mg'), opt('g', 'g'), opt('ug', 'µg'), opt('mL', 'mL'), opt('TABLET', 'tablet'), opt('APPLICATION', 'application'), opt('PUFF', 'puff')],
  DSDECOD: [opt('COMPLETED', 'Completed'), opt('SCREEN FAILURE', 'Screen failure'), opt('ADVERSE EVENT', 'Adverse event'), opt('LACK OF EFFICACY', 'Lack of efficacy'), opt('WITHDRAWAL BY SUBJECT', 'Withdrawal by subject'), opt('LOST TO FOLLOW-UP', 'Lost to follow-up'), opt('PROTOCOL DEVIATION', 'Protocol deviation'), opt('PHYSICIAN DECISION', 'Physician decision')],
  DVCAT: ['Eligibility', 'Informed consent', 'Visit window', 'Prohibited medication', 'Investigational product', 'Safety reporting', 'Procedure not done', 'Other'].map((v) => opt(v.toUpperCase(), v)),
  IETEST: [
    opt('IN01', 'IN01 Age 18 to 75 years'),
    opt('IN02', 'IN02 Chronic hand eczema for at least 6 months, inadequately controlled with topical corticosteroids'),
    opt('IN03', 'IN03 IGA-CHE 3 (moderate) or 4 (severe) at screening and Day 1'),
    opt('EX01', 'EX01 HBsAg positive, or anti-HBc positive with HBV DNA detectable'),
    opt('EX02', 'EX02 Systemic immunosuppressant or phototherapy in the last 4 weeks'),
    opt('EX03', 'EX03 ALT above 2 × ULN at screening'),
  ],
  POSNEG: [opt('NEGATIVE', 'Negative'), opt('POSITIVE', 'Positive')],
  IGA: [opt('0', '0 Clear'), opt('1', '1 Almost clear'), opt('2', '2 Mild'), opt('3', '3 Moderate'), opt('4', '4 Severe')],
}

const SAE = { field: 'AESER', equals: 'Y' }
export const OST_FORMS: Record<string, FormDef> = {
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
    { id: 'SYSBP', label: 'Systolic blood pressure (seated)', type: 'number', unit: 'mmHg', required: true },
    { id: 'DIABP', label: 'Diastolic blood pressure (seated)', type: 'number', unit: 'mmHg', required: true },
    { id: 'PULSE', label: 'Pulse rate', type: 'number', unit: 'beats/min', required: true },
    { id: 'WEIGHT', label: 'Weight', type: 'number', unit: 'kg', required: true },
  ] },
  HBV: { id: 'HBV', name: 'Hepatitis B screening (central laboratory report)', domain: 'LB', fields: [
    { id: 'HBVDAT', label: 'Date of sample collection', type: 'date', required: true },
    { id: 'HBSAG', label: 'Hepatitis B surface antigen (HBsAg)', type: 'select', codelist: 'POSNEG', required: true, ctq: true },
    { id: 'HBCAB', label: 'Hepatitis B core antibody (anti-HBc)', type: 'select', codelist: 'POSNEG', required: true, ctq: true },
    { id: 'HBVDNA', label: 'HBV DNA (IU/mL, or UNDETECTABLE); only when anti-HBc is positive', type: 'text', showIf: { field: 'HBCAB', equals: 'POSITIVE' }, ctq: true },
  ] },
  LBC: { id: 'LBC', name: 'Central lab sample', domain: 'LB', fields: [
    { id: 'LBPERF', label: 'Was the central laboratory sample collected?', type: 'yn', codelist: 'NY', required: true },
    { id: 'LBREFID', label: 'Accession number (from the requisition)', type: 'text', showIf: { field: 'LBPERF', equals: 'Y' } },
    { id: 'LBDAT', label: 'Collection date', type: 'date', showIf: { field: 'LBPERF', equals: 'Y' } },
    { id: 'LBTIM', label: 'Collection time (24-hour HH:MM)', type: 'text', showIf: { field: 'LBPERF', equals: 'Y' } },
  ] },
  HEA: { id: 'HEA', name: 'Hand eczema assessments', domain: 'QS', fields: [
    { id: 'HEADAT', label: 'Date of assessment', type: 'date', required: true, ctq: true },
    { id: 'ASSESSOR', label: 'Assessor ID (trained, A followed by two digits)', type: 'text', required: true },
    { id: 'IGACHE', label: 'IGA-CHE (Investigator Global Assessment, chronic hand eczema)', type: 'select', codelist: 'IGA', required: true, ctq: true },
    { id: 'HECSI', label: 'HECSI total score (0 to 360)', type: 'number', required: true, ctq: true },
    { id: 'ITCHNRS', label: 'Worst itch over the last 24 hours, rated by the participant (0 to 10)', type: 'number', required: true },
  ] },
  EX: { id: 'EX', name: 'Study drug', domain: 'EX', fields: [
    { id: 'EXDISP', label: 'Was a bottle dispensed at this visit?', type: 'yn', codelist: 'NY', required: true },
    { id: 'EXKIT', label: 'Kit number dispensed', type: 'text', showIf: { field: 'EXDISP', equals: 'Y' } },
    { id: 'EXDSPQ', label: 'Tablets dispensed (drug accountability)', type: 'number', unit: 'tablets', showIf: { field: 'EXDISP', equals: 'Y' } },
    { id: 'EXRET', label: 'Tablets returned from the previous bottle', type: 'number', unit: 'tablets' },
    { id: 'EXCOMPL', label: 'Compliance since the previous bottle (derived)', type: 'number', unit: '%', derived: true },
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

// CRF completion guidelines, form level.
export const OST_CCG_FORM: Record<string, string[]> = {
  SV: ['Enter the date the participant attended. If a visit did not happen, answer No; do not leave the page empty.'],
  IC: ['The date the participant signed the current approved consent form (v2.0). Re-consent goes on a new page only when the ethics committee approves a new version.'],
  IE: ['Answer No if any criterion is not met and choose the first criterion not met. Participants who do not meet a criterion are screen failures: do not randomise them.'],
  MH: ['Record chronic hand eczema with its start date (month and year at least), and other conditions that are ongoing or ended in the last 5 years.'],
  VS: ['Seated, after 5 minutes of rest. Weight in kg with one decimal.'],
  HBV: ['Copy from the central laboratory screening report. HBV DNA is only reported for participants who are anti-HBc positive: enter the value in IU/mL, or UNDETECTABLE.'],
  LBC: ['Copy the accession number from the requisition label (NG followed by six digits). Results come from the central laboratory by transfer: do not enter results here.'],
  HEA: ['IGA-CHE and HECSI are scored by the trained assessor, the same assessor for a participant at every visit where possible. The participant rates their worst itch over the last 24 hours (0 no itch to 10 worst imaginable) before the examination. Score both hands; HECSI is 0 to 360.'],
  EX: ['Bottles hold 35 tablets: one tablet a day for 4 weeks plus 7 spare. Count the tablets returned from the previous bottle at every visit after Day 1. Compliance is calculated by the system.'],
  AE: ['Record every untoward medical event from consent to the Week 20 follow-up. A flare of hand eczema is an adverse event only if it is worse than the participant’s usual fluctuation. Serious events are also reported to safety within 24 hours.'],
  CM: ['Record all medicines and emollients used from 4 weeks before screening. Potent or very potent topical corticosteroids on the hands, and systemic corticosteroids, are prohibited during treatment: record them and tell the monitor.'],
  DV: ['Describe what happened and when. The monitor or data management classifies importance.'],
  EOS: ['Complete at the Week 20 follow-up, or when the participant stops the study early.'],
}
