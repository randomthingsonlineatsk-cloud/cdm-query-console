// Deterministic data for the vaccine study ALV-3-301. Like the hypertension seed, every eCRF
// record has TRUE values (the source) and ENTERED values (what the site typed); planted
// differences are in the answer key. On top of that, each vaccinated participant has a 7-day
// e-diary after each dose: what really happened (truth), what the participant entered, and how
// reliably they fill it in. Diary plants feed the corrections mission (M15) and the
// reconciliation mission (M16).

import { addDays, hash, rng, type Rng } from '../util'
import type { Entry, Issue, IssueFinder, SeedStudy, SeedSubject } from '../seed'
import { VAX_SITES, VAX_STUDY, DIARY_DAYS, gradeOf } from './study'

export type Behaviour = 'diligent' | 'forgetful' | 'device'
export interface DiaryTruth { subj: string; dose: 1 | 2; day: number; date: string; truth: Record<string, string>; entered: Record<string, string> }
export interface ImmResult { subj: string; visit: string; tube: string; collected: string; reported: string; titre: string; comment: string }
export interface CorrectionRequest {
  id: string; subj: string; dose: 1 | 2; day: number; field: string; date: string
  from: string; to: string; requester: string; source: string; story: string
  expected: 'send' | 'return'; why: string
}
export interface VaxSeed extends SeedStudy {
  vax: {
    doses: Record<string, { 1?: string; 2?: string }>
    devices: Record<string, string>            // participant -> device the vendor has linked
    ecrfDevices: Record<string, string>        // participant -> device recorded on the eCRF
    behaviour: Record<string, Behaviour>
    diary: DiaryTruth[]
    forced: Record<string, 'entered' | 'missed'>
    imm: ImmResult[]
    requests: CorrectionRequest[]
  }
}

const LAG: Record<string, [number, number]> = { clean: [1, 3], slow: [2, 5], 'new-coordinator': [3, 7], late: [6, 12] }
const SITE_START: Record<string, string> = { '201': '2026-04-06', '202': '2026-04-08', '203': '2026-04-13', '204': '2026-04-27' }
const SCREEN_FAIL: Record<string, string> = { '201-011': 'EX02', '202-010': 'EX01', '203-007': 'IN01' }
const WITHDREW_AFTER_DOSE1 = '203-005'
const LOST_AFTER_D57 = '202-012'
// Participants the scenarios depend on: their diaries never have device problems.
const SCENARIO = ['201-001', '201-002', '201-003', '201-004', '201-005', '201-006', '201-007', '201-008', '201-009', '202-001', '202-002', '202-003', '202-005']

const MH_TERMS = ['Seasonal allergic rhinitis', 'Asthma, well controlled', 'Migraine', 'Hypothyroidism', 'Appendicectomy', 'Lower back pain']
const AE_TERMS: { term: string; ma: number }[] = [
  { term: 'Common cold', ma: 0.1 }, { term: 'Upper respiratory tract infection', ma: 0.4 }, { term: 'Gastroenteritis', ma: 0.3 }, { term: 'Toothache', ma: 0.6 },
  { term: 'Back pain', ma: 0.2 }, { term: 'Insomnia', ma: 0 }, { term: 'Sprained ankle', ma: 0.7 }, { term: 'Urinary tract infection', ma: 0.9 },
]
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)
const f0 = (n: number) => String(Math.round(n))
const pad = (n: number, w: number) => String(n).padStart(w, '0')
const tm = (r: Rng, h0: number, h1: number) => `${pad(r.int(h0, h1), 2)}:${pad(r.int(0, 59), 2)}`
export const placebo = (subj: string) => Number(subj.slice(4)) % 3 === 1
export const behaviourOf = (subj: string): Behaviour => {
  const u = parseInt(hash('diary' + subj).slice(-6), 16) / 0xffffff
  return u < 0.3 ? 'forgetful' : u < 0.36 && !SCENARIO.includes(subj) ? 'device' : 'diligent'
}

