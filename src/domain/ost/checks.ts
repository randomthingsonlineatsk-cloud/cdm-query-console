// Edit checks for the Ostrevia trial HRP-301 (VERDANT-1). Numbered from 71 so they never share
// an ID with the other studies' checks. The adverse event, medication and deviation checks are
// the hypertension study's validated set, renumbered (with its UAT programming error corrected);
// the rest are written for this protocol: hepatitis B screening, the hand eczema assessments
// (IGA-CHE, HECSI, itch), the central laboratory sample and drug accountability.

import type { Check, CheckAction, CheckCategory, CheckTest } from '../types'
import { SHIPPED_CHECKS, CHECK_BUGS } from '../checks'
import { OST_FORMS } from './study'

const T = (name: string, values: Record<string, string>, fire: boolean, ctx?: Record<string, string>): CheckTest => ({ name, values, fire, ctx })
function c(id: string, title: string, category: CheckCategory, form: string, field: string, expr: string, message: string, tests: CheckTest[], extra: Partial<Check> = {}): Check {
  return { id, title, category, action: 'query' as CheckAction, form, field, expr, message, tests, active: true, ...extra }
}
function miss(id: string, form: string, field: string, when?: string, whenVals: Record<string, string> = {}, visits?: string[]): Check {
  const f = OST_FORMS[form].fields.find((x) => x.id === field)!
  const expr = when ? `${when} and isblank(${field})` : `isblank(${field})`
  return c(id, `${f.label} is missing${when ? ' (conditional)' : ''}`, 'missing', form, field, expr,
    `${f.label} is blank. Please enter the value from the source document, or record why it is not available.`,
    [T('Blank fires', { ...whenVals, [field]: '' }, true), T('Entered value passes', { ...whenVals, [field]: f.type === 'date' ? '2026-05-01' : f.type === 'number' ? '1' : 'Y' }, false)], { visits })
}

const AFTER_D1 = ['W2', 'W4', 'W8', 'W12', 'W16', 'FU']
const RETURNS = ['W4', 'W8', 'W12', 'W16']
const HEA_VISITS = ['SCR', 'D1', 'W2', 'W4', 'W8', 'W12', 'W16']
const PROHIBITED = "(contains(CMTRT, 'clobetasol') or contains(CMTRT, 'Clobecort') or contains(CMTRT, 'prednisolone') or contains(CMTRT, 'Prednilon') or contains(CMTRT, 'methotrexate') or contains(CMTRT, 'ciclosporin'))"

// The hypertension study's AE, CM and DV checks, renumbered 01 → 71. CM-10 (prohibited
// antihypertensives) is that protocol's own rule and is left out.
const renum = (id: string) => id.replace(/-(\d\d)$/, (_, n) => `-${Number(n) + 70}`)
const shared: Check[] = SHIPPED_CHECKS.filter((x) => ['AE', 'CM', 'DV'].includes(x.form) && x.id !== 'CM-10').map((x) => ({
  ...x, id: renum(x.id), expr: CHECK_BUGS[x.id]?.correct ?? x.expr, tests: x.tests.map((t) => ({ ...t })),
}))

