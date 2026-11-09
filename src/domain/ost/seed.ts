// Deterministic data for the Ostrevia trial HRP-301 (VERDANT-1). As in the other studies, every
// eCRF record has TRUE values (the source) and ENTERED values (what the site typed); planted
// differences are in the answer key with the check that should find them. Severity improves on
// lumiravostat more than on placebo (the label's week-16 IGA-CHE response is about 36% on 10 mg,
// 45% on 25 mg and 13% on placebo). Central laboratory results (ALT, AST, neutrophils,
// lymphocytes and, for anti-HBc positive participants, HBV DNA) come by transfer, not on the eCRF.

import { addDays, rng, type Rng } from '../util'
import { accession, type Entry, type Issue, type IssueFinder, type SeedStudy, type SeedSubject } from '../seed'
import { OST_SITES, OST_STUDY, OST_VISITS } from './study'

const LAG: Record<string, [number, number]> = { clean: [1, 3], slow: [2, 5], 'new-coordinator': [3, 7], late: [7, 14] }
const SITE_START: Record<string, string> = { '301': '2026-04-06', '302': '2026-04-08', '303': '2026-04-13', '304': '2026-05-04' }
export const OST_SCREEN_FAIL: Record<string, string> = { '301-005': 'IN03', '302-009': 'EX01', '303-003': 'EX03' }
const EARLY: Record<string, { fate: SeedSubject['fate']; last: string; why: string }> = {
  '303-008': { fate: 'early-ae', last: 'W8', why: 'ADVERSE EVENT' },
  '301-010': { fate: 'early-withdrawal', last: 'W4', why: 'WITHDRAWAL BY SUBJECT' },
  '304-006': { fate: 'lost', last: 'W12', why: 'LOST TO FOLLOW-UP' },
}
// Serious adverse events (study day of onset). The safety database copy of each is in safety.ts.
export const OST_SAES: { subj: string; day: number; term: string; crit: string[]; rel: string; acn: string; dur: number; sev: string }[] = [
  { subj: '302-002', day: 47, term: 'Herpes zoster', crit: ['AESHOSP'], rel: 'POSSIBLY RELATED', acn: 'DRUG INTERRUPTED', dur: 12, sev: 'SEVERE' },
  { subj: '301-007', day: 66, term: 'Pneumonia', crit: ['AESHOSP'], rel: 'UNLIKELY RELATED', acn: 'DRUG INTERRUPTED', dur: 9, sev: 'SEVERE' },
  { subj: '303-006', day: 38, term: 'Cellulitis of hand', crit: ['AESHOSP'], rel: 'NOT RELATED', acn: 'DOSE NOT CHANGED', dur: 7, sev: 'MODERATE' },
  { subj: '304-003', day: 30, term: 'Wrist fracture', crit: ['AESHOSP'], rel: 'NOT RELATED', acn: 'DOSE NOT CHANGED', dur: 35, sev: 'MODERATE' },
]
export const OST_SAE_SUBJECTS = OST_SAES.map((s) => s.subj)

