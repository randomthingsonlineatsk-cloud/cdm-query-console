// The oncology trial ONK-44-302 (MERIDIAN-2): ONK-44 400 mg orally once daily against docetaxel
// 75 mg/m2 intravenously every 3 weeks, in adults with advanced non-small cell lung cancer after
// one platinum-based chemotherapy. Randomised 1:1, open label. Tumours are assessed by RECIST 1.1
// at screening and every 6 weeks from randomisation until progression, by the investigator (on
// the eCRF) and by a blinded independent central review (a vendor file). The primary endpoint is
// progression-free survival by the independent review; data cut-off 2026-10-31.
//
// The records the sites enter are the study's source records, the same ones the SDTM Mapping
// Trainer maps (source.json, written by that app's tests/cdmonk.test.mjs), so the cleaned and
// locked database here is the database the trainer maps. Forms follow CDASHIG v2.3 and the RECIST
// 1.1 tumour forms (lesion identification, lesion measurements, response). Everything is fictional.

import type { FormDef, Site, Visit } from '../study'

export const ONK_STUDY = {
  protocol: 'ONK-44-302',
  title: 'MERIDIAN-2: a randomised, open-label, phase 3 study of ONK-44 versus docetaxel in adults with advanced non-small cell lung cancer after one prior platinum-based chemotherapy',
  sponsor: 'Meridale Oncology (fictional)',
  cro: 'Marrowbridge Clinical (fictional)',
  drug: 'ONK-44 400 mg tablets; docetaxel 75 mg/m² infusion (comparator)',
  ctVersion: 'the CDISC Controlled Terminology package current at database build (September 2025 release), frozen for the study',
  cdash: 'CDASHIG v2.3 with the RECIST 1.1 tumour forms; randomisation (IRT) and the independent review by transfer',
  start: '2025-12-10',
  design: 'Randomised 1:1 to ONK-44 400 mg once daily or docetaxel 75 mg/m² every 3 weeks, in 21-day cycles until progression or unacceptable toxicity; CT or MRI at screening and every 6 weeks from randomisation, read by the investigator and by blinded independent central review; primary endpoint progression-free survival by the independent review; data cut-off 2026-10-31',
}
export const ONK_CUT = '2026-10-31'

export const ONK_SITES: Site[] = [
  { id: '401', name: 'Regional Cancer Centre, Bengaluru', country: 'India', profile: 'new-coordinator', labUnit: 'mmol/L' },
  { id: '402', name: 'Thoracic Oncology Unit, Leeds', country: 'United Kingdom', profile: 'clean', labUnit: 'mmol/L' },
]

// Day 1 = randomisation. Tumour assessments every 6 weeks (± 7 days) from randomisation.
const WEEKS = [6, 12, 18, 24, 30, 36, 42]
export const ONK_ASSESS = WEEKS.map((w) => `W${w}`)
export const ONK_VISITS: Visit[] = [
  { id: 'SCR', name: 'Screening (baseline tumour assessment)', day: -14, lo: -28, hi: -1, forms: ['SV', 'IC', 'DM', 'IE', 'PRP', 'TUI', 'TRM'], optional: ['TUI', 'TRM'] },
  { id: 'D1', name: 'Day 1 (randomisation)', day: 1, lo: 1, hi: 1, forms: ['SV'] },
  ...WEEKS.map((w) => ({ id: `W${w}`, name: `Week ${w} tumour assessment`, day: w * 7 + 1, lo: w * 7 - 6, hi: w * 7 + 8, forms: ['SV', 'TUI', 'TRM', 'RSP'], optional: ['TUI'] })),
  { id: 'UNS', name: 'Unscheduled', day: 0, lo: -9999, hi: 9999, forms: ['SV'] },
]
export const ONK_LOG_FORMS = ['EX', 'AE', 'DTH', 'LC', 'DV']
export const visitOfRaw = (v: string) => (v === 'Screening' ? 'SCR' : /^Week (\d+)$/.exec(v) ? `W${/^Week (\d+)$/.exec(v)![1]}` : v)