export const OST_CHECKS: Check[] = [
  // SV
  miss('SV-71', 'SV', 'VISOCCUR'),
  miss('SV-72', 'SV', 'VISDAT', "VISOCCUR = 'Y'", { VISOCCUR: 'Y' }),
  c('SV-73', 'Visit date is in the future', 'date', 'SV', 'VISDAT', 'VISDAT > today()', 'The date {VISDAT} is after today. Please check the date against the source.', [T('Future fires', { VISDAT: '2026-12-01' }, true, { today: '2026-06-01' }), T('Past passes', { VISDAT: '2026-05-01' }, false, { today: '2026-06-01' })]),
  c('SV-74', 'Visit outside the protocol window', 'protocol', 'SV', 'VISDAT', 'present(rand()) and (days(rand(), VISDAT) + 1 < winlo() or days(rand(), VISDAT) + 1 > winhi())', 'The visit on {VISDAT} is on study day {studyday}, outside the protocol window (days {winlo} to {winhi}). Please confirm the date; if it is correct, the deviation will be recorded.', [T('Day 64 at Week 8 fires', { VISDAT: '2026-06-08' }, true, { rand: '2026-04-06', winlo: '53', winhi: '61' }), T('Day 57 passes', { VISDAT: '2026-06-01' }, false, { rand: '2026-04-06', winlo: '53', winhi: '61' })], { visits: AFTER_D1 }),
  c('SV-75', 'Screening more than 28 days before randomisation', 'protocol', 'SV', 'VISDAT', "present(rand()) and days(VISDAT, rand()) > 28", 'Screening on {VISDAT} is more than 28 days before randomisation. Please confirm the dates; screening must be repeated after 28 days.', [T('35 days fires', { VISDAT: '2026-03-02' }, true, { rand: '2026-04-06' }), T('14 days passes', { VISDAT: '2026-03-23' }, false, { rand: '2026-04-06' })], { visits: ['SCR'] }),
  c('SV-76', 'Visit date not after the previous visit', 'date', 'SV', 'VISDAT', 'present(prevvisdat()) and days(prevvisdat(), VISDAT) <= 0', 'The date {VISDAT} is on or before the previous visit. Please check the dates.', [T('Same day fires', { VISDAT: '2026-04-20' }, true, { prevvisdat: '2026-04-20' }), T('Later passes', { VISDAT: '2026-05-04' }, false, { prevvisdat: '2026-04-20' })], { visits: ['D1', ...AFTER_D1] }),
  miss('SV-77', 'SV', 'UNSREAS', undefined, {}, ['UNS']),
  // IC, DM, IE, MH
  miss('IC-71', 'IC', 'DSSTDAT'), miss('IC-72', 'IC', 'ICVER'),
  c('IC-73', 'Consent signed after the screening visit', 'date', 'IC', 'DSSTDAT', "present(visdat('SCR')) and days(visdat('SCR'), DSSTDAT) > 0", 'Consent is dated {DSSTDAT}, after the screening visit. No study procedure may happen before consent. Please confirm the dates.', [T('After fires', { DSSTDAT: '2026-04-10' }, true, { 'visdat:SCR': '2026-04-06' }), T('Same day passes', { DSSTDAT: '2026-04-06' }, false, { 'visdat:SCR': '2026-04-06' })]),
  c('IC-74', 'Superseded consent version', 'protocol', 'IC', 'ICVER', "present(ICVER) and ICVER != 'v2.0'", 'The consent version is {ICVER}; the current approved version is v2.0. Please confirm the version signed.', [T('v1.0 fires', { ICVER: 'v1.0' }, true), T('v2.0 passes', { ICVER: 'v2.0' }, false)]),
  miss('DM-71', 'DM', 'BRTHYR'), miss('DM-72', 'DM', 'SEX'), miss('DM-73', 'DM', 'RACE'),
  c('DM-74', 'Age at consent outside 18 to 75 (inclusion IN01)', 'protocol', 'DM', 'BRTHYR', 'present(consent()) and (year(consent()) - BRTHYR < 18 or year(consent()) - BRTHYR > 75)', 'Year of birth {BRTHYR} gives an age outside 18 to 75 at consent. Please confirm the year of birth and eligibility.', [T('Age 77 fires', { BRTHYR: '1949' }, true, { consent: '2026-04-06' }), T('Age 32 passes', { BRTHYR: '1994' }, false, { consent: '2026-04-06' })]),
  miss('IE-71', 'IE', 'IEYN'),
  miss('IE-72', 'IE', 'IETESTCD', "IEYN = 'N'", { IEYN: 'N' }),
  c('IE-73', 'Ineligible participant randomised', 'protocol', 'IE', 'IEYN', "IEYN = 'N' and present(rand())", 'Eligibility is recorded as not met, but the participant was randomised. Please confirm eligibility.', [T('Fires', { IEYN: 'N' }, true, { rand: '2026-04-20' }), T('Passes', { IEYN: 'N' }, false, { rand: '' })]),
  miss('MH-71', 'MH', 'MHTERM'), miss('MH-72', 'MH', 'MHONGO'),
  // VS
  miss('VS-71', 'VS', 'VSDAT'), miss('VS-72', 'VS', 'SYSBP'), miss('VS-73', 'VS', 'DIABP'), miss('VS-74', 'VS', 'PULSE'), miss('VS-75', 'VS', 'WEIGHT'),
  c('VS-76', 'Systolic BP outside 70 to 220 mmHg', 'range', 'VS', 'SYSBP', 'SYSBP < 70 or SYSBP > 220', 'Systolic BP {SYSBP} mmHg is outside 70 to 220. Please verify.', [T('Fires', { SYSBP: '250' }, true), T('Passes', { SYSBP: '124' }, false)]),
  c('VS-77', 'Diastolic BP not lower than systolic', 'range', 'VS', 'DIABP', 'present(SYSBP) and present(DIABP) and DIABP >= SYSBP', 'Diastolic {DIABP} is not lower than systolic {SYSBP}. Please check whether the values were swapped.', [T('Fires', { SYSBP: '80', DIABP: '120' }, true), T('Passes', { SYSBP: '120', DIABP: '80' }, false)]),
  c('VS-78', 'Weight outside 35 to 200 kg', 'range', 'VS', 'WEIGHT', 'WEIGHT < 35 or WEIGHT > 200', 'Weight {WEIGHT} kg is outside 35 to 200. Please check the decimal point.', [T('724 fires', { WEIGHT: '724' }, true), T('72.4 passes', { WEIGHT: '72.4' }, false)]),
  c('VS-79', 'Weight changed by more than 10% since screening', 'range', 'VS', 'WEIGHT', "present(val('SCR', 'VS', 'WEIGHT')) and abs(WEIGHT - val('SCR', 'VS', 'WEIGHT')) > val('SCR', 'VS', 'WEIGHT') * 0.1", 'Weight {WEIGHT} kg differs by more than 10% from screening. Please confirm.', [T('Fires', { WEIGHT: '60' }, true, { 'val:SCR|VS|WEIGHT': '72' }), T('Passes', { WEIGHT: '71.5' }, false, { 'val:SCR|VS|WEIGHT': '72' })], { visits: AFTER_D1 }),
  // HBV — hepatitis B screening
  miss('HBV-71', 'HBV', 'HBVDAT'), miss('HBV-72', 'HBV', 'HBSAG'), miss('HBV-73', 'HBV', 'HBCAB'),
  miss('HBV-74', 'HBV', 'HBVDNA', "HBCAB = 'POSITIVE'", { HBCAB: 'POSITIVE' }),
  c('HBV-75', 'HBsAg positive but randomised (exclusion EX01)', 'protocol', 'HBV', 'HBSAG', "HBSAG = 'POSITIVE' and present(rand())", 'HBsAg is positive at screening, which excludes the participant (EX01), but a randomisation date is recorded. Please confirm.', [T('Fires', { HBSAG: 'POSITIVE' }, true, { rand: '2026-04-20' }), T('Passes', { HBSAG: 'NEGATIVE' }, false, { rand: '2026-04-20' })]),
  c('HBV-76', 'Anti-HBc positive with HBV DNA detectable but randomised (EX01)', 'protocol', 'HBV', 'HBVDNA', "HBCAB = 'POSITIVE' and present(HBVDNA) and upper(HBVDNA) != 'UNDETECTABLE' and present(rand())", 'Anti-HBc is positive and HBV DNA is {HBVDNA}. Only participants with HBV DNA undetectable may be randomised (EX01). Please confirm the result.', [T('Fires', { HBCAB: 'POSITIVE', HBVDNA: '35' }, true, { rand: '2026-04-20' }), T('Undetectable passes', { HBCAB: 'POSITIVE', HBVDNA: 'UNDETECTABLE' }, false, { rand: '2026-04-20' })]),
  c('HBV-77', 'HBV DNA entered for an anti-HBc negative participant', 'cross-form', 'HBV', 'HBVDNA', "HBCAB = 'NEGATIVE' and present(HBVDNA)", 'HBV DNA {HBVDNA} is entered, but anti-HBc is negative and the laboratory only tests HBV DNA when anti-HBc is positive. Please check the report.', [T('Fires', { HBCAB: 'NEGATIVE', HBVDNA: 'UNDETECTABLE' }, true), T('Passes', { HBCAB: 'NEGATIVE', HBVDNA: '' }, false)]),
  // LBC — central laboratory sample
  miss('LBC-71', 'LBC', 'LBPERF'),
  miss('LBC-72', 'LBC', 'LBREFID', "LBPERF = 'Y'", { LBPERF: 'Y' }),
  miss('LBC-73', 'LBC', 'LBDAT', "LBPERF = 'Y'", { LBPERF: 'Y' }),
  c('LBC-74', 'Accession number format', 'range', 'LBC', 'LBREFID', "not pattern(LBREFID, 'NG######')", 'The accession number "{LBREFID}" does not follow the format NG followed by six digits. Please copy it from the requisition label.', [T('Fires', { LBREFID: 'NG12345' }, true), T('Passes', { LBREFID: 'NG123456' }, false)]),
  c('LBC-75', 'Sample date differs from the visit date', 'date', 'LBC', 'LBDAT', "present(LBDAT) and present(visdat(vis())) and LBDAT != visdat(vis())", 'The sample was collected on {LBDAT}, not on the visit date. Please confirm the collection date.', [T('Fires', { LBDAT: '2026-05-05' }, true, { vis: 'W4', 'visdat:W4': '2026-05-04' }), T('Passes', { LBDAT: '2026-05-04' }, false, { vis: 'W4', 'visdat:W4': '2026-05-04' })]),
  // HEA — hand eczema assessments
  miss('HEA-71', 'HEA', 'HEADAT'), miss('HEA-72', 'HEA', 'ASSESSOR'), miss('HEA-73', 'HEA', 'IGACHE'), miss('HEA-74', 'HEA', 'HECSI'), miss('HEA-75', 'HEA', 'ITCHNRS'),
  c('HEA-76', 'HECSI outside 0 to 360', 'range', 'HEA', 'HECSI', 'HECSI < 0 or HECSI > 360', 'The HECSI total {HECSI} is outside 0 to 360. Please check the score sheet.', [T('412 fires', { HECSI: '412' }, true), T('41 passes', { HECSI: '41' }, false)]),
  c('HEA-77', 'Itch rating outside 0 to 10', 'range', 'HEA', 'ITCHNRS', 'ITCHNRS < 0 or ITCHNRS > 10 or round(ITCHNRS, 0) != ITCHNRS', 'The itch rating {ITCHNRS} is not a whole number from 0 to 10. Please check the participant’s rating.', [T('15 fires', { ITCHNRS: '15' }, true), T('7 passes', { ITCHNRS: '7' }, false)]),
  c('HEA-78', 'IGA-CHE clear or almost clear but HECSI high', 'cross-form', 'HEA', 'IGACHE', "IGACHE in ('0', '1') and HECSI > 40", 'IGA-CHE is {IGACHE} (clear or almost clear) but HECSI is {HECSI}. The two scores disagree: please check both against the score sheet.', [T('Fires', { IGACHE: '0', HECSI: '96' }, true), T('Passes', { IGACHE: '1', HECSI: '6' }, false)]),
  c('HEA-79', 'IGA-CHE severe but HECSI low', 'cross-form', 'HEA', 'HECSI', "IGACHE = '4' and present(HECSI) and HECSI < 20", 'IGA-CHE is 4 (severe) but HECSI is {HECSI}. Please check both against the score sheet.', [T('Fires', { IGACHE: '4', HECSI: '12' }, true), T('Passes', { IGACHE: '4', HECSI: '120' }, false)]),
  c('HEA-80', 'Assessor different from Day 1', 'protocol', 'HEA', 'ASSESSOR', "present(val('D1', 'HEA', 'ASSESSOR')) and present(ASSESSOR) and ASSESSOR != val('D1', 'HEA', 'ASSESSOR')", 'The assessor is {ASSESSOR}; at Day 1 it was another assessor. The protocol asks for the same trained assessor at every visit where possible. Please confirm, and give the reason in the source.', [T('Fires', { ASSESSOR: 'A07' }, true, { 'val:D1|HEA|ASSESSOR': 'A02' }), T('Same passes', { ASSESSOR: 'A02' }, false, { 'val:D1|HEA|ASSESSOR': 'A02' })], { visits: ['W2', 'W4', 'W8', 'W12', 'W16'] }),
  c('HEA-81', 'IGA-CHE below 3 at Day 1 but randomised (inclusion IN03)', 'protocol', 'HEA', 'IGACHE', "present(IGACHE) and IGACHE < 3", 'IGA-CHE at Day 1 is {IGACHE}. Inclusion IN03 needs moderate (3) or severe (4) at screening and Day 1. Please confirm the score and eligibility.', [T('2 fires', { IGACHE: '2' }, true), T('3 passes', { IGACHE: '3' }, false)], { visits: ['D1'] }),
  c('HEA-82', 'Assessment date differs from the visit date', 'date', 'HEA', 'HEADAT', "present(HEADAT) and present(visdat(vis())) and HEADAT != visdat(vis())", 'The assessment is dated {HEADAT}, not the visit date. Assessments are done at the visit: please check the date.', [T('Fires', { HEADAT: '2026-05-06' }, true, { vis: 'W4', 'visdat:W4': '2026-05-04' }), T('Passes', { HEADAT: '2026-05-04' }, false, { vis: 'W4', 'visdat:W4': '2026-05-04' })]),
  c('HEA-83', 'Assessor ID format', 'range', 'HEA', 'ASSESSOR', "not pattern(ASSESSOR, 'A##')", 'The assessor ID "{ASSESSOR}" does not follow the format A followed by two digits (from the assessor training log). Please record the ID, not the name or initials.', [T('Initials fire', { ASSESSOR: 'JKM' }, true), T('A02 passes', { ASSESSOR: 'A02' }, false)]),
  // EX — study drug
  miss('EX-71', 'EX', 'EXDISP'),
  miss('EX-72', 'EX', 'EXKIT', "EXDISP = 'Y'", { EXDISP: 'Y' }),
  miss('EX-73', 'EX', 'EXDSPQ', "EXDISP = 'Y'", { EXDISP: 'Y' }),
  miss('EX-74', 'EX', 'EXRET', undefined, {}, RETURNS),
  c('EX-75', 'Kit number format', 'range', 'EX', 'EXKIT', "not pattern(EXKIT, 'K####')", 'The kit number "{EXKIT}" does not follow the format K followed by four digits. Please check the kit label.', [T('Fires', { EXKIT: 'K123' }, true), T('Passes', { EXKIT: 'K3012' }, false)]),
  c('EX-76', 'Derive compliance from drug accountability', 'derived', 'EX', 'EXCOMPL', "present(EXRET) and present(prevdisp('EXDSPQ')) and days(prevdispdat(), visdat(vis())) > 0 and EXCOMPL != round((prevdisp('EXDSPQ') - EXRET) / days(prevdispdat(), visdat(vis())) * 100, 0)", 'Compliance derived by the system: tablets dispensed from the previous bottle, less tablets returned, against days since that bottle.', [T('Blank fires', { EXRET: '7', EXCOMPL: '' }, true, { 'prevdisp:EXDSPQ': '35', prevdispdat: '2026-04-06', vis: 'W4', 'visdat:W4': '2026-05-04' }), T('Correct passes', { EXRET: '7', EXCOMPL: '100' }, false, { 'prevdisp:EXDSPQ': '35', prevdispdat: '2026-04-06', vis: 'W4', 'visdat:W4': '2026-05-04' })], { action: 'autofix', fix: "round((prevdisp('EXDSPQ') - EXRET) / days(prevdispdat(), visdat(vis())) * 100, 0)", visits: RETURNS }),
  c('EX-77', 'Compliance outside 80% to 120%', 'protocol', 'EX', 'EXRET', 'present(EXCOMPL) and (EXCOMPL < 80 or EXCOMPL > 120)', 'Compliance since the previous bottle is {EXCOMPL}% from {EXRET} tablets returned. Please check the tablet count against the accountability log and confirm.', [T('61% fires', { EXRET: '18', EXCOMPL: '61' }, true), T('100% passes', { EXRET: '7', EXCOMPL: '100' }, false)], { visits: RETURNS }),
  c('EX-78', 'More tablets returned than dispensed', 'range', 'EX', 'EXRET', "present(EXRET) and present(prevdisp('EXDSPQ')) and EXRET > prevdisp('EXDSPQ')", '{EXRET} tablets are recorded as returned, more than were dispensed in the previous bottle (35). Please check the count.', [T('Fires', { EXRET: '53' }, true, { 'prevdisp:EXDSPQ': '35' }), T('Passes', { EXRET: '5' }, false, { 'prevdisp:EXDSPQ': '35' })], { visits: RETURNS }),
  c('EX-79', 'Bottle dispensed at the end of treatment', 'protocol', 'EX', 'EXDISP', "EXDISP = 'Y'", 'A bottle is recorded as dispensed at Week 16, the end of treatment, where none is due. Please check.', [T('Y fires', { EXDISP: 'Y' }, true), T('N passes', { EXDISP: 'N' }, false)], { visits: ['W16'] }),
  c('EX-80', 'Tablets dispensed is not one bottle (35)', 'protocol', 'EX', 'EXDSPQ', "present(EXDSPQ) and EXDSPQ != 35", '{EXDSPQ} tablets are recorded as dispensed. Each bottle holds 35. Please check the accountability log.', [T('Fires', { EXDSPQ: '28' }, true), T('Passes', { EXDSPQ: '35' }, false)]),
  // EOS
  miss('EOS-71', 'EOS', 'DSDECOD'), miss('EOS-72', 'EOS', 'EOSDAT'),
  c('EOS-73', 'End-of-study date before the last visit', 'date', 'EOS', 'EOSDAT', 'present(lastvisdat()) and days(lastvisdat(), EOSDAT) < 0', 'The end-of-study date {EOSDAT} is before the last visit date. Please check.', [T('Before fires', { EOSDAT: '2026-05-01' }, true, { lastvisdat: '2026-05-10' }), T('Same passes', { EOSDAT: '2026-05-10' }, false, { lastvisdat: '2026-05-10' })]),
  c('EOS-74', 'Completed without a Week 16 visit', 'protocol', 'EOS', 'DSDECOD', "DSDECOD = 'COMPLETED' and isblank(visdat('W16'))", 'The participant is recorded as completed but has no Week 16 visit. Please confirm the status.', [T('No W16 fires', { DSDECOD: 'COMPLETED' }, true, { 'visdat:W16': '' }), T('W16 present passes', { DSDECOD: 'COMPLETED' }, false, { 'visdat:W16': '2026-08-01' })]),
  c('EOS-75', 'Discontinued for an AE with no AE leading to withdrawal', 'cross-form', 'EOS', 'DSDECOD', "DSDECOD = 'ADVERSE EVENT' and aecount('AEACN', 'DRUG WITHDRAWN') = 0", 'The reason for discontinuation is an adverse event, but no AE has action "Drug withdrawn". Please review.', [T('No AE fires', { DSDECOD: 'ADVERSE EVENT' }, true, { 'aecount:AEACN|DRUG WITHDRAWN': '0' }), T('AE present passes', { DSDECOD: 'ADVERSE EVENT' }, false, { 'aecount:AEACN|DRUG WITHDRAWN': '1' })]),
  // AE, CM, DV: the validated shared set, then this protocol's prohibited medicines.
  ...shared,
  c('CM-90', 'Prohibited medicine during treatment', 'protocol', 'CM', 'CMTRT', `${PROHIBITED} and present(rand()) and days(rand(), CMSTDAT) >= 0 and (isblank(visdat('W16')) or days(CMSTDAT, visdat('W16')) >= 0)`, '{CMTRT} for {CMINDC} started on {CMSTDAT}, during treatment. Potent topical corticosteroids on the hands, systemic corticosteroids and systemic immunosuppressants are prohibited until Week 16. Please confirm; if correct, the deviation will be recorded.', [T('Clobetasol fires', { CMTRT: 'Clobetasol', CMSTDAT: '2026-05-10' }, true, { rand: '2026-04-20', 'visdat:W16': '' }), T('Before randomisation passes', { CMTRT: 'Clobetasol', CMSTDAT: '2026-03-01' }, false, { rand: '2026-04-20', 'visdat:W16': '' })]),
]

export const OST_DEV_CHECKS: Record<string, string> = { 'SV-74': 'Visit window', 'SV-75': 'Visit window', 'IC-73': 'Informed consent', 'IC-74': 'Informed consent', 'DM-74': 'Eligibility', 'IE-73': 'Eligibility', 'HBV-75': 'Eligibility', 'HBV-76': 'Eligibility', 'HEA-81': 'Eligibility', 'EX-77': 'Investigational product', 'EX-79': 'Investigational product', 'CM-90': 'Prohibited medication' }
export const freshOstChecks = (): Check[] => OST_CHECKS.map((x) => ({ ...x, tests: x.tests.map((t) => ({ ...t })) }))