const AE_TERMS: { term: string; variants: string[]; p: number }[] = [
  { term: 'Nasopharyngitis', variants: ['Common cold', 'URTI', 'Head cold'], p: 0.22 },
  { term: 'Headache', variants: ['Head ache', 'Headaches'], p: 0.14 },
  { term: 'Acne', variants: ['Acne on face', 'Spots on chin'], p: 0.08 },
  { term: 'Nausea', variants: ['Feeling sick', 'Nauseous'], p: 0.07 },
  { term: 'Folliculitis', variants: ['Folliculitis on legs'], p: 0.05 },
  { term: 'Cold sore', variants: ['Oral herpes', 'Cold sore on lip'], p: 0.05 },
  { term: 'Hand eczema flare', variants: ['Flare of hand eczema', 'Worsening hand eczema'], p: 0.06 },
  { term: 'Back pain', variants: ['Backache', 'Lower back pain'], p: 0.05 },
]
const MH_TERMS = ['Seasonal allergic rhinitis', 'Asthma', 'Atopic dermatitis in childhood', 'Hypothyroidism', 'Hypercholesterolaemia', 'Appendicectomy']
const CMS: { trt: string; indc: string; dose: string; unit: string; route: string }[] = [
  { trt: 'Cetirizine', indc: 'Seasonal allergic rhinitis', dose: '10', unit: 'mg', route: 'ORAL' },
  { trt: 'Levothyroxine', indc: 'Hypothyroidism', dose: '75', unit: 'ug', route: 'ORAL' },
  { trt: 'Atorvastatin', indc: 'Hypercholesterolaemia', dose: '20', unit: 'mg', route: 'ORAL' },
  { trt: 'Salbutamol', indc: 'Asthma', dose: '100', unit: 'ug', route: 'INHALATION' },
  { trt: 'Paracetamol', indc: 'Headache', dose: '1', unit: 'g', route: 'ORAL' },
]
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)
const f0 = (n: number) => String(Math.round(n))
const pad = (n: number, w: number) => String(n).padStart(w, '0')
const tm = (r: Rng, h0: number, h1: number) => `${pad(r.int(h0, h1), 2)}:${pad(r.int(0, 59), 2)}`
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
export type OstArm = 'HRP10' | 'HRP25' | 'Placebo'
export const OST_ARM_NAME: Record<OstArm, string> = { HRP10: 'Lumiravostat 10 mg', HRP25: 'Lumiravostat 25 mg', Placebo: 'Placebo' }
export const armOf = (subj: string): OstArm => (['HRP10', 'HRP25', 'Placebo'] as OstArm[])[(Number(subj.slice(4)) + Number(subj.slice(2, 3))) % 3]
const RESPONSE: Record<OstArm, number> = { HRP10: 0.4, HRP25: 0.5, Placebo: 0.14 }
// Participants whose rows the planted issues depend on are kept free of random extras.
export const OST_HBC_POSITIVE = ['301-003', '302-006', '303-010', '304-008']

export interface OstSeed extends SeedStudy { ost: { arms: Record<string, OstArm>; hbcPositive: string[]; altHigh: { subj: string; visit: string; alt: number }[] } }

