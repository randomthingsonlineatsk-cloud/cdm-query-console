// The data management plan for HLV-204-201, as delivered for review. Eight statements are
// wrong; each has a correction to choose. Other statements are correct and should be left.
import { CODELISTS, type Field } from './study'

export interface DmpOption { id: string; text: string }
export interface DmpStatement { id: string; text: string; error?: { correct: string; why: string; options: DmpOption[] } }
export interface DmpSection { id: string; title: string; statements: DmpStatement[] }

export const DMP_VERSION = 'DMP v0.3 draft for review, 16 February 2026'

export const DMP: DmpSection[] = [
  { id: 's1', title: '1. Purpose, scope and references', statements: [
    { id: '1.1', text: 'This plan describes how data for protocol HLV-204-201 are collected, cleaned, coded, reconciled, locked and archived, from database build to archiving.' },
    { id: '1.2', text: 'It follows ICH E6(R3) section 4 (data governance) and its computerised-systems expectations (with Annex 2 for the decentralised elements of amendment 2), 21 CFR Part 11, EU GMP Annex 11 (2011 text; the 2025 draft revision is tracked but not applied), and the SCDM Good Clinical Data Management Practices.' },
    { id: '1.3', text: 'The eCRF follows CDISC CDASHIG v2.3 with the SAE Supplement v2.0; controlled terminology is frozen at study start.' },
  ] },
  { id: 's2', title: '2. Roles and responsibilities', statements: [
    { id: '2.1', text: 'The lead data manager approves the DMP, the data validation specification and the UAT summary, and authorises database lock with the sponsor.' },
    { id: '2.2', text: 'Site staff enter data and answer queries. Site staff close queries once they have entered a response.', error: { correct: 'b', why: 'The site answers; data management (or the system, for an auto-query whose check no longer fires) closes. Otherwise nobody reviews the response.', options: [
      { id: 'a', text: 'Site staff close queries after the CRA has seen the response.' },
      { id: 'b', text: 'Site staff answer queries; data management reviews each answer and closes or re-queries it. The system closes an automatic query when its check no longer fires.' },
      { id: 'c', text: 'Queries close automatically 30 days after the site responds.' },
    ] } },
    { id: '2.3', text: 'Access is granted by role only after training is documented; accounts are personal and are never shared.' },
  ] },
  { id: 's3', title: '3. Data flow and systems', statements: [
    { id: '3.1', text: 'Sites enter data into the validated EDC within 5 working days of the visit. Central laboratory, central ECG and IRT data arrive as transfers under data transfer agreements.' },
    { id: '3.2', text: 'Local laboratory results are recorded as reported, with the unit on the report; conversion to standard units is done in SDTM, not by the site.' },
    { id: '3.3', text: 'Listings sent to the sponsor for central review include subject initials and full dates of birth so that duplicate subjects can be spotted.', error: { correct: 'c', why: 'Data minimisation (GDPR Article 5(1)(c); India’s DPDP Act) and pseudonymisation: subject IDs and year of birth are enough. Duplicate-subject checks use those plus demographics, not direct identifiers.', options: [
      { id: 'a', text: 'Listings include full names only for subjects at sites in India.' },
      { id: 'b', text: 'Listings include initials, but the date of birth is shown as day and month only.' },
      { id: 'c', text: 'Listings carry the pseudonymised subject ID and year of birth only; no direct identifiers leave the site. Duplicate-subject checks use these and demographics.' },
    ] } },
  ] },
  { id: 's4', title: '4. CRF design and completion', statements: [
    { id: '4.1', text: 'CRF completion guidelines are approved before go-live and every site user is trained on them before receiving access.' },
    { id: '4.2', text: 'Height is collected at screening only; BMI is derived by the system from each visit’s weight and the screening height.' },
  ] },
  { id: 's5', title: '5. Data validation and cleaning', statements: [
    { id: '5.1', text: 'Every edit check is listed in the data validation specification with its logic, its query text and its test cases.' },
    { id: '5.2', text: 'Edit checks are tested by the programmer who wrote them; a separate UAT is optional for checks that are simple ranges.', error: { correct: 'a', why: 'ICH E6(R3) section 4.3 asks for validation of computerised systems proportionate to risk, with documented testing; UAT by someone other than the programmer, with a signed summary, is standard practice before go-live.', options: [
      { id: 'a', text: 'All edit checks pass documented user acceptance testing by data management, independent of the programmer, with a signed UAT summary before go-live.' },
      { id: 'b', text: 'Edit checks are tested on live data during the first month and corrected as needed.' },
      { id: 'c', text: 'Only the checks on critical data are tested; the others are reviewed by reading the logic.' },
    ] } },
    { id: '5.3', text: 'Manual review listings are run every two weeks: AE and CM cross-review, vital-sign trends, duplicate records, and visit windows.' },
  ] },
  { id: 's6', title: '6. Query management', statements: [
    { id: '6.1', text: 'Query text is neutral, names the data point and the value seen, and never suggests the answer.' },
    { id: '6.2', text: 'Sites may change data without a reason for change when the change is minor, such as a typing error.', error: { correct: 'b', why: '21 CFR 11.10(e) and Annex 11 §9: every change is recorded with who, when and the old value, and the reason is recorded; ALCOA+ makes no exception for small changes.', options: [
      { id: 'a', text: 'A reason for change is needed only after the form has been source-data verified.' },
      { id: 'b', text: 'Every change after initial entry needs a reason for change; the audit trail keeps the old value, who changed it and when.' },
      { id: 'c', text: 'Minor changes are made by data management directly, without a query.' },
    ] } },
    { id: '6.3', text: 'Open queries are reported by age: 0 to 7, 8 to 14, 15 to 30, 31 to 60 and over 60 days. Queries open more than 30 days are escalated to the CRA.' },
  ] },
  { id: 's7', title: '7. Medical coding', statements: [
    { id: '7.1', text: 'Adverse events and medical history are coded to the lowest level term of the study dictionary; medications to the drug dictionary with ATC classification.' },
    { id: '7.2', text: 'The coding dictionary is updated automatically whenever a new version is published, and terms are recoded without review.', error: { correct: 'c', why: 'Dictionary versions are controlled: MedDRA releases come in March and September and WHODrug twice a year; the plan names the version in use and upgrades follow an impact assessment and a documented recoding review.', options: [
      { id: 'a', text: 'The dictionary is never updated during the study.' },
      { id: 'b', text: 'The dictionary is updated only at database lock.' },
      { id: 'c', text: 'The dictionary version is named in this plan. An upgrade follows an impact assessment, and changed codes are reviewed and approved before they are used.' },
    ] } },
  ] },
  { id: 's8', title: '8. Reconciliation', statements: [
    { id: '8.1', text: 'SAE reconciliation between the EDC and the safety database is done once, before database lock.', error: { correct: 'a', why: 'Reconciling only at the end finds discrepancies too late to fix with the site and can delay lock; reconciliation is done regularly (here monthly) and again at lock.', options: [
      { id: 'a', text: 'SAE reconciliation is done monthly and again before lock, comparing subject, event term, onset date, seriousness, outcome and causality.' },
      { id: 'b', text: 'SAE reconciliation is done by the safety team alone.' },
      { id: 'c', text: 'SAE reconciliation is done only for fatal events.' },
    ] } },
    { id: '8.2', text: 'External data (central lab, central ECG, IRT) are reconciled against the EDC at each transfer, using the keys and rules in each data transfer agreement.' },
  ] },
  { id: 's9', title: '9. Data review, metrics and risk-based quality management', statements: [
    { id: '9.1', text: 'Critical-to-quality data and quality tolerance limits are set in the risk assessment before go-live and reviewed by centralised monitoring.' },
    { id: '9.2', text: 'Metrics reported every two weeks: open queries and their age, time to resolution, re-query rate, data entry lag, and pages entered but not SDV-complete.' },
  ] },
  { id: 's10', title: '10. Database lock', statements: [
    { id: '10.1', text: 'The database may be locked with open queries if the principal investigators have signed the casebooks.', error: { correct: 'b', why: 'Lock criteria cover every query resolved, coding complete, reconciliations signed off, SDV complete as planned, casebooks signed and the approvals recorded; a PI signature does not replace them.', options: [
      { id: 'a', text: 'The database may be locked with up to 5% of queries open.' },
      { id: 'b', text: 'Lock needs all queries resolved, coding complete, reconciliations signed off, SDV complete as planned, investigator signatures, and written approval to lock.' },
      { id: 'c', text: 'The database is locked on the planned date whatever its state.' },
    ] } },
    { id: '10.2', text: 'After hard lock, any change needs a documented unlock request, approval by the sponsor, a re-lock, and an audit-trailed record of every change made.' },
  ] },
  { id: 's11', title: '11. Audit trail, security, privacy and archiving', statements: [
    { id: '11.1', text: 'The audit trail may be switched off during data migrations to improve performance, and switched on again afterwards.', error: { correct: 'c', why: '21 CFR 11.10(e) and Annex 11 §9 require a secure, computer-generated audit trail that cannot be switched off by users; migrations are validated and keep the audit trail.', options: [
      { id: 'a', text: 'The audit trail may be switched off only with the lead data manager’s approval.' },
      { id: 'b', text: 'The audit trail records only changes made after SDV.' },
      { id: 'c', text: 'The audit trail is always on and cannot be switched off by any user; migrations are validated and carry the audit trail with the data.' },
    ] } },
    { id: '11.2', text: 'Electronic signatures use two parts, user ID and PIN, and each signature records the signer, the date and time, and the meaning of the signature.' },
    { id: '11.3', text: 'The final data, audit trail and metadata are archived in a readable format for the retention period that applies (at least 25 years for EU trials).' },
  ] },
  { id: 's12', title: '12. Timelines', statements: [
    { id: '12.1', text: 'Go-live before first subject first visit on 2 March 2026; last subject last visit planned for October 2026; database lock within 4 weeks of the last visit.' },
  ] },
]
export const DMP_ERRORS = DMP.flatMap((s) => s.statements).filter((s) => s.error)

