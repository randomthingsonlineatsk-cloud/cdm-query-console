// Deterministic study data. For every subject the generator writes the TRUE values (what the
// source documents say) and the ENTERED values (what the site types into the eCRF). Where
// they differ, or where a value is true but unusual, the difference is a planted issue in the
// answer key, with the check or listing that should find it.

import { SITES, VISITS, STUDY, type Site } from './study'
import { rng, addDays, type Rng } from './util'

export interface Entry {
  subj: string; site: string; visit: string; form: string; inst: number
  visitDate: string; entryDate: string
  values: Record<string, string>   // as entered by the site
  truth: Record<string, string>    // as in the source document
}
export type IssueFinder = { check: string } | { listing: string }
export interface Issue {
  id: string; subj: string; site: string; visit: string; form: string; inst: number; field: string
  kind: 'error' | 'true-value'      // error: the site corrects it; true-value: the site confirms it
  find: IssueFinder; note: string
}
export interface SeedSubject { id: string; site: string; scr: string; d1?: string; fate: 'completed' | 'screen-fail' | 'early-ae' | 'early-withdrawal' | 'lost'; lastVisit: string; arm: 'VSC-9' | 'Placebo' }
export interface SeedStudy { subjects: SeedSubject[]; entries: Entry[]; issues: Issue[] }

const LAG: Record<Site['profile'], [number, number]> = { clean: [1, 3], slow: [2, 5], 'new-coordinator': [3, 7], 'under-reports': [2, 5], 'other-units': [2, 5], late: [10, 21] }
export const RESPONSE_DAYS: Record<Site['profile'], [number, number]> = { clean: [1, 4], slow: [14, 35], 'new-coordinator': [4, 9], 'under-reports': [3, 7], 'other-units': [3, 7], late: [7, 14] }
const SITE_START: Record<string, string> = { '101': '2026-03-02', '102': '2026-03-04', '103': '2026-03-09', '104': '2026-03-11', '105': '2026-03-16', '106': '2026-05-11' }

const SCREEN_FAIL: Record<string, string> = { '102-004': 'IN02', '103-006': 'EX03', '105-003': 'IN02', '104-008': 'EX02' }
const EARLY: Record<string, SeedSubject['fate']> = { '101-007': 'early-ae', '103-002': 'early-withdrawal', '105-009': 'lost' }
const EARLY_LAST: Record<string, string> = { '101-007': 'W8', '103-002': 'W4', '105-009': 'W2' }

const AE_TERMS = ['Headache', 'Dizziness', 'Nausea', 'Dry cough', 'Fatigue', 'Ankle swelling', 'Upper respiratory tract infection', 'Back pain', 'Diarrhoea', 'Insomnia', 'Muscle cramps', 'Rash on forearm']
const MH_TERMS = ['Type 2 diabetes mellitus', 'Hypercholesterolaemia', 'Osteoarthritis of the knee', 'Gastro-oesophageal reflux', 'Seasonal allergic rhinitis', 'Hypothyroidism', 'Appendicectomy']
const CMS: { trt: string; indc: string; dose: string; unit: string; route: string }[] = [
  { trt: 'Atorvastatin', indc: 'Hypercholesterolaemia', dose: '20', unit: 'mg', route: 'ORAL' },
  { trt: 'Metformin', indc: 'Type 2 diabetes mellitus', dose: '500', unit: 'mg', route: 'ORAL' },
  { trt: 'Omeprazole', indc: 'Gastro-oesophageal reflux', dose: '20', unit: 'mg', route: 'ORAL' },
  { trt: 'Levothyroxine', indc: 'Hypothyroidism', dose: '50', unit: 'ug', route: 'ORAL' },
  { trt: 'Cetirizine', indc: 'Seasonal allergic rhinitis', dose: '10', unit: 'mg', route: 'ORAL' },
  { trt: 'Paracetamol', indc: 'Osteoarthritis of the knee', dose: '1', unit: 'g', route: 'ORAL' },
]