export function generateOstStudy(seed = 3011): OstSeed {
  const r = rng(seed)
  const subjects: SeedSubject[] = []
  const entries: Entry[] = []
  const issues: Issue[] = []
  const arms: Record<string, OstArm> = {}
  const altHigh: OstSeed['ost']['altHigh'] = []
  let issueN = 0
  const plants: { subj: string; visit: string; form: string; inst?: number; field: string; entered: string; kind: Issue['kind']; find: IssueFinder; note: string }[] = [
    { subj: '301-002', visit: 'W8', form: 'HEA', field: 'HECSI', entered: '', kind: 'error', find: { check: 'HEA-76' }, note: 'HECSI typed with an extra digit (412 for 41).' },
    { subj: '302-003', visit: 'W8', form: 'HEA', field: 'IGACHE', entered: '0', kind: 'error', find: { check: 'HEA-78' }, note: 'IGA-CHE entered as 0 (clear); the score sheet says moderate or severe, which matches the HECSI.' },
    { subj: '303-004', visit: 'W4', form: 'HEA', field: 'ITCHNRS', entered: '15', kind: 'error', find: { check: 'HEA-77' }, note: 'Itch rating typed as 15; the participant rated 5.' },
    { subj: '304-002', visit: 'W12', form: 'HEA', field: 'ASSESSOR', entered: '', kind: 'true-value', find: { check: 'HEA-80' }, note: 'The usual assessor was on leave; a second trained assessor scored the visit. Confirmed, documented in the source.' },
    { subj: '303-005', visit: 'W4', form: 'HEA', field: 'HEADAT', entered: '', kind: 'error', find: { check: 'HEA-71' }, note: 'Assessment date left blank.' },
    { subj: '303-007', visit: 'W2', form: 'HEA', field: 'ASSESSOR', entered: 'RKN', kind: 'error', find: { check: 'HEA-83' }, note: 'The assessor’s initials were entered instead of the assessor ID.' },
    { subj: '302-007', visit: 'D1', form: 'HEA', field: 'IGACHE', entered: '', kind: 'true-value', find: { check: 'HEA-81' }, note: 'IGA-CHE at Day 1 was 2 (mild): the participant improved between screening and Day 1 but was randomised. Confirmed: an eligibility deviation (IN03).' },
    { subj: '301-004', visit: 'SCR', form: 'IC', field: 'DSSTDAT', entered: '', kind: 'error', find: { check: 'IC-73' }, note: 'Consent date typed a week late; the signed form is dated the screening day.' },
    { subj: '303-002', visit: 'SCR', form: 'DM', field: 'BRTHYR', entered: '', kind: 'error', find: { check: 'DM-74' }, note: 'Year of birth digits swapped (1949 for 1994).' },
    { subj: '301-003', visit: 'SCR', form: 'HBV', field: 'HBVDNA', entered: '', kind: 'error', find: { check: 'HBV-74' }, note: 'Anti-HBc positive, HBV DNA left blank; the report says UNDETECTABLE.' },
    { subj: '304-004', visit: 'W4', form: 'VS', field: 'WEIGHT', entered: '', kind: 'error', find: { check: 'VS-78' }, note: 'Decimal point missed in weight.' },
    { subj: '302-005', visit: 'W8', form: 'EX', field: 'EXRET', entered: '', kind: 'error', find: { check: 'EX-78' }, note: 'Tablets returned typed as 53 for 5.' },
    { subj: '303-009', visit: 'W12', form: 'EX', field: 'EXRET', entered: '', kind: 'true-value', find: { check: 'EX-77' }, note: 'The participant missed 13 doses while travelling. Confirmed: an investigational product deviation.' },
    { subj: '301-008', visit: 'W8', form: 'SV', field: 'VISDAT', entered: '', kind: 'true-value', find: { check: 'SV-74' }, note: 'The Week 8 visit was 6 days late (participant ill). Confirmed: a visit window deviation.' },
    { subj: '304-005', visit: 'W4', form: 'LBC', field: 'LBREFID', entered: '', kind: 'error', find: { check: 'LBC-74' }, note: 'Accession number missing a digit.' },
    { subj: '302-008', visit: 'W4', form: 'EX', field: 'EXKIT', entered: '', kind: 'error', find: { check: 'EX-75' }, note: 'Kit number missing a digit.' },
  ]
  const plant = (e: Entry, field: string, entered: string, kind: Issue['kind'], find: IssueFinder, note: string) => {
    if (kind === 'error') e.values[field] = entered
    issues.push({ id: `OI-${pad(++issueN, 3)}`, subj: e.subj, site: e.site, visit: e.visit, form: e.form, inst: e.inst, field, kind, find, note })
  }

  for (const site of OST_SITES) {
    let date = SITE_START[site.id]
    for (let n = 1; n <= 12; n++) {
      const id = `${site.id}-${pad(n, 3)}`
      const scr = date
      date = addDays(date, r.int(3, 6))
      const lag = () => r.int(...LAG[site.profile])
      const subjEntries: Entry[] = []
      const add = (visit: string, form: string, inst: number, visitDate: string, truth: Record<string, string>, entryDate?: string) => {
        const e: Entry = { subj: id, site: site.id, visit, form, inst, visitDate, entryDate: entryDate ?? addDays(visitDate, lag()), truth, values: { ...truth } }
        subjEntries.push(e); return e
      }
      const sf = OST_SCREEN_FAIL[id]
      const early = EARLY[id]
      const fate: SeedSubject['fate'] = sf ? 'screen-fail' : early?.fate ?? 'completed'
      const arm = armOf(id); arms[id] = arm
      const subj: SeedSubject = { id, site: site.id, scr, fate, lastVisit: 'SCR', arm }
      subjects.push(subj)

      // Screening
      const birth = 2026 - (id === '303-002' ? 32 : r.int(22, 70))
      const sex = r.pick(['F', 'M'])
      const weight0 = clamp(r.normal(sex === 'M' ? 82 : 68, 11), 45, 130)
      const ic = add('SCR', 'IC', 1, scr, { DSSTDAT: scr, ICVER: 'v2.0' })
      const sv0 = add('SCR', 'SV', 1, scr, { VISOCCUR: 'Y', VISDAT: scr, UNSREAS: '' }, ic.entryDate)
      add('SCR', 'DM', 1, scr, { BRTHYR: String(birth), SEX: sex, RACE: site.country === 'India' ? 'ASIAN' : site.country === 'Germany' ? (r.chance(0.9) ? 'WHITE' : 'ASIAN') : r.pick(['WHITE', 'WHITE', 'WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN', 'AMERICAN INDIAN OR ALASKA NATIVE', 'NOT REPORTED']) }, ic.entryDate)
      add('SCR', 'IE', 1, scr, sf ? { IEYN: 'N', IETESTCD: sf } : { IEYN: 'Y', IETESTCD: '' }, ic.entryDate)
      const mh = [{ t: 'Chronic hand eczema', start: `${r.int(2012, 2025) - (r.chance(0.5) ? 0 : 3)}-${pad(r.int(1, 12), 2)}-${pad(r.int(1, 28), 2)}`, ongo: 'Y' }]
      if (mh[0].start > addDays(scr, -200)) mh[0].start = addDays(scr, -r.int(250, 900))
      for (const t of MH_TERMS) if (r.chance(0.16) && mh.length < 3) mh.push({ t, start: `${r.int(1995, 2024)}-${pad(r.int(1, 12), 2)}-${pad(r.int(1, 28), 2)}`, ongo: t === 'Appendicectomy' || t.includes('childhood') ? 'N' : 'Y' })
      mh.forEach((m, i) => add('SCR', 'MH', i + 1, scr, { MHTERM: m.t, MHSTDAT: m.start, MHONGO: m.ongo }, ic.entryDate))
      add('SCR', 'VS', 1, scr, { VSDAT: scr, SYSBP: f0(r.normal(124, 12)), DIABP: f0(r.normal(78, 8)), PULSE: f0(r.normal(72, 8)), WEIGHT: f1(weight0) }, ic.entryDate)
      const hbc = OST_HBC_POSITIVE.includes(id)
      add('SCR', 'HBV', 1, scr, { HBVDAT: scr, HBSAG: sf === 'EX01' ? 'POSITIVE' : 'NEGATIVE', HBCAB: hbc || sf === 'EX01' ? 'POSITIVE' : 'NEGATIVE', HBVDNA: hbc ? 'UNDETECTABLE' : sf === 'EX01' ? '1850' : '' }, ic.entryDate)
      add('SCR', 'LBC', 1, scr, { LBPERF: 'Y', LBREFID: accession(id, 'SCR'), LBDAT: scr, LBTIM: tm(r, 8, 12) }, ic.entryDate)
      if (sf === 'EX03') altHigh.push({ subj: id, visit: 'SCR', alt: 104 })
      const iga0 = sf === 'IN03' ? 2 : id === '302-003' ? 4 : r.chance(0.68) ? 3 : 4
      const hecsi0 = iga0 === 4 ? r.int(95, 190) : iga0 === 3 ? r.int(42, 110) : r.int(14, 30)
      const itch0 = clamp(r.int(5, 9) + (iga0 === 4 ? 1 : 0), 0, 10)
      const assessor = `A${pad(Number(site.id.slice(2)) * 2 - (n % 2), 2)}`
      add('SCR', 'HEA', 1, scr, { HEADAT: scr, ASSESSOR: assessor, IGACHE: String(iga0), HECSI: String(hecsi0), ITCHNRS: String(itch0) }, ic.entryDate)
      void sv0

      if (sf) {
        add('SCR', 'EOS', 1, scr, { DSDECOD: 'SCREEN FAILURE', EOSDAT: addDays(scr, r.int(6, 10)) }, addDays(scr, r.int(9, 14)))
        entries.push(...subjEntries); continue
      }

      // Treatment
      const d1 = addDays(scr, r.int(12, 21)); subj.d1 = d1
      const responder = ['302-007', '302-003', '301-002'].includes(id) ? false : r.chance(RESPONSE[arm])
      const active = arm !== 'Placebo'
      // Fraction of the way to the week-16 level, by study day.
      const course = (day: number) => clamp(day / 70, 0, 1) ** 0.8
      const finalPct = responder ? r.normal(0.86, 0.06) : active ? r.normal(0.45, 0.15) : r.normal(0.25, 0.15)
      const visitDates: Record<string, string> = { SCR: scr, D1: d1 }
      let kit = 3000 + Number(site.id.slice(2)) * 100 + n * 4
      let lastDisp: { date: string } | null = null
      const lastVisit = early?.last
      for (const v of OST_VISITS.filter((x) => x.id !== 'SCR' && x.id !== 'UNS')) {
        if (lastVisit && OST_VISITS.findIndex((x) => x.id === v.id) > OST_VISITS.findIndex((x) => x.id === lastVisit)) break
        const jitter = r.int(-2, 2)
        const vd = v.id === 'D1' ? d1 : id === '301-008' && v.id === 'W8' ? addDays(d1, 63) : addDays(d1, v.day - 1 + jitter)
        visitDates[v.id] = vd
        subj.lastVisit = v.id
        const sv = add(v.id, 'SV', 1, vd, { VISOCCUR: 'Y', VISDAT: vd, UNSREAS: '' })
        if (v.forms.includes('VS')) add(v.id, 'VS', 1, vd, { VSDAT: vd, SYSBP: f0(r.normal(124, 11)), DIABP: f0(r.normal(78, 7)), PULSE: f0(r.normal(72, 8)), WEIGHT: f1(weight0 + r.normal(0, 0.9)) }, sv.entryDate)
        if (v.forms.includes('LBC')) add(v.id, 'LBC', 1, vd, { LBPERF: 'Y', LBREFID: accession(id, v.id), LBDAT: vd, LBTIM: tm(r, 8, 12) }, sv.entryDate)
        if (v.forms.includes('HEA')) {
          const k = v.id === 'D1' ? 0 : course(v.day) * finalPct
          let hecsi = Math.round(hecsi0 * (1 - k) + r.normal(0, 3))
          if (v.id === 'D1') hecsi = Math.round(hecsi0 + r.normal(0, 4))
          hecsi = clamp(hecsi, 0, 360)
          let iga = hecsi <= 6 ? 0 : hecsi <= 16 ? 1 : hecsi <= 35 ? 2 : hecsi <= 90 ? 3 : 4
          if (v.id === 'D1') iga = id === '302-007' ? 2 : iga0
          const itch = clamp(Math.round(itch0 * (1 - k * 0.9) + r.normal(0, 0.8)), 0, 10)
          const who = id === '304-002' && v.id === 'W12' ? 'A07' : assessor
          add(v.id, 'HEA', 1, vd, { HEADAT: vd, ASSESSOR: who, IGACHE: String(iga), HECSI: String(hecsi), ITCHNRS: String(itch) }, sv.entryDate)
        }
        if (v.forms.includes('EX')) {
          const disp = v.id !== 'W16'
          let ret = ''
          if (lastDisp) {
            const days = Math.round((Date.parse(vd) - Date.parse(lastDisp.date)) / 86400000)
            const missed = id === '303-009' && v.id === 'W12' ? 13 : r.chance(0.7) ? 0 : r.int(1, 3)
            ret = String(clamp(35 - (days - missed), 0, 35))
          }
          add(v.id, 'EX', 1, vd, { EXDISP: disp ? 'Y' : 'N', EXKIT: disp ? `K${kit++}` : '', EXDSPQ: disp ? '35' : '', EXRET: ret, EXCOMPL: '' }, sv.entryDate)
          lastDisp = disp ? { date: vd } : lastDisp
        }
        if (id === '303-008' && v.id === 'W8') altHigh.push({ subj: id, visit: 'W8', alt: 212 })
        if (v.id === 'FU' || v.id === lastVisit) {
          const dec = early?.why ?? 'COMPLETED'
          add(v.id, 'EOS', 1, vd, { DSDECOD: dec, EOSDAT: fate === 'lost' ? addDays(vd, 35) : vd }, addDays(sv.entryDate, fate === 'lost' ? 38 : 0))
        }
      }

      // Adverse events and medications (subject logs).
      let aeN = 0
      const endTx = visitDates.W16 ?? visitDates[lastVisit ?? 'W16'] ?? addDays(d1, 112)
      const addAe = (t: Record<string, string>, startDay: number) => {
        const st = addDays(d1, startDay)
        return add('LOG', 'AE', ++aeN, st, t, addDays(st, r.int(5, 20)))
      }
      const sae = OST_SAES.find((x) => x.subj === id)
      if (sae) {
        const st = addDays(d1, sae.day - 1)
        const t: Record<string, string> = { AETERM: sae.term, AESTDAT: st, AEONGO: 'N', AEENDAT: addDays(st, sae.dur), AESEV: sae.sev, AESER: 'Y', AESDTH: 'N', AESLIFE: 'N', AESHOSP: 'N', AESDISAB: 'N', AESCONG: 'N', AESMIE: 'N', AEREL: sae.rel, AEACN: sae.acn, AEOUT: 'RECOVERED/RESOLVED', AECOM: '' }
        for (const c of sae.crit) t[c] = 'Y'
        add('LOG', 'AE', ++aeN, st, t, addDays(st, r.int(2, 6)))
      }
      if (id === '303-008') addAe({ AETERM: 'ALT increased', AESTDAT: addDays(d1, 56), AEONGO: 'N', AEENDAT: addDays(d1, 84), AESEV: 'MODERATE', AESER: 'N', AESDTH: '', AESLIFE: '', AESHOSP: '', AESDISAB: '', AESCONG: '', AESMIE: '', AEREL: 'RELATED', AEACN: 'DRUG WITHDRAWN', AEOUT: 'RECOVERED/RESOLVED', AECOM: 'ALT 5 × ULN on the central laboratory report' }, 56)
      for (const a of AE_TERMS) {
        if (!r.chance(a.p * (active ? 1.15 : 0.9)) || aeN >= 4) continue
        const day = r.int(5, Math.max(10, Math.round((Date.parse(endTx) - Date.parse(d1)) / 86400000)))
        const dur = r.int(2, 14)
        const verb = r.chance(0.55) ? r.pick(a.variants) : a.term
        addAe({ AETERM: verb, AESTDAT: addDays(d1, day), AEONGO: 'N', AEENDAT: addDays(d1, day + dur), AESEV: r.chance(0.75) ? 'MILD' : 'MODERATE', AESER: 'N', AESDTH: '', AESLIFE: '', AESHOSP: '', AESDISAB: '', AESCONG: '', AESMIE: '', AEREL: a.term === 'Nasopharyngitis' || a.term === 'Back pain' ? 'NOT RELATED' : r.pick(['NOT RELATED', 'UNLIKELY RELATED', 'POSSIBLY RELATED']), AEACN: 'DOSE NOT CHANGED', AEOUT: 'RECOVERED/RESOLVED', AECOM: '' }, day)
      }
      let cmN = 0
      for (const m of mh.slice(1)) {
        const cm = CMS.find((x) => x.indc === m.t)
        if (cm && m.ongo === 'Y') add('LOG', 'CM', ++cmN, scr, { CMTRT: cm.trt, CMINDC: cm.indc, CMDSTXT: cm.dose, CMDOSU: cm.unit, CMROUTE: cm.route, CMSTDAT: m.start, CMONGO: 'Y', CMENDAT: '' }, addDays(scr, r.int(3, 9)))
      }
      if (r.chance(0.35)) { const st = addDays(scr, -r.int(30, 400)); add('LOG', 'CM', ++cmN, scr, { CMTRT: 'Hydrocortisone', CMINDC: 'Chronic hand eczema', CMDSTXT: '1', CMDOSU: 'APPLICATION', CMROUTE: 'TOPICAL', CMSTDAT: st, CMONGO: 'N', CMENDAT: addDays(scr, -r.int(14, 28)) }, addDays(scr, r.int(3, 9))) }
      if (id === '302-004') { const st = addDays(d1, 41); add('LOG', 'CM', ++cmN, st, { CMTRT: 'Clobetasol', CMINDC: 'Hand eczema flare', CMDSTXT: '1', CMDOSU: 'APPLICATION', CMROUTE: 'TOPICAL', CMSTDAT: st, CMONGO: 'N', CMENDAT: addDays(st, 6) }, addDays(st, 9)) }
      if (sae?.term === 'Pneumonia') { const st = addDays(d1, sae.day - 1); add('LOG', 'CM', ++cmN, st, { CMTRT: 'Amoxicillin + clavulanic acid', CMINDC: 'Pneumonia', CMDSTXT: '625', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: st, CMONGO: 'N', CMENDAT: addDays(st, 7) }, addDays(st, 8)) }
      if (sae?.term === 'Herpes zoster') { const st = addDays(d1, sae.day - 1); add('LOG', 'CM', ++cmN, st, { CMTRT: 'Valaciclovir', CMINDC: 'Herpes zoster', CMDSTXT: '1', CMDOSU: 'g', CMROUTE: 'ORAL', CMSTDAT: st, CMONGO: 'N', CMENDAT: addDays(st, 7) }, addDays(st, 8)) }
      entries.push(...subjEntries)
    }
  }

  // Planted entry errors and true-but-unusual values.
  const find = (p: (typeof plants)[number]) => entries.find((e) => e.subj === p.subj && e.visit === p.visit && e.form === p.form && e.inst === (p.inst ?? 1))
  for (const p of plants) {
    const e = find(p)
    if (!e) throw new Error(`Seed plant has no record: ${p.subj} ${p.visit} ${p.form}`)
    const t = e.truth[p.field]
    const entered = p.entered !== '' ? p.entered
      : p.field === 'HECSI' ? (Number(t + '2') > 360 ? t + '2' : `4${t.padStart(2, '0')}`)
      : p.field === 'DSSTDAT' ? addDays(t, 7)
      : p.field === 'BRTHYR' ? '1949'
      : p.field === 'HBVDNA' ? ''
      : p.field === 'WEIGHT' ? t.replace('.', '')
      : p.field === 'EXRET' && p.kind === 'error' ? String(Number(t) + 48)
      : p.field === 'LBREFID' ? t.slice(0, -1)
      : p.field === 'EXKIT' ? t.slice(0, -1)
      : p.field === 'HEADAT' ? '' : t
    if (p.subj === '303-002' && p.field === 'BRTHYR') e.truth.BRTHYR = '1994'
    if (p.subj === '303-002' && p.field === 'BRTHYR') e.values.BRTHYR = '1994'
    plant(e, p.field, entered, p.kind, p.find, p.note)
  }
  // The prohibited corticosteroid is a true value: a deviation.
  const clob = entries.find((e) => e.subj === '302-004' && e.form === 'CM' && e.truth.CMTRT === 'Clobetasol')!
  plant(clob, 'CMTRT', clob.truth.CMTRT, 'true-value', { check: 'CM-90' }, 'Clobetasol (very potent topical corticosteroid) used for a week for a flare: prohibited. Confirmed: a prohibited-medication deviation.')
  // A serious event with no criterion ticked (the hospitalisation box was missed).
  const sae = entries.find((e) => e.subj === '303-006' && e.form === 'AE' && e.truth.AESER === 'Y')!
  plant(sae, 'AESHOSP', 'N', 'error', { check: 'AE-83' }, 'Serious AE (cellulitis of the hand, hospitalised) entered with no seriousness criterion.')

  entries.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.subj.localeCompare(b.subj))
  return { subjects, entries, issues, hidden: [], ost: { arms, hbcPositive: OST_HBC_POSITIVE, altHigh } }
}

let cache: OstSeed | null = null
export const ostSeed = () => (cache ??= generateOstStudy())
export const OST_START = OST_STUDY.start