export function scoreDmp(flags: Record<string, string>) {
  let right = 0, wrongFix = 0, falseFlag = 0
  for (const st of DMP.flatMap((s) => s.statements)) {
    const f = flags[st.id]; if (!f) continue
    if (!st.error) falseFlag++
    else if (f === st.error.correct) right++
    else wrongFix++
  }
  const score = Math.max(0, Math.round(((right - falseFlag * 0.5) / DMP_ERRORS.length) * 100))
  return { right, wrongFix, falseFlag, missed: DMP_ERRORS.length - right - wrongFix, score }
}

// CRF completion guidelines: general conventions and form-level instructions.
export const CCG_GENERAL = [
  'Enter data in the EDC within 5 working days of the visit, from the source document.',
  'Dates are entered as YYYY-MM-DD. If part of a date is unknown, contact data management; do not guess.',
  'Never leave a required field blank. If a value was not collected, record why in the comment or answer the query.',
  'Every change after first entry needs a reason for change. The audit trail keeps the old value.',
  'Answer queries within 5 working days. Answer the question asked; if data are wrong, correct them in the form.',
  'Record laboratory values exactly as on the report, with the unit on the report. Do not convert units.',
]
export const CCG_FORM: Record<string, string[]> = {
  SV: ['Record whether each visit occurred. If it did not, select No and do not complete the other forms of that visit.'],
  IC: ['Record the date the subject signed the consent form and the version signed (current version v2.0).'],
  DM: ['Year of birth only; full date of birth is not collected.'],
  IE: ['If any criterion is not met, select No and the criterion. A subject who does not meet all criteria is not randomised.'],
  MH: ['Record conditions that started before consent. Anything that starts or worsens after consent is an adverse event.'],
  VS: ['Seated blood pressure after 5 minutes of rest, mean of three readings. Height at screening only. BMI is derived by the system: do not enter it.'],
  LB: ['Local results at screening, Week 4 and Week 12. Enter the sample date, not the report date.'],
  LBC: ['Record the accession number from the central laboratory requisition and the collection date and time (24-hour clock). The results come from the central laboratory transfer, not from the site.'],
  EG: ['QTcF as printed by the machine; the investigator’s interpretation is required.'],
  EX: ['Record the kit number from the label (K followed by four digits). Record tablets returned from the previous kit; none at Day 1. No new kit at Week 12.'],
  EOS: ['Complete at the last visit or on discontinuation. Screen failures: select Screen failure.'],
  AE: ['One event per record. Record a diagnosis where known, otherwise each sign or symptom separately. If serious, tick every criterion that applies. An ended event needs an end date.'],
  CM: ['Use the generic name where known, one medication per record. Give the specific condition as the indication (not “pain”).'],
}