function race(r: Rng, country: string) {
  if (country === 'India') return 'ASIAN'
  if (country === 'Germany') return r.chance(0.9) ? 'WHITE' : r.pick(['ASIAN', 'BLACK OR AFRICAN AMERICAN'])
  return r.pick(['WHITE', 'WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN', 'AMERICAN INDIAN OR ALASKA NATIVE', 'NOT REPORTED'])
}
const GENERIC: Record<string, { field: string; check: string; note: string; make: (v: string) => string }[]> = {
  VS: [
    { field: 'PULSE', check: 'VS-03', note: 'Pulse left blank.', make: () => '' },
    { field: 'WEIGHT', check: 'VS-11', note: 'Decimal point missed in weight.', make: (v) => v.replace('.', '') },
    { field: 'DIABP', check: 'VS-02', note: 'Diastolic BP left blank.', make: () => '' },
  ],
  LB: [
    { field: 'CREAT', check: 'LB-10', note: 'Extra digit typed in creatinine.', make: (v) => v + '0' },
    { field: 'ALT', check: 'LB-06', note: 'ALT left blank.', make: () => '' },
  ],
  EG: [{ field: 'QTCF', check: 'EG-04', note: 'Last digit of QTcF dropped.', make: (v) => v.slice(0, -1) }],
  CM: [{ field: 'CMDOSU', check: 'CM-04', note: 'Dose unit left blank.', make: () => '' }],
  AE: [{ field: 'AEREL', check: 'AE-06', note: 'Relationship to study drug left blank.', make: () => '' }],
}
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)
const f0 = (n: number) => String(Math.round(n))