const opt = (v: string, l = v) => ({ value: v, label: l })
export const ONK_CODELISTS: Record<string, { value: string; label: string }[]> = {
  NY: [opt('Y', 'Yes'), opt('N', 'No')],
  SEX: [opt('Male'), opt('Female')],
  RACE: ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Native Hawaiian or Other Pacific Islander', 'White', 'Not reported'].map((v) => opt(v)),
  ETHNIC: [opt('Hispanic or Latino'), opt('Not Hispanic or Latino'), opt('Not reported')],
  PRCAT: [opt('Biopsy'), opt('Surgery'), opt('Radiotherapy')],
  LESTYPE: [opt('Target'), opt('Non-target'), opt('New')],
  METHOD: [opt('CT scan'), opt('MRI')],
  LESSTAT: [opt('Present'), opt('Absent'), opt('Unequivocal progression')],
  TRGRESP: [opt('CR', 'CR Complete response'), opt('PR', 'PR Partial response'), opt('SD', 'SD Stable disease'), opt('PD', 'PD Progressive disease'), opt('NE', 'NE Not evaluable')],
  NTRGRESP: [opt('CR', 'CR Complete response'), opt('NON-CR/NON-PD', 'Non-CR/Non-PD'), opt('PD', 'PD Progressive disease'), opt('NE', 'NE Not evaluable')],
  OVRLRESP: [opt('CR', 'CR Complete response'), opt('PR', 'PR Partial response'), opt('SD', 'SD Stable disease'), opt('PD', 'PD Progressive disease'), opt('NE', 'NE Not evaluable')],
  DTHCAUSE: [opt('Disease progression'), opt('Pneumonia'), opt('Pulmonary embolism'), opt('Other')],
  TOXGR: [opt('1', '1 Mild'), opt('2', '2 Moderate'), opt('3', '3 Severe'), opt('4', '4 Life-threatening'), opt('5', '5 Death')],
  AEREL: [opt('RELATED', 'Related'), opt('NOT RELATED', 'Not related')],
  AEACN: [opt('DOSE NOT CHANGED', 'Dose not changed'), opt('DOSE REDUCED', 'Dose reduced'), opt('DRUG INTERRUPTED', 'Drug interrupted (cycle delayed)'), opt('DRUG WITHDRAWN', 'Drug withdrawn'), opt('NOT APPLICABLE', 'Not applicable (after treatment ended)')],
  AEOUT: [opt('RECOVERED/RESOLVED', 'Recovered/resolved'), opt('RECOVERING/RESOLVING', 'Recovering/resolving'), opt('NOT RECOVERED/NOT RESOLVED', 'Not recovered/not resolved'), opt('RECOVERED/RESOLVED WITH SEQUELAE', 'Recovered with sequelae'), opt('FATAL', 'Fatal'), opt('UNKNOWN', 'Unknown')],
  DVCAT: ['Eligibility', 'Informed consent', 'Visit window', 'Prohibited medication', 'Investigational product', 'Safety reporting', 'Procedure not done', 'Other'].map((v) => opt(v.toUpperCase(), v)),
  IETEST: [
    opt('IN01', 'IN01 Aged 18 or over'),
    opt('IN02', 'IN02 Histologically confirmed advanced NSCLC that progressed after one platinum-based chemotherapy'),
    opt('IN03', 'IN03 At least one measurable lesion by RECIST 1.1'),
    opt('IN04', 'IN04 ECOG performance status 0 or 1'),
    opt('EX01', 'EX01 Untreated or symptomatic brain metastases'),
    opt('EX02', 'EX02 Earlier treatment with docetaxel'),
  ],
}