// Field-level completion instructions, keyed FORM.FIELD. fieldGuide() adds the conventions
// every field shares (format, unit, required, codelist, derived) so the site sees one line.
export const CCG_FIELD: Record<string, string> = {
  'SV.VISOCCUR': 'Yes if the subject attended, even if not every assessment was done. No if the visit was missed; leave the other forms of the visit blank.',
  'SV.VISDAT': 'The date the subject attended the clinic, from the visit note. Must fall in the visit window; a visit out of window is still entered and becomes a deviation.',
  'SV.UNSREAS': 'Unscheduled visits only. The reason in a few words, for example “repeat potassium” or “BP check after dose change”.',
  'IC.DSSTDAT': 'The date the subject signed the consent form, as written on the form. It must be on or before every other study date.',
  'IC.ICVER': 'The version printed in the footer of the signed form, for example v2.0. If the subject re-consented, record the latest version signed.',
  'DM.BRTHYR': 'Four digits. Year only: a full date of birth is not collected.',
  'DM.SEX': 'Sex as recorded in the medical record, not gender identity.',
  'DM.RACE': 'As reported by the subject. Do not assign race from appearance. Select Not reported if the subject declines.',
  'IE.IEYN': 'Answer after every criterion has been checked against source. Yes only if all inclusion criteria are met and no exclusion criterion applies.',
  'IE.IETESTCD': 'Only when the answer above is No: the first criterion not met. Record any further criteria in the source.',
  'MH.MHTERM': 'One condition per record, as a diagnosis where known (for example “type 2 diabetes”, not “high sugar”).',
  'MH.MHSTDAT': 'As much of the date as the subject or the record gives. If only the year is known, contact data management rather than guessing a day.',
  'MH.MHONGO': 'Yes if the condition is still present at consent. A condition that worsens after consent is also recorded as an adverse event.',
  'VS.VSDAT': 'The date of the measurement, usually the visit date.',
  'VS.SYSBP': 'Seated, after 5 minutes of rest, mean of three readings, rounded to a whole number. This is the primary endpoint at Week 12.',
  'VS.DIABP': 'Same readings as the systolic value; mean of three, whole number.',
  'VS.PULSE': 'Seated, at the time of the first blood pressure reading.',
  'VS.WEIGHT': 'Without shoes or heavy clothing, one decimal place.',
  'VS.HEIGHT': 'Screening only, without shoes, whole centimetres. Leave blank at later visits.',
  'VS.BMI': 'Calculated by the system from weight and screening height. Do not enter or overwrite it.',
  'LB.LBDAT': 'The date the sample was taken, not the date the report was printed.',
  'LB.GLUC': 'Fasting value exactly as on the local laboratory report. Do not convert units.',
  'LB.GLUCU': 'The unit printed on the report next to the glucose result.',
  'LB.K': 'Exactly as on the report. A haemolysed sample is still entered, with a comment, and repeated.',
  'LB.CREAT': 'Exactly as on the report, in the unit shown on the form. If the report uses a different unit, contact data management.',
  'LB.ALT': 'Exactly as on the report.',
  'LBC.LBPERF': 'Yes if a central laboratory sample was taken at this visit. No if not, and record the reason in the source.',
  'LBC.LBREFID': 'Copy the accession number from the requisition label exactly. It links this record to the central laboratory transfer.',
  'LBC.LBDAT': 'The collection date on the requisition.',
  'LBC.LBTIM': '24-hour clock, HH:MM, as on the requisition.',
  'EG.EGDAT': 'The date on the ECG print-out.',
  'EG.QTCF': 'The QTcF value printed by the machine. Do not recalculate.',
  'EG.EGINTP': 'The investigator’s own reading, signed and dated on the print-out. Abnormal, clinically significant findings after consent are adverse events.',
  'EX.EXDISP': 'Yes if a new kit was handed to the subject at this visit. No new kit is dispensed at Week 12.',
  'EX.EXKIT': 'From the kit label: K followed by four digits. Must match the kit assigned by the IRT.',
  'EX.EXDSPQ': 'Tablets in the kit handed out, as counted at dispensing (30 for a full kit).',
  'EX.EXRET': 'Tablets counted back from the previous kit, including an empty bottle (0). Blank only at Day 1, when there is no previous kit.',
  'EX.EXCOMPL': 'Calculated by the system from tablets dispensed and returned. Do not enter it.',
  'DV.DVSTDAT': 'The date the deviation happened; if that is unknown, the date it was identified.',
  'DV.DVTERM': 'What happened, in plain words, without subject-identifying details.',
  'DV.DVDECOD': 'The category from the deviation plan that best fits.',
  'DV.DVIMPT': 'Set by the study team when the deviation is classified, not by the site.',
  'EOS.DSDECOD': 'The main reason. If the subject withdrew because of an adverse event, select Adverse event and make sure the event is on the AE form.',
  'EOS.EOSDAT': 'The date of the last visit or of the decision to stop, whichever is later.',
  'AE.AETERM': 'One event per record, as a diagnosis where known; otherwise each sign or symptom on its own record. No abbreviations.',
  'AE.AESTDAT': 'The date the event started or, for a pre-existing condition, the date it worsened.',
  'AE.AEONGO': 'Yes if the event has not resolved at this visit. If No, give the end date.',
  'AE.AEENDAT': 'The date the event resolved or stabilised. Blank while ongoing.',
  'AE.AESEV': 'Mild, moderate or severe as judged by the investigator. Severity is not seriousness: a severe headache is not automatically serious.',
  'AE.AESER': 'Yes if any of the seriousness criteria below applies. Report a serious event to the sponsor within 24 hours of awareness, as well as entering it here.',
  'AE.AESDTH': 'Tick if the event caused the death.',
  'AE.AESLIFE': 'Tick only if the subject was at immediate risk of death at the time of the event.',
  'AE.AESHOSP': 'Tick for an inpatient admission or a prolonged stay. A planned admission for a pre-existing condition is not an AE.',
  'AE.AESDISAB': 'Tick if the event caused a substantial disruption of the ability to carry out normal life functions.',
  'AE.AESCONG': 'Tick for a congenital anomaly or birth defect in a child of a subject.',
  'AE.AESMIE': 'Tick if, in the investigator’s judgement, the event is medically important even though no other criterion applies.',
  'AE.AEREL': 'The investigator’s assessment of whether the study drug could have caused the event.',
  'AE.AEACN': 'What was done with the study drug because of this event.',
  'AE.AEOUT': 'The outcome at the end date, or the current status if ongoing.',
  'AE.AECOM': 'Optional. Anything that helps a reviewer understand the event; no subject-identifying details.',
  'CM.CMTRT': 'Generic name where known, one medication per record. For combination products, record the trade name.',
  'CM.CMINDC': 'The specific condition treated (for example “osteoarthritis of the knee”, not “pain”). If it is for an AE, use the AE term.',
  'CM.CMDSTXT': 'The amount taken each time, as a number.',
  'CM.CMDOSU': 'The unit of the dose above.',
  'CM.CMROUTE': 'How the medication is taken.',
  'CM.CMSTDAT': 'The date the subject started taking it. If unknown, contact data management.',
  'CM.CMONGO': 'Yes if still being taken at this visit. If No, give the end date.',
  'CM.CMENDAT': 'The last day the medication was taken. Blank while ongoing.',
}

