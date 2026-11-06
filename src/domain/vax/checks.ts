// Edit checks for the vaccine study ALV-3-301. Numbered from 51 so they never share an ID with
// the hypertension study's checks. The e-diary is not checked here: diary data are electronic
// source held by the diary vendor, checked on transfer and corrected only through a data
// clarification form (see diary.ts).

import type { Check, CheckAction, CheckCategory, CheckTest } from '../types'
import { VAX_FORMS } from './study'

const T = (name: string, values: Record<string, string>, fire: boolean, ctx?: Record<string, string>): CheckTest => ({ name, values, fire, ctx })
function c(id: string, title: string, category: CheckCategory, form: string, field: string, expr: string, message: string, tests: CheckTest[], extra: Partial<Check> = {}): Check {
  return { id, title, category, action: 'query' as CheckAction, form, field, expr, message, tests, active: true, ...extra }
}
function miss(id: string, form: string, field: string, when?: string, whenVals: Record<string, string> = {}, visits?: string[]): Check {
  const f = VAX_FORMS[form].fields.find((x) => x.id === field)!
  const expr = when ? `${when} and isblank(${field})` : `isblank(${field})`
  return c(id, `${f.label} is missing${when ? ' (conditional)' : ''}`, 'missing', form, field, expr,
    `${f.label} is blank. Please enter the value from the source document, or record why it is not available.`,
    [T('Blank fires', { ...whenVals, [field]: '' }, true), T('Entered value passes', { ...whenVals, [field]: f.type === 'date' ? '2026-05-01' : f.type === 'number' ? '1' : 'Y' }, false)], { visits })
}
const SAE6 = 'any(AESDTH, AESLIFE, AESHOSP, AESDISAB, AESCONG, AESMIE)'
const noSae = { AESDTH: 'N', AESLIFE: 'N', AESHOSP: 'N', AESDISAB: 'N', AESCONG: 'N', AESMIE: 'N' }
const DOSE_DAY = "(CEDOSE = '1' and present(visdat('D1')) and days(visdat('D1'), CESTDAT) > 6) or (CEDOSE = '2' and present(visdat('D29')) and days(visdat('D29'), CESTDAT) > 6)"