export const ONK_FORMS: Record<string, FormDef> = {
  SV: { id: 'SV', name: 'Visit', domain: 'SV', fields: [
    { id: 'VISOCCUR', label: 'Did the visit occur?', type: 'yn', codelist: 'NY', required: true },
    { id: 'VISDAT', label: 'Visit date', type: 'date', required: true, showIf: { field: 'VISOCCUR', equals: 'Y' }, ctq: true },
    { id: 'UNSREAS', label: 'Reason for the unscheduled visit, or why the visit did not occur', type: 'text' },
  ] },
  IC: { id: 'IC', name: 'Informed consent', domain: 'DS', fields: [
    { id: 'DSSTDAT', label: 'Date informed consent signed', type: 'date', required: true, ctq: true },
  ] },
  DM: { id: 'DM', name: 'Demographics', domain: 'DM', fields: [
    { id: 'BRTHDAT', label: 'Date of birth', type: 'date', required: true },
    { id: 'SEX', label: 'Sex', type: 'select', codelist: 'SEX', required: true },
    { id: 'RACE', label: 'Race', type: 'select', codelist: 'RACE', required: true },
    { id: 'ETHNIC', label: 'Ethnicity', type: 'select', codelist: 'ETHNIC', required: true },
  ] },
  IE: { id: 'IE', name: 'Eligibility', domain: 'IE', fields: [
    { id: 'IEYN', label: 'Were all eligibility criteria met?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'IETESTCD', label: 'Criterion not met', type: 'select', codelist: 'IETEST', showIf: { field: 'IEYN', equals: 'N' } },
  ] },
  PRP: { id: 'PRP', name: 'Prior cancer procedures', domain: 'PR', repeating: true, fields: [
    { id: 'PROC', label: 'Procedure', type: 'text', required: true },
    { id: 'PRCAT', label: 'Category', type: 'select', codelist: 'PRCAT', required: true },
    { id: 'LOC', label: 'Location', type: 'text', required: true },
    { id: 'LAT', label: 'Side', type: 'text' },
    { id: 'STDAT', label: 'Start date (YYYY-MM-DD, or YYYY-MM if the day is not known)', type: 'text', required: true },
    { id: 'ENDAT', label: 'End date (radiotherapy)', type: 'date', showIf: { field: 'PRCAT', equals: 'Radiotherapy' } },
    { id: 'DOSE', label: 'Total dose (radiotherapy)', type: 'number', unit: 'Gy', showIf: { field: 'PRCAT', equals: 'Radiotherapy' } },
    { id: 'DOSEU', label: 'Dose unit', type: 'text', showIf: { field: 'PRCAT', equals: 'Radiotherapy' } },
  ] },
  TUI: { id: 'TUI', name: 'Tumour lesion identification (RECIST 1.1)', domain: 'TU', repeating: true, fields: [
    { id: 'ASSDAT', label: 'Scan date', type: 'date', required: true, ctq: true },
    { id: 'LESID', label: 'Lesion ID (T01 to T05 target, NT01 non-target, NL01 new)', type: 'text', required: true, ctq: true },
    { id: 'LESTYPE', label: 'Lesion type', type: 'select', codelist: 'LESTYPE', required: true, ctq: true },
    { id: 'LOC', label: 'Location (organ)', type: 'text', required: true, ctq: true },
    { id: 'LAT', label: 'Side', type: 'text' },
    { id: 'NODAL', label: 'Lymph node?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'METHOD', label: 'Method', type: 'select', codelist: 'METHOD', required: true },
  ] },
  TRM: { id: 'TRM', name: 'Tumour lesion measurements', domain: 'TR', repeating: true, fields: [
    { id: 'ASSDAT', label: 'Scan date', type: 'date', ctq: true },
    { id: 'LESID', label: 'Lesion ID', type: 'text', required: true, ctq: true },
    { id: 'DIAM', label: 'Longest diameter (short axis for a lymph node), target lesions', type: 'number', unit: 'mm', ctq: true },
    { id: 'TSTM', label: 'Too small to measure (target lesion present but under 5 mm)', type: 'yn', codelist: 'NY' },
    { id: 'LESSTAT', label: 'State (non-target and new lesions)', type: 'select', codelist: 'LESSTAT' },
    { id: 'NOTDONE', label: 'Not assessed: reason', type: 'text' },
  ] },
  RSP: { id: 'RSP', name: 'Tumour response (investigator, RECIST 1.1)', domain: 'RS', fields: [
    { id: 'ASSDAT', label: 'Scan date', type: 'date', ctq: true },
    { id: 'SUMDIAM', label: 'Sum of diameters of the target lesions', type: 'number', unit: 'mm', ctq: true },
    { id: 'TRGRESP', label: 'Target lesion response', type: 'select', codelist: 'TRGRESP', required: true, ctq: true },
    { id: 'NTRGRESP', label: 'Non-target lesion response (blank if there are none)', type: 'select', codelist: 'NTRGRESP' },
    { id: 'NEWLES', label: 'New lesions?', type: 'yn', codelist: 'NY', ctq: true },
    { id: 'OVRLRESP', label: 'Overall response', type: 'select', codelist: 'OVRLRESP', required: true, ctq: true },
  ] },
  EX: { id: 'EX', name: 'Study treatment (one page per cycle)', domain: 'EX', repeating: true, fields: [
    { id: 'CYCLE', label: 'Cycle', type: 'number', required: true },
    { id: 'EXSTDAT', label: 'Start date (first dose, or the infusion date)', type: 'date', required: true, ctq: true },
    { id: 'EXENDAT', label: 'End date (last daily dose of the cycle, or the infusion date)', type: 'date', required: true, ctq: true },
  ] },
  AE: { id: 'AE', name: 'Adverse events', domain: 'AE', repeating: true, fields: [
    { id: 'AETERM', label: 'Adverse event (verbatim)', type: 'text', required: true, ctq: true },
    { id: 'AESTDAT', label: 'Start date', type: 'date', required: true, ctq: true },
    { id: 'AEONGO', label: 'Ongoing?', type: 'yn', codelist: 'NY', required: true },
    { id: 'AEENDAT', label: 'End date', type: 'date', showIf: { field: 'AEONGO', equals: 'N' } },
    { id: 'AETOXGR', label: 'Grade (CTCAE-style, 1 to 5)', type: 'select', codelist: 'TOXGR', required: true, ctq: true },
    { id: 'AESER', label: 'Serious?', type: 'yn', codelist: 'NY', required: true, ctq: true },
    { id: 'AESDTH', label: 'Results in death', type: 'yn', codelist: 'NY', showIf: { field: 'AESER', equals: 'Y' } },
    { id: 'AESLIFE', label: 'Is life-threatening', type: 'yn', codelist: 'NY', showIf: { field: 'AESER', equals: 'Y' } },
    { id: 'AESHOSP', label: 'Requires or prolongs hospitalisation', type: 'yn', codelist: 'NY', showIf: { field: 'AESER', equals: 'Y' } },
    { id: 'AESDISAB', label: 'Persistent or significant disability', type: 'yn', codelist: 'NY', showIf: { field: 'AESER', equals: 'Y' } },
    { id: 'AESCONG', label: 'Congenital anomaly', type: 'yn', codelist: 'NY', showIf: { field: 'AESER', equals: 'Y' } },
    { id: 'AESMIE', label: 'Other medically important event', type: 'yn', codelist: 'NY', showIf: { field: 'AESER', equals: 'Y' } },
    { id: 'AEREL', label: 'Related to study treatment?', type: 'select', codelist: 'AEREL', required: true },
    { id: 'AEACN', label: 'Action taken with study treatment', type: 'select', codelist: 'AEACN', required: true },
    { id: 'AEOUT', label: 'Outcome', type: 'select', codelist: 'AEOUT', required: true },
  ] },
  DTH: { id: 'DTH', name: 'Death', domain: 'DD', fields: [
    { id: 'DTHDAT', label: 'Date of death (YYYY-MM-DD, or YYYY-MM if the day is not known)', type: 'text', required: true, ctq: true },
    { id: 'DTHCAUSE', label: 'Primary cause of death', type: 'select', codelist: 'DTHCAUSE', required: true, ctq: true },
  ] },
  LC: { id: 'LC', name: 'Last contact', domain: 'DM', fields: [
    { id: 'LCDAT', label: 'Date of last contact (the participant known alive, or the visit before death)', type: 'date', required: true, ctq: true },
  ] },
  DV: { id: 'DV', name: 'Protocol deviations', domain: 'DV', repeating: true, fields: [
    { id: 'DVSTDAT', label: 'Date the deviation occurred or was identified', type: 'date', required: true },
    { id: 'DVTERM', label: 'Description of the deviation', type: 'text', required: true },
    { id: 'DVDECOD', label: 'Deviation category', type: 'select', codelist: 'DVCAT', required: true },
    { id: 'DVIMPT', label: 'Important deviation?', type: 'yn', codelist: 'NY' },
  ] },
}

export const ONK_CCG_FORM: Record<string, string[]> = {
  SV: ['Screening is the baseline scan visit. Day 1 is the randomisation date (from the IRT). Tumour assessment visits are every 6 weeks from randomisation, ± 7 days, until progression, including after treatment stops for another reason. If a scheduled scan was not done, answer No and give the reason.'],
  IC: ['The date the participant signed the approved consent form.'],
  DM: ['Copy from the source: date of birth, sex, race and ethnicity as the participant reported them.'],
  IE: ['Answer No if any criterion is not met and choose the first criterion not met. Participants who do not meet a criterion are screen failures: do not randomise them.'],
  PRP: ['Every earlier cancer procedure: biopsies, surgery and radiotherapy (with the total dose in Gy). A partial start date (YYYY-MM) is accepted when the day is not known.'],
  TUI: ['At screening, identify up to 5 target lesions (at most 2 per organ), measurable by RECIST 1.1: 10 mm or more in longest diameter, lymph nodes 15 mm or more in short axis. Every other lesion is non-target. A lesion seen for the first time after screening is New (NL01, NL02 …) and is recorded at the visit it appeared.'],
  TRM: ['One page per lesion per scan. Target lesions: the diameter in mm (short axis for a lymph node). A target lesion present but under 5 mm is too small to measure: tick it and leave the diameter blank. Non-target and new lesions: the state only. If the scan was not done, give the reason on every lesion page.'],
  RSP: ['The sum is the target diameters added up, with 5 mm for each lesion too small to measure. Target response: PR at 30% or more below the baseline sum; PD at 20% and 5 mm or more above the smallest sum so far (the nadir); CR when every target lesion has gone. A new lesion makes the overall response PD.'],
  EX: ['One page per 21-day cycle. ONK-44: the first and last daily dose of the cycle. Docetaxel: the infusion date as both start and end.'],
  AE: ['Every adverse event from the first dose to 30 days after the last dose, and any serious adverse event at any time. Disease progression is not an adverse event. Grade by the CTCAE-style scale (1 mild to 5 death). A serious event is also reported to drug safety on the SAE form within 24 hours; tick every seriousness criterion that applies. A fatal event is grade 5, outcome Fatal, with the date of death as its end date.'],
  DTH: ['Complete when the participant dies, from the death certificate or the medical record. If only the month is known, enter YYYY-MM and record how the death was reported.'],
  LC: ['The last date the participant was known alive; update it at every contact, including survival follow-up calls.'],
  DV: ['Describe what happened and when. The monitor or data management classifies importance.'],
}