// Reactions after one dose: what really happened on each of the 7 days.
function reactions(r: Rng, active: boolean, dose: 1 | 2): Record<string, string>[] {
  const days: Record<string, string>[] = Array.from({ length: DIARY_DAYS }, () => ({ PAIN: '0', REDNESS: '0', SWELLING: '0', TEMP: '', HEADACHE: '0', FATIGUE: '0', MYALGIA: '0', ARTHRALGIA: '0', CHILLS: '0', NAUSEA: '0', DIARRHOEA: '0', MEDS: 'N', MEDVISIT: 'N' }))
  const k = dose === 2 ? 1.3 : 1
  const episode = (item: string, p: number, start: [number, number], len: [number, number], level: (r: Rng) => number) => {
    if (!r.chance(p)) return
    const s = r.int(...start), n = r.int(...len)
    const peak = level(r)
    for (let d = s; d < Math.min(DIARY_DAYS, s + n); d++) { const fade = d === s ? 1 : Math.max(0.3, 1 - 0.3 * (d - s)); days[d][item] = String(item === 'REDNESS' || item === 'SWELLING' ? Math.round(peak * fade) : Math.max(1, Math.round(peak * fade))) }
  }
  const sev = (w: [number, number, number]) => (rr: Rng) => { const u = rr.next(); return u < w[0] ? 1 : u < w[0] + w[1] ? 2 : 3 }
  if (active) {
    episode('PAIN', 0.78, [0, 0], [1, 4], sev([0.6, 0.33, 0.07]))
    episode('REDNESS', 0.18 * k, [0, 1], [1, 4], (rr) => rr.int(10, 85))
    episode('SWELLING', 0.15 * k, [0, 1], [1, 3], (rr) => rr.int(8, 70))
    episode('HEADACHE', 0.38 * k, [0, 2], [1, 2], sev([0.65, 0.3, 0.05]))
    episode('FATIGUE', 0.42 * k, [0, 2], [1, 3], sev([0.6, 0.33, 0.07]))
    episode('MYALGIA', 0.32 * k, [0, 2], [1, 2], sev([0.65, 0.3, 0.05]))
    episode('ARTHRALGIA', 0.14 * k, [1, 2], [1, 2], sev([0.7, 0.28, 0.02]))
    episode('CHILLS', 0.14 * k, [0, 1], [1, 1], sev([0.6, 0.35, 0.05]))
    episode('NAUSEA', 0.07, [0, 2], [1, 1], sev([0.8, 0.2, 0]))
    episode('DIARRHOEA', 0.05, [1, 3], [1, 2], sev([0.85, 0.15, 0]))
  } else {
    episode('PAIN', 0.16, [0, 0], [1, 2], sev([0.9, 0.1, 0]))
    episode('REDNESS', 0.03, [0, 1], [1, 2], (rr) => rr.int(5, 30))
    episode('HEADACHE', 0.22, [0, 4], [1, 2], sev([0.8, 0.2, 0]))
    episode('FATIGUE', 0.24, [0, 4], [1, 2], sev([0.8, 0.2, 0]))
    episode('MYALGIA', 0.1, [0, 3], [1, 1], sev([0.9, 0.1, 0]))
    episode('NAUSEA', 0.04, [0, 4], [1, 1], sev([1, 0, 0]))
  }
  const fever = active && r.chance(0.1 * k * (dose === 2 ? 1.4 : 1))
  const feverDay = r.int(0, 1)
  for (let d = 0; d < DIARY_DAYS; d++) {
    days[d].TEMP = fever && d === feverDay ? f1(r.normal(38.5, 0.35)) : f1(Math.min(37.5, r.normal(36.7, 0.25)))
    const bad = Number(days[d].TEMP) >= 38 || Number(days[d].PAIN) >= 2 || Number(days[d].HEADACHE) >= 2
    if (bad && r.chance(0.55)) days[d].MEDS = 'Y'
  }
  return days
}