export const VAX_CHECKS: Check[] = [
  // SV — visits and contacts
  miss('SV-51', 'SV', 'VISOCCUR'),
  miss('SV-52', 'SV', 'VISDAT', "VISOCCUR = 'Y'", { VISOCCUR: 'Y' }),
  c('SV-53', 'Visit date is in the future', 'date', 'SV', 'VISDAT', 'VISDAT > today()', 'The date {VISDAT} is after today. Please check the date against the source.', [T('Future fires', { VISDAT: '2026-12-01' }, true, { today: '2026-06-01' }), T('Past passes', { VISDAT: '2026-05-01' }, false, { today: '2026-06-01' })]),
  c('SV-54', 'Visit or contact outside the protocol window', 'protocol', 'SV', 'VISDAT', 'present(rand()) and (days(rand(), VISDAT) + 1 < winlo() or days(rand(), VISDAT) + 1 > winhi())', 'The visit on {VISDAT} is on study day {studyday}, outside the protocol window (days {winlo} to {winhi}). Please confirm the date; if it is correct, the deviation will be recorded.', [T('Day 38 at dose 2 fires', { VISDAT: '2026-05-13' }, true, { rand: '2026-04-06', winlo: '27', winhi: '35' }), T('Day 29 passes', { VISDAT: '2026-05-04' }, false, { rand: '2026-04-06', winlo: '27', winhi: '35' })], { visits: ['PC1', 'D29', 'PC2', 'D57', 'D181'] }),
  c('SV-55', 'Visit date not after the previous visit', 'date', 'SV', 'VISDAT', 'present(prevvisdat()) and days(prevvisdat(), VISDAT) <= 0', 'The date {VISDAT} is on or before the previous visit or contact. Please check the dates.', [T('Same day fires', { VISDAT: '2026-04-13' }, true, { prevvisdat: '2026-04-13' }), T('Later passes', { VISDAT: '2026-05-04' }, false, { prevvisdat: '2026-04-13' })], { visits: ['PC1', 'D29', 'PC2', 'D57', 'D181'] }),
  miss('SV-56', 'SV', 'UNSREAS', undefined, {}, ['UNS']),
  // IC, DM, IE
  miss('IC-51', 'IC', 'DSSTDAT'), miss('IC-52', 'IC', 'ICVER'),
  c('IC-53', 'Consent signed after the first dose visit', 'date', 'IC', 'DSSTDAT', "present(visdat('D1')) and days(DSSTDAT, visdat('D1')) < 0", 'Consent is dated {DSSTDAT}, after the Day 1 visit. Please confirm consent was obtained before any study procedure.', [T('After fires', { DSSTDAT: '2026-04-08' }, true, { 'visdat:D1': '2026-04-06' }), T('Same day passes', { DSSTDAT: '2026-04-06' }, false, { 'visdat:D1': '2026-04-06' })]),
  c('IC-54', 'Superseded consent version', 'protocol', 'IC', 'ICVER', "present(ICVER) and ICVER != 'v1.1'", 'The consent version is {ICVER}; the current approved version is v1.1. Please confirm the version signed.', [T('v1.0 fires', { ICVER: 'v1.0' }, true), T('v1.1 passes', { ICVER: 'v1.1' }, false)]),
  miss('DM-51', 'DM', 'BRTHYR'), miss('DM-52', 'DM', 'SEX'),
  c('DM-53', 'Age outside 18 to 64 years', 'protocol', 'DM', 'BRTHYR', 'present(consent()) and (year(consent()) - BRTHYR < 18 or year(consent()) - BRTHYR > 64)', 'Year of birth {BRTHYR} gives an age outside 18 to 64 at consent. Please confirm the year of birth and eligibility.', [T('Age 70 fires', { BRTHYR: '1956' }, true, { consent: '2026-04-06' }), T('Age 40 passes', { BRTHYR: '1986' }, false, { consent: '2026-04-06' })]),
  miss('IE-51', 'IE', 'IEYN'),
  c('IE-52', 'Vaccinated although not eligible', 'protocol', 'IE', 'IEYN', "IEYN = 'N' and val('D1', 'VAX', 'EXOCCUR') = 'Y'", 'Eligibility is recorded as not met, but dose 1 was given. Please confirm eligibility.', [T('Fires', { IEYN: 'N' }, true, { 'val:D1|VAX|EXOCCUR': 'Y' }), T('Passes', { IEYN: 'Y' }, false, { 'val:D1|VAX|EXOCCUR': 'Y' })]),
  // VS — before vaccination
  miss('VS-51', 'VS', 'TEMP'),
  c('VS-52', 'Vaccinated with fever', 'protocol', 'VS', 'TEMP', "TEMP >= 38 and val(vis(), 'VAX', 'EXOCCUR') = 'Y'", 'The temperature before vaccination was {TEMP} °C, yet the dose was given. The protocol requires vaccination to be postponed. Please confirm.', [T('38.2 and dosed fires', { TEMP: '38.2' }, true, { 'val:D1|VAX|EXOCCUR': 'Y', vis: 'D1' }), T('36.8 passes', { TEMP: '36.8' }, false, { 'val:D1|VAX|EXOCCUR': 'Y', vis: 'D1' })], { visits: ['D1', 'D29'] }),
  c('VS-53', 'Temperature not plausible', 'range', 'VS', 'TEMP', 'TEMP < 34 or TEMP > 42', 'A temperature of {TEMP} °C is not plausible. Please check the value and the unit (°C).', [T('98.6 fires', { TEMP: '98.6' }, true), T('36.7 passes', { TEMP: '36.7' }, false)]),
  c('VS-54', 'Blood pressure not plausible', 'range', 'VS', 'SYSBP', 'SYSBP < 80 or SYSBP > 200', 'Systolic BP {SYSBP} mmHg is outside 80 to 200. Please verify against the source.', [T('1250 fires', { SYSBP: '1250' }, true), T('124 passes', { SYSBP: '124' }, false)]),
  // IMM — immunogenicity sample
  miss('IMM-01', 'IMM', 'ISPERF'),
  miss('IMM-02', 'IMM', 'ISDAT', "ISPERF = 'Y'", { ISPERF: 'Y' }),
  c('IMM-03', 'Sample date differs from the visit date', 'date', 'IMM', 'ISDAT', 'present(ISDAT) and present(visdat(vis())) and ISDAT != visdat(vis())', 'The sample date {ISDAT} differs from the visit date {visdat}. Please check.', [T('Fires', { ISDAT: '2026-05-05' }, true, { vis: 'D29', 'visdat:D29': '2026-05-04' }), T('Passes', { ISDAT: '2026-05-04' }, false, { vis: 'D29', 'visdat:D29': '2026-05-04' })]),
  c('IMM-04', 'Tube barcode format', 'range', 'IMM', 'ISREFID', "present(ISREFID) and not pattern(ISREFID, 'BX######')", 'The tube barcode "{ISREFID}" is not in the format BX followed by six digits. Please copy it from the tube label.', [T('Fires', { ISREFID: 'B123456' }, true), T('Passes', { ISREFID: 'BX123456' }, false)]),
  // VAX — vaccination
  miss('VAX-01', 'VAX', 'EXOCCUR'),
  miss('VAX-02', 'VAX', 'EXSTDAT', "EXOCCUR = 'Y'", { EXOCCUR: 'Y' }),
  c('VAX-03', 'Vaccination date differs from the visit date', 'date', 'VAX', 'EXSTDAT', 'present(EXSTDAT) and present(visdat(vis())) and EXSTDAT != visdat(vis())', 'The vaccination date {EXSTDAT} differs from the visit date {visdat}. Please check.', [T('Fires', { EXSTDAT: '2026-04-07' }, true, { vis: 'D1', 'visdat:D1': '2026-04-06' }), T('Passes', { EXSTDAT: '2026-04-06' }, false, { vis: 'D1', 'visdat:D1': '2026-04-06' })]),
  c('VAX-04', 'Syringe ID format', 'range', 'VAX', 'EXREFID', "present(EXREFID) and not pattern(EXREFID, 'S#####')", 'The syringe ID "{EXREFID}" is not in the format S followed by five digits. Please copy it from the syringe label.', [T('Fires', { EXREFID: '12345' }, true), T('Passes', { EXREFID: 'S12345' }, false)]),
  miss('VAX-05', 'VAX', 'DIARYDEV', "EXOCCUR = 'Y'", { EXOCCUR: 'Y' }),
  c('VAX-06', 'Diary device ID format', 'range', 'VAX', 'DIARYDEV', "present(DIARYDEV) and not pattern(DIARYDEV, 'ED####')", 'The device ID "{DIARYDEV}" is not in the format ED followed by four digits. Please check the device label.', [T('Fires', { DIARYDEV: 'E1234' }, true), T('Passes', { DIARYDEV: 'ED1234' }, false)]),
  c('VAX-07', 'Second dose outside days 27 to 35', 'protocol', 'VAX', 'EXSTDAT', "present(EXSTDAT) and present(visdat('D1')) and (days(visdat('D1'), EXSTDAT) + 1 < 27 or days(visdat('D1'), EXSTDAT) + 1 > 35)", 'Dose 2 on {EXSTDAT} is outside study days 27 to 35. Please confirm; if correct, it is a protocol deviation.', [T('Day 37 fires', { EXSTDAT: '2026-05-12' }, true, { 'visdat:D1': '2026-04-06' }), T('Day 29 passes', { EXSTDAT: '2026-05-04' }, false, { 'visdat:D1': '2026-04-06' })], { visits: ['D29'] }),
  c('VAX-08', 'Reaction during observation with no AE recorded', 'cross-form', 'VAX', 'OBS30', "OBS30 = 'Y' and aecount('AEMAAE', 'Y') + aecount('AEMAAE', 'N') = 0", 'A reaction during the 30-minute observation is recorded, but there is no adverse event. Please record the reaction as an AE.', [T('Fires', { OBS30: 'Y' }, true, { 'aecount:AEMAAE|Y': '0', 'aecount:AEMAAE|N': '0' }), T('Passes', { OBS30: 'Y' }, false, { 'aecount:AEMAAE|Y': '0', 'aecount:AEMAAE|N': '1' })]),
  // CONT — phone contacts
  miss('CONT-01', 'CONT', 'MAEVT'),
  c('CONT-02', 'Medically attended event with no matching AE', 'cross-form', 'CONT', 'MAEVT', "MAEVT = 'Y' and aecount('AEMAAE', 'Y') = 0", 'A medically attended event was reported at this contact, but no AE is marked medically attended. Please record the event as an AE.', [T('Fires', { MAEVT: 'Y' }, true, { 'aecount:AEMAAE|Y': '0' }), T('Passes', { MAEVT: 'Y' }, false, { 'aecount:AEMAAE|Y': '1' })]),
  // REACT — reactions continuing after the diary
  miss('REACT-01', 'REACT', 'CEMAXGR'),
  c('REACT-02', 'Reaction did not start in the diary period', 'protocol', 'REACT', 'CESTDAT', DOSE_DAY, 'The reaction started on {CESTDAT}, after the 7-day diary period for dose {CEDOSE}. A new event after the diary period is an unsolicited AE. Please review.', [T('Day 9 fires', { CEDOSE: '1', CESTDAT: '2026-04-14' }, true, { 'visdat:D1': '2026-04-06' }), T('Day 2 passes', { CEDOSE: '1', CESTDAT: '2026-04-07' }, false, { 'visdat:D1': '2026-04-06' })]),
  c('REACT-03', 'Reaction end date before start date', 'date', 'REACT', 'CEENDAT', 'present(CEENDAT) and days(CESTDAT, CEENDAT) < 0', 'The end date {CEENDAT} is before the start date {CESTDAT}. Please check.', [T('Fires', { CESTDAT: '2026-04-08', CEENDAT: '2026-04-07' }, true), T('Passes', { CESTDAT: '2026-04-08', CEENDAT: '2026-04-15' }, false)]),
  c('REACT-04', 'Reaction ended within the diary period', 'cross-form', 'REACT', 'CEENDAT', "present(CEENDAT) and ((CEDOSE = '1' and days(visdat('D1'), CEENDAT) <= 6) or (CEDOSE = '2' and days(visdat('D29'), CEENDAT) <= 6))", 'The reaction ended on {CEENDAT}, within the diary period, so this form is not needed. Please check the dates or remove the record.', [T('Day 5 fires', { CEDOSE: '1', CEENDAT: '2026-04-10' }, true, { 'visdat:D1': '2026-04-06' }), T('Day 10 passes', { CEDOSE: '1', CEENDAT: '2026-04-15' }, false, { 'visdat:D1': '2026-04-06' })]),
  // AE — unsolicited
  miss('AE-51', 'AE', 'AETERM'), miss('AE-52', 'AE', 'AESTDAT'), miss('AE-53', 'AE', 'AESEV'), miss('AE-54', 'AE', 'AEMAAE'), miss('AE-55', 'AE', 'AESER'), miss('AE-56', 'AE', 'AEREL'),
  miss('AE-57', 'AE', 'AEENDAT', "AEONGO = 'N'", { AEONGO: 'N' }),
  c('AE-58', 'AE end date before start date', 'date', 'AE', 'AEENDAT', 'present(AEENDAT) and days(AESTDAT, AEENDAT) < 0', 'The end date {AEENDAT} is before the start date {AESTDAT}. Please check.', [T('Fires', { AESTDAT: '2026-04-10', AEENDAT: '2026-04-08' }, true), T('Passes', { AESTDAT: '2026-04-10', AEENDAT: '2026-04-12' }, false)]),
  c('AE-59', 'AE starting before dose 1', 'date', 'AE', 'AESTDAT', 'present(rand()) and days(rand(), AESTDAT) < 0', 'The AE started on {AESTDAT}, before dose 1. A condition present before vaccination belongs in medical history. Please review.', [T('Fires', { AESTDAT: '2026-04-01' }, true, { rand: '2026-04-06' }), T('Passes', { AESTDAT: '2026-04-09' }, false, { rand: '2026-04-06' })]),
  c('AE-60', 'Serious AE with no seriousness criterion', 'cross-form', 'AE', 'AESER', `AESER = 'Y' and not ${SAE6}`, 'The AE is serious, but no seriousness criterion is ticked. Please tick every criterion that applies, or correct the seriousness.', [T('Fires', { AESER: 'Y', AESDTH: 'N', AESLIFE: 'N', AESHOSP: 'N', AESDISAB: 'N', AESCONG: 'N', AESMIE: 'N' }, true), T('Passes', { AESER: 'Y', ...noSae, AESHOSP: 'Y' }, false)]),
  c('AE-61', 'Diary reaction entered as an unsolicited AE', 'cross-form', 'AE', 'AETERM', "AEMAAE != 'Y' and (contains(AETERM, 'fever') or contains(AETERM, 'pyrexia') or contains(AETERM, 'injection site')) and ((present(visdat('D1')) and days(visdat('D1'), AESTDAT) >= 0 and days(visdat('D1'), AESTDAT) <= 6) or (present(visdat('D29')) and days(visdat('D29'), AESTDAT) >= 0 and days(visdat('D29'), AESTDAT) <= 6))", '"{AETERM}" started on {AESTDAT}, within a diary period. Solicited reactions are collected in the e-diary and are not entered again as unsolicited AEs. Please review.', [T('Fever day 2 fires', { AETERM: 'Fever', AESTDAT: '2026-04-07', AEMAAE: 'N' }, true, { 'visdat:D1': '2026-04-06' }), T('Fever day 20 passes', { AETERM: 'Fever', AESTDAT: '2026-04-26', AEMAAE: 'N' }, false, { 'visdat:D1': '2026-04-06' }), T('Medically attended passes', { AETERM: 'Injection site pain', AESTDAT: '2026-04-07', AEMAAE: 'Y' }, false, { 'visdat:D1': '2026-04-06' })]),
  c('AE-62', 'Grade 4 AE not medically attended', 'cross-form', 'AE', 'AEMAAE', "AESEV = 'POTENTIALLY LIFE THREATENING' and AEMAAE = 'N'", 'The AE is grade 4, which by definition needs an emergency room visit or hospitalisation, but it is not marked medically attended. Please review.', [T('Fires', { AESEV: 'POTENTIALLY LIFE THREATENING', AEMAAE: 'N' }, true), T('Passes', { AESEV: 'POTENTIALLY LIFE THREATENING', AEMAAE: 'Y' }, false)]),
  // CM
  miss('CM-51', 'CM', 'CMTRT'), miss('CM-52', 'CM', 'CMINDC'), miss('CM-53', 'CM', 'CMDOSU'), miss('CM-54', 'CM', 'CMSTDAT'),
  c('CM-55', 'Medication end date before start date', 'date', 'CM', 'CMENDAT', 'present(CMENDAT) and days(CMSTDAT, CMENDAT) < 0', 'The end date {CMENDAT} is before the start date {CMSTDAT}. Please check both dates.', [T('Fires', { CMSTDAT: '2026-04-10', CMENDAT: '2026-04-01' }, true), T('Passes', { CMSTDAT: '2026-04-10', CMENDAT: '2026-04-12' }, false)]),
  c('CM-56', 'Antipyretic taken to prevent reactions', 'protocol', 'CM', 'CMINDC', "contains(CMINDC, 'prevent') or contains(CMINDC, 'prophyla')", '{CMTRT} for "{CMINDC}": antipyretics taken to prevent reactions are not allowed on the day of vaccination. Please confirm the indication and timing.', [T('Fires', { CMTRT: 'Paracetamol', CMINDC: 'Prevention of fever' }, true), T('Passes', { CMTRT: 'Paracetamol', CMINDC: 'Fever after vaccination' }, false)]),
  // EOS
  miss('EOS-51', 'EOS', 'DSDECOD'), miss('EOS-52', 'EOS', 'EOSDAT'),
]

export const VAX_DEV_CHECKS: Record<string, string> = { 'SV-54': 'Visit window', 'VAX-07': 'Investigational product', 'VS-52': 'Investigational product', 'IE-52': 'Eligibility', 'IC-54': 'Informed consent', 'DM-53': 'Eligibility', 'CM-56': 'Prohibited medication' }
export const freshVaxChecks = (): Check[] => VAX_CHECKS.map((x) => ({ ...x, tests: x.tests.map((t) => ({ ...t })) }))