// The instruction a site user sees for one field: the field's own line plus the shared conventions.
export function fieldGuide(form: string, f: Field): { text: string; rules: string[] } {
  const rules: string[] = []
  if (f.derived) rules.push('Derived by the system')
  else if (f.required) rules.push(f.showIf ? 'Required when it applies' : 'Required')
  else rules.push('Complete if applicable')
  if (f.type === 'date') rules.push('YYYY-MM-DD')
  if (f.unit) rules.push(`Unit: ${f.unit}`)
  if (f.codelist) rules.push(`Codelist ${f.codelist}: ${(CODELISTS[f.codelist] ?? []).map((o) => o.value).join(', ')}`)
  return { text: CCG_FIELD[`${form}.${f.id}`] ?? '', rules }
}

// Risk assessment (ICH E6(R3) 3.10): risks to critical-to-quality factors and quality tolerance limits.
export const RISKS = [
  { id: 'R1', text: 'Ineligible subjects randomised (blood-pressure inclusion, potassium exclusion)', ctq: 'Eligibility', control: 'Edit checks IE-03 to IE-05; eligibility review before randomisation' },
  { id: 'R2', text: 'Primary endpoint (seated SBP at Week 12) missing or measured wrongly', ctq: 'Primary endpoint', control: 'Checks VS-01 and VS-07; visit-window check SV-04; centralised trend review' },
  { id: 'R3', text: 'SAEs not reported or reported late to the safety database', ctq: 'Subject safety', control: 'AE-13 and AE-14; monthly SAE reconciliation' },
  { id: 'R4', text: 'Laboratory unit errors at sites with local laboratories', ctq: 'Safety laboratory data', control: 'Unit-aware range checks LB-07 and LB-08' },
  { id: 'R5', text: 'Adverse events under-reported at some sites', ctq: 'Subject safety', control: 'Centralised monitoring of AE rates per site' },
  { id: 'R6', text: 'Study drug dispensed wrongly (missed visits, kit numbers)', ctq: 'Investigational product', control: 'EX-03, EX-07, EX-08; IRT reconciliation' },
  { id: 'R7', text: 'Consent on a superseded form version', ctq: 'Subject rights', control: 'IC-04; CRA review of consent at first monitoring visit' },
]
export const QTLS = [
  { id: 'Q1', text: 'Randomised subjects with an important eligibility deviation (%)', lo: 1, hi: 10, suggest: 5 },
  { id: 'Q2', text: 'Randomised subjects missing the primary endpoint at Week 12 (%)', lo: 5, hi: 20, suggest: 10 },
  { id: 'Q3', text: 'SAEs reported to the sponsor more than 24 hours after awareness (%)', lo: 1, hi: 10, suggest: 5 },
]