export function generateVaxStudy(seed = 3301): VaxSeed {
  const r = rng(seed)
  const subjects: SeedSubject[] = []
  const entries: Entry[] = []
  const issues: Issue[] = []
  const hidden: Entry[] = []
  const diary: DiaryTruth[] = []
  const imm: ImmResult[] = []
  const doses: VaxSeed['vax']['doses'] = {}
  const devices: Record<string, string> = {}
  const ecrfDevices: Record<string, string> = {}
  const behaviour: Record<string, Behaviour> = {}
  const forced: Record<string, 'entered' | 'missed'> = {}
  let issueN = 0
  const plant = (e: Entry, field: string, entered: string, kind: Issue['kind'], find: IssueFinder, note: string) => {
    if (kind === 'error') e.values[field] = entered
    issues.push({ id: `VI-${pad(++issueN, 3)}`, subj: e.subj, site: e.site, visit: e.visit, form: e.form, inst: e.inst, field, kind, find, note })
  }

  for (const site of VAX_SITES) {
    let date = SITE_START[site.id]
    for (let n = 1; n <= 15; n++) {
      const id = `${site.id}-${pad(n, 3)}`
      const d1 = date
      date = addDays(date, r.int(2, 4))
      const lag = () => r.int(...LAG[site.profile])
      const subjEntries: Entry[] = []
      const add = (visit: string, form: string, inst: number, visitDate: string, truth: Record<string, string>, entryDate?: string) => {
        const e: Entry = { subj: id, site: site.id, visit, form, inst, visitDate, entryDate: entryDate ?? addDays(visitDate, lag()), truth, values: { ...truth } }
        subjEntries.push(e); return e
      }
      const sf = SCREEN_FAIL[id]
      const active = !placebo(id)
      const fate: SeedSubject['fate'] = sf ? 'screen-fail' : id === WITHDREW_AFTER_DOSE1 ? 'early-withdrawal' : id === LOST_AFTER_D57 ? 'lost' : 'completed'
      const subj: SeedSubject = { id, site: site.id, scr: d1, d1: sf ? undefined : d1, fate, lastVisit: 'D1', arm: active ? 'ALV-3' : 'Placebo' }
      subjects.push(subj)
      behaviour[id] = behaviourOf(id)

      // Day 1: consent, eligibility and dose 1 on the same day.
      const birth = 2026 - (id === '203-007' ? 67 : r.int(19, 63))
      const sv = add('D1', 'SV', 1, d1, { VISOCCUR: 'Y', VISDAT: d1, UNSREAS: '' })
      add('D1', 'IC', 1, d1, { DSSTDAT: d1, ICVER: 'v1.1' }, sv.entryDate)
      add('D1', 'DM', 1, d1, { BRTHYR: String(birth), SEX: r.pick(['F', 'M']), RACE: site.country === 'India' ? 'ASIAN' : r.pick(['WHITE', 'WHITE', 'WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN', 'NOT REPORTED']) }, sv.entryDate)
      add('D1', 'IE', 1, d1, sf ? { IEYN: 'N', IETESTCD: sf } : { IEYN: 'Y', IETESTCD: '' }, sv.entryDate)
      MH_TERMS.filter(() => r.chance(0.18)).slice(0, 2).forEach((t, i) => add('D1', 'MH', i + 1, d1, { MHTERM: t, MHSTDAT: `${r.int(2005, 2025)}-${pad(r.int(1, 12), 2)}-${pad(r.int(1, 28), 2)}`, MHONGO: t === 'Appendicectomy' ? 'N' : 'Y' }, sv.entryDate))
      const temp0 = sf === 'EX01' ? '38.3' : f1(Math.min(37.4, r.normal(36.6, 0.25)))
      add('D1', 'VS', 1, d1, { VSDAT: d1, TEMP: temp0, SYSBP: f0(r.normal(122, 11)), DIABP: f0(r.normal(77, 8)), PULSE: f0(r.normal(70, 8)) }, sv.entryDate)
      if (sf) {
        add('D1', 'IMM', 1, d1, { ISPERF: 'N', ISDAT: '', ISTIM: '', ISREFID: '' }, sv.entryDate)
        add('D1', 'VAX', 1, d1, { EXOCCUR: 'N', EXSTDAT: '', EXSTTIM: '', EXLOC: '', EXREFID: '', OBS30: '', DIARYDEV: '' }, sv.entryDate)
        add('D1', 'EOS', 1, d1, { DSDECOD: 'SCREEN FAILURE', EOSDAT: d1 }, sv.entryDate)
        entries.push(...subjEntries); continue
      }
      const dev = `ED${pad(1000 + Number(site.id.slice(1)) * 100 + n, 4)}`
      devices[id] = dev; ecrfDevices[id] = dev
      const vaxDose = (visit: string, vd: string) => {
        const t = tm(r, 9, 15)
        const tube = `BX${pad(100000 + parseInt(hash(id + visit).slice(-5), 16) % 900000, 6)}`
        add(visit, 'IMM', 1, vd, { ISPERF: 'Y', ISDAT: vd, ISTIM: `${pad(Number(t.slice(0, 2)) - 1, 2)}${t.slice(2)}`, ISREFID: tube }, sv.entryDate > vd ? sv.entryDate : undefined)
        add(visit, 'VAX', 1, vd, { EXOCCUR: 'Y', EXSTDAT: vd, EXSTTIM: t, EXLOC: r.pick(['LEFT DELTOID', 'LEFT DELTOID', 'RIGHT DELTOID']), EXREFID: `S${pad(10000 + parseInt(hash(id + visit + 'syr').slice(-5), 16) % 90000, 5)}`, OBS30: 'N', DIARYDEV: dev })
        return tube
      }
      const sample = (visit: string, vd: string, tube: string, post: boolean) => {
        const base = r.chance(0.6) ? '<10' : String(r.pick([10, 20, 40]))
        const titre = !post || !active ? base : String(r.pick([160, 320, 640, 1280, 2560].slice(visit === 'D57' ? 1 : 0)))
        imm.push({ subj: id, visit, tube, collected: vd, reported: addDays(vd, 14), titre, comment: '' })
      }
      const tube1 = vaxDose('D1', d1)
      sample('D1', d1, tube1, false)
      doses[id] = { 1: d1 }

      // Diary after each dose.
      const diaryFor = (dose: 1 | 2, vd: string) => {
        const rx = reactions(r, active, dose)
        rx.forEach((truth, day) => diary.push({ subj: id, dose, day, date: addDays(vd, day), truth, entered: { ...truth } }))
        return rx
      }
      const rx1 = diaryFor(1, d1)
      const pc1 = addDays(d1, r.int(7, 9))
      add('PC1', 'SV', 1, pc1, { VISOCCUR: 'Y', VISDAT: pc1, UNSREAS: '' })
      add('PC1', 'CONT', 1, pc1, { DIARYREV: 'Y', MAEVT: 'N' })
      // Follow-up records from the diary, entered after the phone contact.
      let aeInst = 0, cmInst = 0, rxInst = 0
      const followUp = (dose: 1 | 2, rx: Record<string, string>[], vd: string, pc: string) => {
        const last = rx[DIARY_DAYS - 1]
        for (const item of ['PAIN', 'REDNESS', 'SWELLING', 'TEMP', 'HEADACHE', 'FATIGUE', 'MYALGIA', 'ARTHRALGIA', 'CHILLS', 'NAUSEA', 'DIARRHOEA']) {
          if (gradeOf(item, last[item]) < 1) continue
          let s = DIARY_DAYS - 1; while (s > 0 && gradeOf(item, rx[s - 1][item]) >= 1) s--
          const e = add('LOG', 'REACT', ++rxInst, pc, { CETERM: item === 'TEMP' ? 'FEVER' : item, CEDOSE: String(dose), CESTDAT: addDays(vd, s), CEENDAT: addDays(vd, DIARY_DAYS - 1 + r.int(1, 4)), CEMAXGR: String(Math.max(1, gradeOf(item, last[item]))), CEMA: 'N' })
          e.visit = 'LOG'
        }
        const medDays = rx.map((d, i) => (d.MEDS === 'Y' ? i : -1)).filter((i) => i >= 0)
        if (medDays.length) {
          const why = rx.some((d) => Number(d.TEMP) >= 38) ? 'Fever after vaccination' : rx.some((d) => Number(d.PAIN) >= 2) ? 'Injection site pain' : 'Headache after vaccination'
          const e = add('LOG', 'CM', ++cmInst, pc, { CMTRT: 'Paracetamol', CMINDC: why, CMDSTXT: '500', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: addDays(vd, medDays[0]), CMONGO: 'N', CMENDAT: addDays(vd, medDays[medDays.length - 1]) })
          e.visit = 'LOG'
        }
      }
      followUp(1, rx1, d1, pc1)
      const ae = (st: string, termIdx?: number) => {
        const t = termIdx === undefined ? r.pick(AE_TERMS) : AE_TERMS[termIdx]
        const dur = r.int(2, 9)
        const e = add('LOG', 'AE', ++aeInst, st, { AETERM: t.term, AESTDAT: st, AEONGO: 'N', AEENDAT: addDays(st, dur), AESEV: r.pick(['MILD', 'MILD', 'MODERATE']), AEMAAE: r.chance(t.ma) ? 'Y' : 'N', AESER: 'N', AESDTH: '', AESLIFE: '', AESHOSP: '', AESDISAB: '', AESCONG: '', AESMIE: '', AEREL: 'NOT RELATED', AEACN: 'DOSE NOT CHANGED', AEOUT: 'RECOVERED/RESOLVED' })
        e.visit = 'LOG'; return e
      }
      if (r.chance(0.35)) ae(addDays(d1, r.int(9, 25)))

      if (id === WITHDREW_AFTER_DOSE1) {
        const w = addDays(d1, 26)
        add('D29', 'SV', 1, w, { VISOCCUR: 'Y', VISDAT: w, UNSREAS: '' })
        add('D29', 'VS', 1, w, { VSDAT: w, TEMP: '36.6', SYSBP: '118', DIABP: '74', PULSE: '68' })
        add('D29', 'IMM', 1, w, { ISPERF: 'Y', ISDAT: w, ISTIM: '10:05', ISREFID: `BX${pad(200000 + n, 6)}` })
        add('D29', 'VAX', 1, w, { EXOCCUR: 'N', EXSTDAT: '', EXSTTIM: '', EXLOC: '', EXREFID: '', OBS30: '', DIARYDEV: '' })
        add('D29', 'EOS', 1, w, { DSDECOD: 'WITHDRAWAL BY SUBJECT', EOSDAT: w })
        subj.lastVisit = 'D29'
        entries.push(...subjEntries); continue
      }
      // Dose 2.
      const d29 = addDays(d1, 28 + (id === '202-006' ? 8 : r.int(-1, 3)))
      add('D29', 'SV', 1, d29, { VISOCCUR: 'Y', VISDAT: d29, UNSREAS: '' })
      add('D29', 'VS', 1, d29, { VSDAT: d29, TEMP: f1(Math.min(37.4, r.normal(36.6, 0.25))), SYSBP: f0(r.normal(122, 11)), DIABP: f0(r.normal(77, 8)), PULSE: f0(r.normal(70, 8)) })
      const tube2 = vaxDose('D29', d29)
      sample('D29', d29, tube2, true)
      doses[id][2] = d29
      const rx2 = diaryFor(2, d29)
      const pc2 = addDays(d29, r.int(7, 9))
      add('PC2', 'SV', 1, pc2, { VISOCCUR: 'Y', VISDAT: pc2, UNSREAS: '' })
      add('PC2', 'CONT', 1, pc2, { DIARYREV: 'Y', MAEVT: 'N' })
      followUp(2, rx2, d29, pc2)
      if (r.chance(0.3)) ae(addDays(d29, r.int(9, 25)))
      const d57 = addDays(d1, 56 + r.int(-2, 4))
      add('D57', 'SV', 1, d57, { VISOCCUR: 'Y', VISDAT: d57, UNSREAS: '' })
      add('D57', 'VS', 1, d57, { VSDAT: d57, TEMP: f1(Math.min(37.4, r.normal(36.6, 0.25))), SYSBP: f0(r.normal(122, 11)), DIABP: f0(r.normal(77, 8)), PULSE: f0(r.normal(70, 8)) })
      if (id === '202-004') add('D57', 'IMM', 1, d57, { ISPERF: 'N', ISDAT: '', ISTIM: '', ISREFID: '' })
      else { const tube3 = `BX${pad(300000 + parseInt(hash(id + 'D57').slice(-5), 16) % 600000, 6)}`; add('D57', 'IMM', 1, d57, { ISPERF: 'Y', ISDAT: d57, ISTIM: tm(r, 9, 12), ISREFID: tube3 }); sample('D57', d57, tube3, true) }
      if (id === LOST_AFTER_D57) {
        add('D181', 'EOS', 1, addDays(d1, 200), { DSDECOD: 'LOST TO FOLLOW-UP', EOSDAT: addDays(d1, 200) }, addDays(d1, 205))
        subj.lastVisit = 'D57'
      } else {
        const d181 = addDays(d1, 180 + r.int(-5, 6))
        add('D181', 'SV', 1, d181, { VISOCCUR: 'Y', VISDAT: d181, UNSREAS: '' })
        add('D181', 'CONT', 1, d181, { DIARYREV: 'N', MAEVT: 'N' })
        add('D181', 'EOS', 1, d181, { DSDECOD: 'COMPLETED', EOSDAT: d181 })
        subj.lastVisit = 'D181'
      }
      entries.push(...subjEntries)

      // ---------- planted issues ----------
      const find = (form: string, visit?: string, inst = 1) => subjEntries.find((e) => e.form === form && (visit === undefined || e.visit === visit) && e.inst === inst)
      const P = site.profile
      if (P === 'new-coordinator') {
        const vs = find('VS', 'D29'); if (vs && n % 3 === 1) plant(vs, 'TEMP', f1(Number(vs.truth.TEMP) * 9 / 5 + 32), 'error', { check: 'VS-53' }, 'Temperature entered in °F.')
        const vx = find('VAX', 'D1'); if (vx && n % 4 === 2) plant(vx, 'EXREFID', vx.truth.EXREFID.slice(1), 'error', { check: 'VAX-04' }, 'Syringe ID typed without its S prefix.')
        const im = find('IMM', 'D29'); if (im && n % 4 === 3) plant(im, 'ISREFID', im.truth.ISREFID.slice(0, -1), 'error', { check: 'IMM-04' }, 'A digit of the tube barcode missed.')
        const vs1 = find('VS', 'D1'); if (vs1 && n === 8) plant(vs1, 'SYSBP', vs1.truth.SYSBP + '0', 'error', { check: 'VS-54' }, 'Extra digit typed in systolic BP.')
        const ic = find('IC', 'D1'); if (ic && n === 4) plant(ic, 'ICVER', 'v1.0', 'error', { check: 'IC-54' }, 'Superseded consent version typed; the participant signed v1.1.')
      }
      if (P === 'slow' && n === 6) { const sv2 = find('SV', 'D29'); if (sv2) issues.push({ id: `VI-${pad(++issueN, 3)}`, subj: id, site: site.id, visit: 'D29', form: 'SV', inst: 1, field: 'VISDAT', kind: 'true-value', find: { check: 'SV-54' }, note: 'A true late second dose (day 37): the site confirms it and it becomes a protocol deviation.' }) }
      if (P === 'slow' && n === 8) { const c = find('CONT', 'PC1'); if (c) plant(c, 'MAEVT', 'Y', 'error', { check: 'CONT-02' }, 'Medically attended event ticked by mistake; no event happened.') }
      if (id === '201-006') { const e = ae(addDays(d1, 1)); e.truth = { ...e.truth, AETERM: 'Fever', AEMAAE: 'N' }; e.values = { ...e.truth }; issues.push({ id: `VI-${pad(++issueN, 3)}`, subj: id, site: site.id, visit: 'LOG', form: 'AE', inst: e.inst, field: 'AETERM', kind: 'error', find: { listing: 'diary-recon' }, note: 'A diary fever also entered as an unsolicited AE: the site deletes the AE.' }); entries.push(e) }
      if (P === 'clean' && n === 12) { const v = find('VAX', 'D1'); if (v) plant(v, 'DIARYDEV', '', 'error', { check: 'VAX-05' }, 'Diary device ID left blank.') }
      if (P === 'late' && n === 3) { const vs = find('VS', 'D1'); if (vs) plant(vs, 'TEMP', '', 'error', { check: 'VS-51' }, 'Pre-vaccination temperature left blank.') }
    }
  }

  // ---------- diary plants ----------
  const dd = (subj: string, dose: 1 | 2, day: number) => diary.find((x) => x.subj === subj && x.dose === dose && x.day === day)!
  const setTruth = (subj: string, dose: 1 | 2, day: number, vals: Record<string, string>, entered?: Record<string, string>) => { const x = dd(subj, dose, day); if (!x) return; Object.assign(x.truth, vals); Object.assign(x.entered, vals, entered ?? {}); forced[`${subj}|${dose}|${day}`] = 'entered' }
  // M15: six correction requests reported by sites and monitors.
  setTruth('201-002', 1, 1, { TEMP: '37.9' }, { TEMP: '38.9' })
  setTruth('201-003', 1, 1, { REDNESS: '0' })
  setTruth('202-001', 1, 2, { SWELLING: '12' }, { SWELLING: '120' })
  setTruth('202-002', 1, 1, { TEMP: '39.4', MEDS: 'Y' })
  setTruth('201-004', 1, 0, { TEMP: '38.0', MEDS: 'Y' }, { TEMP: '100.4' })
  forced['201-001|1|4'] = 'missed'
  const reqDate = (subj: string, dose: 1 | 2, day: number, after: number) => addDays(dd(subj, dose, day).date, after)
  const requests: CorrectionRequest[] = [
    { id: 'DCF-01', subj: '201-002', dose: 1, day: 1, field: 'TEMP', date: reqDate('201-002', 1, 1, 1), from: '38.9', to: '37.9', requester: 'Site 201 coordinator', source: 'Phone note written during the participant’s call at 08:40 the next morning', story: 'The participant called the site the next morning: the thermometer showed 37.9 °C but she typed 38.9. The coordinator wrote a phone note during the call.', expected: 'send', why: 'The participant noticed the error at once and a contemporaneous phone note supports it. The correction goes to the diary vendor through a data clarification form, with the note as source.' },
    { id: 'DCF-02', subj: '201-003', dose: 1, day: 1, field: 'REDNESS', date: reqDate('201-003', 1, 1, 7), from: '0', to: '30', requester: 'Site 201 coordinator', source: 'Day 8 phone contact: the participant now remembers some redness', story: 'At the Day 8 phone contact the participant said he now thinks there was redness of about 3 cm on day 2. Nothing was reported at the time, and there is no photo or note.', expected: 'return', why: 'A recollection a week later is not a contemporaneous source. Diary data are not changed from recall; the site notes the conversation in the source documents.' },
    { id: 'DCF-03', subj: '202-001', dose: 1, day: 2, field: 'SWELLING', date: reqDate('202-001', 1, 2, 0), from: '120', to: '12', requester: 'Site 202 coordinator', source: 'Participant’s e-mail sent 20 minutes after the diary entry', story: 'The participant e-mailed the site the same evening: “I typed 120 for the swelling, it was 12 mm on the ruler.” The e-mail is filed in the source.', expected: 'send', why: 'The data originator reported the error immediately, in writing. Send the correction to the vendor with the e-mail as source.' },
    { id: 'DCF-04', subj: '202-002', dose: 1, day: 1, field: 'TEMP', date: reqDate('202-002', 1, 1, 2), from: '39.4', to: '', requester: 'Clinical research associate', source: 'None: the CRA thinks the thermometer was faulty', story: 'The CRA asks for the grade 3 fever to be deleted because “it is probably a thermometer error”. The participant has not reported any error, and took paracetamol that day.', expected: 'return', why: 'Neither the sponsor nor the monitor may change participant-entered data, and there is no source showing an error. The investigator can assess the fever clinically; the diary value stands.' },
    { id: 'DCF-05', subj: '201-004', dose: 1, day: 0, field: 'TEMP', date: reqDate('201-004', 1, 0, 1), from: '100.4', to: '38.0', requester: 'Site 201 coordinator', source: 'Phone note from the participant’s call the next morning; thermometer set to °F', story: 'The participant called: her own thermometer was set to Fahrenheit and she entered 100.4. The coordinator confirmed the reading and noted that 100.4 °F is 38.0 °C.', expected: 'send', why: 'A contemporaneous phone note supports it and the value converts exactly. Send it, and ask the vendor why the diary accepted a value outside the °C range.' },
    { id: 'DCF-06', subj: '201-001', dose: 1, day: 4, field: 'ALL', date: reqDate('201-001', 1, 4, 4), from: '(no entry)', to: 'Values recalled at the Day 8 contact', requester: 'Site 201 coordinator', source: 'Participant’s recollection at the Day 8 phone contact', story: 'Day 5 of the diary is missing. The coordinator asks to fill it in from what the participant remembers at the Day 8 phone contact.', expected: 'return', why: 'A missed diary day stays missing. Recall data are not entered into the diary; if the protocol allows, recalled information is collected separately and flagged as recall.' },
  ]
  // M16: diary facts with no matching eCRF record, or a mismatch with the vendor.
  setTruth('201-005', 1, 6, { REDNESS: '60' }); setTruth('201-005', 1, 5, { REDNESS: '70' })
  const drop = (subj: string, form: string, test: (e: Entry) => boolean) => { const i = entries.findIndex((e) => e.subj === subj && e.form === form && test(e)); if (i >= 0) entries.splice(i, 1) }
  drop('201-005', 'REACT', (e) => e.truth.CETERM === 'REDNESS' && e.truth.CEDOSE === '1')
  setTruth('202-003', 2, 1, { MEDS: 'Y', HEADACHE: '2' })
  drop('202-003', 'CM', (e) => e.truth.CMSTDAT >= (doses['202-003'][2] ?? ''))
  setTruth('202-005', 1, 1, { PAIN: '3', MEDVISIT: 'Y' })
  const swap = ['201-007', '201-008']; devices[swap[0]] = ecrfDevices[swap[1]]; devices[swap[1]] = ecrfDevices[swap[0]]
  const im9 = imm.find((x) => x.subj === '201-009' && x.visit === 'D29'); if (im9) im9.collected = addDays(im9.collected, 1)
  const haem = imm.find((x) => x.subj === '203-002' && x.visit === 'D29'); if (haem) { haem.titre = ''; haem.comment = 'Haemolysed: no reportable result' }
  // The M15 plants add medicine use on some days; the site has recorded those medicines.
  for (const subj of ['201-002', '202-002', '201-004']) {
    const days = diary.filter((x) => x.subj === subj && x.dose === 1 && x.truth.MEDS === 'Y').map((x) => x.day)
    if (!days.length || entries.some((e) => e.subj === subj && e.form === 'CM' && e.truth.CMSTDAT >= doses[subj][1]! && e.truth.CMSTDAT <= addDays(doses[subj][1]!, 6))) continue
    const inst = 1 + Math.max(0, ...entries.filter((e) => e.subj === subj && e.form === 'CM').map((e) => e.inst))
    const vd = doses[subj][1]!
    entries.push({ subj, site: subj.slice(0, 3), visit: 'LOG', form: 'CM', inst, visitDate: addDays(vd, 8), entryDate: addDays(vd, 10), truth: { CMTRT: 'Paracetamol', CMINDC: 'Fever after vaccination', CMDSTXT: '500', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: addDays(vd, days[0]), CMONGO: 'N', CMENDAT: addDays(vd, days[days.length - 1]) }, values: { CMTRT: 'Paracetamol', CMINDC: 'Fever after vaccination', CMDSTXT: '500', CMDOSU: 'mg', CMROUTE: 'ORAL', CMSTDAT: addDays(vd, days[0]), CMONGO: 'N', CMENDAT: addDays(vd, days[days.length - 1]) } })
  }

  entries.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.subj.localeCompare(b.subj))
  return { subjects, entries, issues, hidden, vax: { doses, devices, ecrfDevices, behaviour, diary, forced, imm, requests } }
}

let cache: VaxSeed | null = null
export const vaxSeed = () => (cache ??= generateVaxStudy())
export const VAX_START = VAX_STUDY.start
export const VAX_SEED_VERSION = 1