export function generateStudy(seed = 204201): SeedStudy {
  const r = rng(seed)
  const subjects: SeedSubject[] = []
  const entries: Entry[] = []
  const issues: Issue[] = []
  let issueN = 0
  const dropped = new Set<Entry>()
  const r2 = rng(seed + 7)
  const plant = (e: Entry, field: string, entered: string, kind: Issue['kind'], find: IssueFinder, note: string) => {
    if (kind === 'error') e.values[field] = entered
    issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: e.subj, site: e.site, visit: e.visit, form: e.form, inst: e.inst, field, kind, find, note })
  }

  for (const site of SITES) {
    let date = SITE_START[site.id]
    for (let n = 1; n <= 10; n++) {
      const id = `${site.id}-${String(n).padStart(3, '0')}`
      const scr = date
      date = addDays(date, r.int(6, 12))
      const sf = SCREEN_FAIL[id]
      const fate: SeedSubject['fate'] = sf ? 'screen-fail' : EARLY[id] ?? 'completed'
      const lag = () => r.int(...LAG[site.profile])
      const subjEntries: Entry[] = []
      const add = (visit: string, form: string, inst: number, visitDate: string, truth: Record<string, string>, entryDate?: string) => {
        const e: Entry = { subj: id, site: site.id, visit, form, inst, visitDate, entryDate: entryDate ?? addDays(visitDate, lag()), truth, values: { ...truth } }
        subjEntries.push(e); return e
      }

      // Screening
      const consent = scr
      const birth = 2026 - r.int(32, 72)
      const sex = r.pick(['F', 'M'])
      const height = sex === 'M' ? r.normal(174, 7) : r.normal(161, 6)
      const weight0 = Math.max(48, Math.min(130, r.normal(sex === 'M' ? 84 : 71, 11)))
      const sbp0 = sf === 'IN02' ? r.int(128, 136) : r.int(146, 172)
      const dbp0 = r.int(88, 104)
      const kScr = sf === 'EX03' ? 5.8 : r.normal(4.3, 0.3)
      const ic = add('SCR', 'IC', 1, scr, { DSSTDAT: consent, ICVER: 'v2.0' })
      add('SCR', 'SV', 1, scr, { VISOCCUR: 'Y', VISDAT: scr }, ic.entryDate)
      const dm = add('SCR', 'DM', 1, scr, { BRTHYR: String(birth), SEX: sex, RACE: race(r, site.country) }, ic.entryDate)
      add('SCR', 'IE', 1, scr, sf ? { IEYN: 'N', IETESTCD: sf } : { IEYN: 'Y', IETESTCD: '' }, ic.entryDate)
      const mhList = ['Essential hypertension', ...MH_TERMS.filter(() => r.chance(0.22)).slice(0, 2)]
      mhList.forEach((t, i) => add('SCR', 'MH', i + 1, scr, { MHTERM: t, MHSTDAT: `${r.int(2008, 2024)}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`, MHONGO: t === 'Appendicectomy' ? 'N' : 'Y' }, ic.entryDate))
      const vsScr = add('SCR', 'VS', 1, scr, { VSDAT: scr, SYSBP: String(sbp0), DIABP: String(dbp0), PULSE: f0(r.normal(74, 8)), WEIGHT: f1(weight0), HEIGHT: f0(height), BMI: '' }, ic.entryDate)
      const mgdl = site.labUnit === 'mg/dL'
      const gl = r.normal(5.3, 0.5)
      const lbScr = add('SCR', 'LB', 1, scr, { LBDAT: scr, GLUC: mgdl ? f0(gl * 18) : f1(gl), GLUCU: site.labUnit, K: f1(kScr), CREAT: f0(r.normal(sf === 'EX02' ? 160 : 80, 12)), ALT: f0(r.normal(24, 7)) }, ic.entryDate)
      const egScr = add('SCR', 'EG', 1, scr, { EGDAT: scr, QTCF: f0(r.normal(410, 14)), EGINTP: 'NORMAL' }, ic.entryDate)

      const subj: SeedSubject = { id, site: site.id, scr, fate, lastVisit: 'SCR', arm: r.chance(0.5) ? 'VSC-9' : 'Placebo' }
      subjects.push(subj)

      if (sf) {
        add('SCR', 'EOS', 1, scr, { DSDECOD: 'SCREEN FAILURE', EOSDAT: addDays(scr, r.int(5, 9)) }, addDays(scr, r.int(8, 14)))
        entries.push(...subjEntries); plantSubject(); continue
      }

      // Treatment visits
      const d1 = addDays(scr, r.int(10, 16)); subj.d1 = d1
      const active = subj.arm === 'VSC-9'
      const last = EARLY_LAST[id]
      const visitDates: Record<string, string> = { SCR: scr, D1: d1 }
      let kit = 1000 + Number(site.id) * 10 + n * 7
      for (const v of VISITS.filter((x) => x.id !== 'SCR')) {
        if (last && VISITS.findIndex((x) => x.id === v.id) > VISITS.findIndex((x) => x.id === last)) break
        const vd = v.id === 'D1' ? d1 : addDays(d1, v.day - 1 + r.int(-2, 2))
        visitDates[v.id] = vd
        subj.lastVisit = v.id
        const sv = add(v.id, 'SV', 1, vd, { VISOCCUR: 'Y', VISDAT: vd })
        const drop = active ? Math.min(1, (v.day - 1) / 42) * r.normal(16, 4) : r.normal(4, 3)
        add(v.id, 'VS', 1, vd, { VSDAT: vd, SYSBP: f0(sbp0 - drop + r.normal(0, 3)), DIABP: f0(dbp0 - drop * 0.55 + r.normal(0, 2)), PULSE: f0(r.normal(74, 8)), WEIGHT: f1(weight0 + r.normal(0, 0.8)), HEIGHT: '', BMI: '' }, sv.entryDate)
        if (v.forms.includes('LB')) add(v.id, 'LB', 1, vd, { LBDAT: vd, GLUC: mgdl ? f0(r.normal(5.3, 0.5) * 18) : f1(r.normal(5.3, 0.5)), GLUCU: site.labUnit, K: f1(r.normal(active ? 4.6 : 4.3, 0.3)), CREAT: f0(r.normal(82, 12)), ALT: f0(r.normal(25, 7)) }, sv.entryDate)
        if (v.forms.includes('EG')) add(v.id, 'EG', 1, vd, { EGDAT: vd, QTCF: f0(r.normal(412, 14)), EGINTP: 'NORMAL' }, sv.entryDate)
        if (v.forms.includes('EX')) {
          const disp = v.id !== 'W12'
          add(v.id, 'EX', 1, vd, { EXDISP: disp ? 'Y' : 'N', EXKIT: disp ? `K${kit++}` : '', EXRET: v.id === 'D1' ? '' : String(r.int(0, 3)) }, sv.entryDate)
        }
        if (v.id === 'FU' || v.id === last) {
          const dec = fate === 'completed' ? 'COMPLETED' : fate === 'early-ae' ? 'ADVERSE EVENT' : fate === 'early-withdrawal' ? 'WITHDRAWAL BY SUBJECT' : 'LOST TO FOLLOW-UP'
          add(v.id, 'EOS', 1, vd, { DSDECOD: dec, EOSDAT: fate === 'lost' ? addDays(vd, 30) : vd }, addDays(sv.entryDate, fate === 'lost' ? 32 : 0))
        }
      }
      void vsScr; void lbScr; void egScr; void dm

      // Adverse events and concomitant medications (log forms), entered with the next visit
      const occurred = Object.entries(visitDates).sort((a, b) => a[1].localeCompare(b[1]))
      const endDate = occurred[occurred.length - 1][1]
      const nextVisit = (d: string) => occurred.find(([, vd]) => vd >= d) ?? occurred[occurred.length - 1]
      const NEEDS_AE = ['103-001', '104-002', '101-004', '102-001', '106-001', '101-002', '101-005']
      const nAe = Math.max(NEEDS_AE.includes(id) ? 1 : 0, site.profile === 'under-reports' ? (r.chance(0.3) ? 1 : 0) : r.int(0, 3))
      let aeInst = 0
      const addAe = (truth: Record<string, string>) => {
        const [vid, vd] = nextVisit(truth.AESTDAT)
        const e = add('LOG', 'AE', ++aeInst, vd, truth, addDays(vd, lag()))
        e.visit = 'LOG'; void vid; return e
      }
      const blankSae = { AESDTH: '', AESLIFE: '', AESHOSP: '', AESDISAB: '', AESCONG: '', AESMIE: '' }
      for (let a = 0; a < nAe; a++) {
        const st = addDays(d1, r.int(1, Math.max(2, Math.min(80, (Date.parse(endDate) - Date.parse(d1)) / 86400000 - 1))))
        const dur = a === 0 && NEEDS_AE.includes(id) ? 3 : r.int(2, 14)
        const ongoing = addDays(st, dur) > endDate
        addAe({ AETERM: r.pick(AE_TERMS), AESTDAT: st, AEONGO: ongoing ? 'Y' : 'N', AEENDAT: ongoing ? '' : addDays(st, dur), AESEV: r.pick(['MILD', 'MILD', 'MODERATE']), AESER: 'N', ...blankSae, AEREL: r.pick(['NOT RELATED', 'UNLIKELY RELATED', 'POSSIBLY RELATED']), AEACN: 'DOSE NOT CHANGED', AEOUT: ongoing ? 'NOT RECOVERED/NOT RESOLVED' : 'RECOVERED/RESOLVED', AECOM: '' })
      }
      if (fate === 'early-ae') {
        const st = addDays(visitDates.W8, -3)
        addAe({ AETERM: 'Severe dizziness with fall', AESTDAT: st, AEONGO: 'N', AEENDAT: addDays(st, 6), AESEV: 'SEVERE', AESER: 'N', ...blankSae, AEREL: 'POSSIBLY RELATED', AEACN: 'DRUG WITHDRAWN', AEOUT: 'RECOVERED/RESOLVED', AECOM: '' })
      }
      if (id === '102-002' || id === '105-005' || id === '106-003') {
        const st = addDays(d1, id === '106-003' ? 20 : 40)
        addAe({ AETERM: id === '102-002' ? 'Chest pain' : id === '105-005' ? 'Syncope' : 'Pneumonia', AESTDAT: st, AEONGO: 'N', AEENDAT: addDays(st, 9), AESEV: 'SEVERE', AESER: 'Y', ...blankSae, AESHOSP: 'Y', AESDTH: 'N', AESLIFE: 'N', AESDISAB: 'N', AESCONG: 'N', AESMIE: 'N', AEREL: id === '105-005' ? 'POSSIBLY RELATED' : 'NOT RELATED', AEACN: 'DRUG INTERRUPTED', AEOUT: 'RECOVERED/RESOLVED', AECOM: '' })
      }
      let cmInst = 0
      for (const mh of mhList) {
        const cm = CMS.find((c) => c.indc === mh)
        if (!cm) continue
        const e = add('LOG', 'CM', ++cmInst, scr, { CMTRT: cm.trt, CMINDC: cm.indc, CMDSTXT: cm.dose, CMDOSU: cm.unit, CMROUTE: cm.route, CMSTDAT: `${r.int(2015, 2025)}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`, CMONGO: 'Y', CMENDAT: '' }, ic.entryDate)
        e.visit = 'LOG'
      }
      entries.push(...subjEntries)
      plantSubject()

      function find(form: string, visit?: string, inst = 1) { return subjEntries.find((e) => e.form === form && (visit === undefined || e.visit === visit) && e.inst === inst) }
      function plantSubject() {
        const P = site.profile
        // Site-profile errors (transcription by a new coordinator, units at site 105).
        if (P === 'new-coordinator') {
          const w4 = find('VS', 'W4'); if (w4 && n !== 8) plant(w4, 'SYSBP', w4.truth.SYSBP + '0', 'error', { check: 'VS-07' }, 'Extra digit typed in systolic BP.')
          const w2 = find('VS', 'W2'); if (w2 && n % 2 === 1) plant(w2, 'DIABP', w2.truth.SYSBP, 'error', { check: 'VS-09' }, 'Systolic value typed into the diastolic field.')
          const lb = find('LB', 'SCR'); if (lb && n % 3 === 0) plant(lb, 'K', lb.truth.K.replace('.', ''), 'error', { check: 'LB-09' }, 'Decimal point missed in potassium.')
          const ex = find('EX', 'W2'); if (ex && n % 4 === 1) plant(ex, 'EXKIT', ex.truth.EXKIT.slice(1), 'error', { check: 'EX-07' }, 'Kit number typed without its K prefix.')
          const vs = find('VS', 'W8'); if (vs && n % 3 === 1) plant(vs, 'PULSE', '', 'error', { check: 'VS-03' }, 'Pulse left blank.')
          const sv = find('SV', 'W8'); const vsw8 = find('VS', 'W8'); if (sv && vsw8 && n === 4) plant(vsw8, 'VSDAT', addDays(sv.truth.VISDAT, 1), 'error', { check: 'VS-15' }, 'Vital-signs date one day after the visit date.')
          const wt = find('VS', 'W12'); if (wt && n === 5) plant(wt, 'WEIGHT', f1(Number(wt.truth.WEIGHT) * 2.2046), 'error', { check: 'VS-13' }, 'Weight entered in pounds.')
          const h = find('VS', 'SCR'); if (h && n === 7) plant(h, 'HEIGHT', String(Number(h.truth.HEIGHT) / 10), 'error', { check: 'VS-12' }, 'Height entered in decimetres.')
          if (n === 8) { const vss = ['D1', 'W2', 'W4', 'W8'].map((v) => find('VS', v)).filter(Boolean) as Entry[]; if (vss.length === 4) { vss.forEach((e) => { e.values.SYSBP = vss[0].truth.SYSBP; e.values.DIABP = vss[0].truth.DIABP }); issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'W2', form: 'VS', inst: 1, field: 'SYSBP', kind: 'error', find: { listing: 'vs-trend' }, note: 'Identical blood pressure copied across four visits: ask the site to check the source.' }); vss.slice(1).forEach((e) => { e.truth = { ...e.truth } }) } }
        }
        if (P === 'other-units' && n === 6) { const lb = find('LB', 'W4'); if (lb) { lb.values.GLUCU = 'mmol/L'; issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'W4', form: 'LB', inst: 1, field: 'GLUC', kind: 'error', find: { check: 'LB-07' }, note: 'A glucose value in mg/dL recorded with the unit mmol/L.' }) } }
        if (P === 'other-units' && n === 8) { const lb = find('LB', 'W12'); if (lb) plant(lb, 'GLUCU', '', 'error', { check: 'LB-03' }, 'Glucose unit left blank.') }
        if (P === 'slow' && n === 6) { const sv = find('SV', 'W8'); const ex = find('EX', 'W8'); const vs = find('VS', 'W8'); if (sv && ex) { sv.truth.VISOCCUR = 'N'; sv.truth.VISDAT = ''; sv.values.VISOCCUR = 'N'; sv.values.VISDAT = ''; plant(ex, 'EXDISP', 'Y', 'error', { check: 'EX-03' }, 'Study drug recorded as dispensed at a visit that did not occur.'); ex.truth.EXDISP = 'N'; ex.truth.EXKIT = ''; ex.truth.EXRET = ''; if (vs) dropped.add(vs) } }
        if (P === 'slow' && n === 3) { const sv = find('SV', 'W4'); if (sv) { const late = addDays(subj.d1!, 28 + 8); sv.truth.VISDAT = late; sv.values.VISDAT = late; subjEntries.filter((e) => e.visit === 'W4').forEach((e) => { e.visitDate = late; e.entryDate = addDays(late, 3); for (const k of ['VSDAT', 'LBDAT']) if (k in e.truth) { e.truth[k] = late; e.values[k] = late } }); issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'W4', form: 'SV', inst: 1, field: 'VISDAT', kind: 'true-value', find: { check: 'SV-04' }, note: 'A true out-of-window visit: the site confirms it and it becomes a protocol deviation.' }) } }
        if (P === 'late' && n === 2) { const vs = find('VS', 'W2'); if (vs) { vs.truth.WEIGHT = f1(Number(vs.truth.WEIGHT) * 0.86); vs.values.WEIGHT = vs.truth.WEIGHT; issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'W2', form: 'VS', inst: 1, field: 'WEIGHT', kind: 'true-value', find: { check: 'VS-13' }, note: 'A real weight loss after a gastroenteritis: the site confirms it.' }) } }
        // Handcrafted issues on specific subjects.
        if (id === '103-001') { const ae = find('AE', 'LOG', 1) ?? null; if (ae) plant(ae, 'AESTDAT', addDays(consent, -5), 'error', { check: 'AE-11' }, 'AE start date typed with the wrong month; the true date is after consent.') }
        if (id === '104-002') { const ae = subjEntries.find((e) => e.form === 'AE'); if (ae) { ae.values.AESER = 'Y'; issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'LOG', form: 'AE', inst: ae.inst, field: 'AESER', kind: 'error', find: { check: 'AE-13' }, note: 'AE ticked serious with no seriousness criterion; the event was not serious.' }) } }
        if (id === '105-005') { const ae = subjEntries.find((e) => e.form === 'AE' && e.truth.AESER === 'Y'); if (ae) plant(ae, 'AESHOSP', '', 'error', { check: 'AE-13' }, 'Serious AE with its hospitalisation criterion left blank.') }
        if (id === '101-004') { const ae = subjEntries.find((e) => e.form === 'AE' && e.truth.AEONGO === 'N'); if (ae) plant(ae, 'AEENDAT', '', 'error', { check: 'AE-09' }, 'AE marked not ongoing with no end date.') }
        if (id === '102-001') { const ae = subjEntries.find((e) => e.form === 'AE' && e.truth.AEONGO === 'N'); if (ae) plant(ae, 'AEENDAT', addDays(ae.truth.AESTDAT, -2), 'error', { check: 'AE-10' }, 'AE end date before its start date.') }
        if (id === '106-001') { const ae = subjEntries.find((e) => e.form === 'AE' && e.truth.AEONGO === 'N'); if (ae) plant(ae, 'AEOUT', 'NOT RECOVERED/NOT RESOLVED', 'error', { check: 'AE-18' }, 'AE has an end date but the outcome says not recovered.') }
        if (id === '101-003') { const e = find('IC', 'SCR'); if (e) plant(e, 'ICVER', 'v1.0', 'error', { check: 'IC-04' }, 'Superseded consent version recorded; the subject signed v2.0.') }
        if (id === '103-004') { const e = find('IC', 'SCR'); if (e) plant(e, 'ICVER', 'v1.0', 'true-value', { check: 'IC-04' }, 'The subject really signed the superseded v1.0 form: confirm, re-consent and record a protocol deviation.') ; if (e) e.values.ICVER = e.truth.ICVER = 'v1.0' }
        if (id === '104-005') { const e = find('EG', 'W12'); if (e) plant(e, 'QTCF', '512', 'error', { check: 'EG-05' }, 'QTcF of 512 ms with a normal interpretation; the source says 412 ms.') }
        if (id === '101-009') { const e = find('LB', 'W4'); if (e) plant(e, 'ALT', '', 'error', { check: 'LB-06' }, 'ALT left blank; the result is on the lab report.') }
        if (id === '102-007') { const e = find('DM', 'SCR'); if (e) plant(e, 'BRTHYR', String(Number(e.truth.BRTHYR) - 20), 'error', { check: 'DM-04' }, 'Year of birth typed 20 years early, which makes the subject ineligible on age.') }
        if (id === '106-004') { const e = find('EX', 'D1'); if (e) plant(e, 'EXRET', '2', 'error', { check: 'EX-06' }, 'Tablets returned recorded at Day 1, before any kit was dispensed.') }
        if (id === '105-002') { const e = find('EX', 'W12'); if (e) { plant(e, 'EXDISP', 'Y', 'error', { check: 'EX-08' }, 'A new kit recorded at the end-of-treatment visit.'); e.values.EXKIT = 'K9999' } }
        if (id === '103-003') { const e = find('VS', 'W12'); if (e) plant(e, 'HEIGHT', String(e.truth.HEIGHT || find('VS', 'SCR')!.truth.HEIGHT), 'error', { check: 'VS-16' }, 'Height recorded at a post-screening visit, against the CRF completion guidelines.') }
        if (id === '101-002') { const ae = subjEntries.find((e) => e.form === 'AE'); if (ae) { const dup: Entry = { ...ae, inst: 50, values: { ...ae.values }, truth: { ...ae.truth } }; subjEntries.push(dup); entries.push(dup); issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'LOG', form: 'AE', inst: 50, field: 'AETERM', kind: 'error', find: { listing: 'ae-dup' }, note: 'The same AE entered twice; the site deletes the duplicate.' }) } }
        if (id === '104-003') { const e = add('LOG', 'CM', 9, subj.d1 ?? scr, { CMTRT: 'Ibuprofen', CMINDC: 'Knee pain', CMDSTXT: '400', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: addDays(subj.d1 ?? scr, 30), CMONGO: 'N', CMENDAT: addDays(subj.d1 ?? scr, 37) }, addDays(subj.d1 ?? scr, 45)); e.visit = 'LOG'; entries.push(e); issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'LOG', form: 'CM', inst: 9, field: 'CMINDC', kind: 'true-value', find: { listing: 'cm-ae' }, note: 'A medication for knee pain started on treatment with no matching AE: ask whether an AE should be reported.' }) }
        if (id === '102-005') { const e = add('LOG', 'CM', 9, subj.d1 ?? scr, { CMTRT: 'Amlodipine', CMINDC: 'Hypertension', CMDSTXT: '5', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: addDays(subj.d1 ?? scr, 50), CMONGO: 'Y', CMENDAT: '' }, addDays(subj.d1 ?? scr, 60)); e.visit = 'LOG'; entries.push(e); issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'LOG', form: 'CM', inst: 9, field: 'CMTRT', kind: 'true-value', find: { check: 'CM-10' }, note: 'A prohibited antihypertensive started after randomisation: the site confirms; record a protocol deviation.' }) }
        if (id === '106-002') { const e = add('LOG', 'CM', 9, subj.d1 ?? scr, { CMTRT: 'Paracetamol', CMINDC: 'Pain', CMDSTXT: '500', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: addDays(subj.d1 ?? scr, 12), CMONGO: 'N', CMENDAT: addDays(subj.d1 ?? scr, 14) }, addDays(subj.d1 ?? scr, 30)); e.visit = 'LOG'; entries.push(e); e.truth.CMINDC = 'Headache'; issues.push({ id: `PI-${String(++issueN).padStart(3, '0')}`, subj: id, site: site.id, visit: 'LOG', form: 'CM', inst: 9, field: 'CMINDC', kind: 'error', find: { check: 'CM-14' }, note: 'A vague indication ("Pain"); the source says headache.' }) }
        // Background transcription errors, at a rate that depends on the site.
        const rate = { clean: 0.03, slow: 0.08, 'new-coordinator': 0.22, 'under-reports': 0.07, 'other-units': 0.08, late: 0.1 }[P]
        for (const e of [...subjEntries]) {
          if (dropped.has(e) || issues.some((i) => i.subj === e.subj && i.visit === e.visit && i.form === e.form && i.inst === e.inst) || !r2.chance(rate)) continue
          const opts = GENERIC[e.form]; if (!opts) continue
          const g = r2.pick(opts)
          if (!e.truth[g.field] && g.make(e.truth[g.field] ?? '') !== '') continue
          plant(e, g.field, g.make(e.truth[g.field] ?? ''), 'error', { check: g.check }, g.note)
        }
        if (id === '101-005') { const ae = subjEntries.find((e) => e.form === 'AE'); if (ae) plant(ae, 'AETERM', 'Headache and nausea', 'error', { check: 'AE-21' }, 'Two events in one verbatim term; the site splits them.') }
      }
    }
  }
  const kept = entries.filter((e) => !dropped.has(e))
  kept.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.subj.localeCompare(b.subj))
  return { subjects, entries: kept, issues }
}

let cache: SeedStudy | null = null
export const seedStudy = () => (cache ??= generateStudy())
export const STUDY_START = STUDY.start
