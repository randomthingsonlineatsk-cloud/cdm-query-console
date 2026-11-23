// The sites' data for the oncology trial ONK-44-302 (MERIDIAN-2). The TRUE values are the study's
// source records: the same records the SDTM Mapping Trainer maps (source.json, written by that
// app's tests/cdmonk.test.mjs). Four oddities in those records are real and stay: the
// investigator's sum of diameters at one visit, a partial response called at a 28% decrease, a
// death known only to the month and a scan not done. The site confirms each when queried. The
// ENTERED values add ten transcription errors that the site corrects to the source when queried,
// so the cleaned and locked database equals the source records.

import { addDays, rng } from '../util'
import type { Entry, Issue, IssueFinder, SeedStudy, SeedSubject } from '../seed'
import { ONK_SITES, ONK_STUDY, ONK_ASSESS, visitOfRaw } from './study'
import SOURCE from './source.json'

type Row = Record<string, string>
export interface OnkSource { format: string; cutoff: string; planted: Record<string, string>; subjects: { subj: string; arm?: string }[]; forms: Record<string, Row[]> }
export const ONK_SOURCE = SOURCE as unknown as OnkSource

const LAG: Record<string, [number, number]> = { clean: [1, 3], 'new-coordinator': [3, 7] }
// The first criterion each screen failure did not meet (not in the source records, which hold
// only the randomised participants' eligibility through the IRT).
export const ONK_SCREEN_FAIL: Record<string, string> = { '401-004': 'IN03', '401-013': 'IN04', '401-022': 'EX01', '401-029': 'IN02', '401-037': 'IN04', '402-045': 'EX01' }
export type OnkArm = 'ONK44' | 'DOCE'
export const ONK_ARM_NAME: Record<OnkArm, string> = { ONK44: 'ONK-44 400 mg', DOCE: 'Docetaxel 75 mg/m²' }

export interface OnkSeed extends SeedStudy { onk: { arms: Record<string, OnkArm>; cutoff: string } }

const pad = (n: number, w = 3) => String(n).padStart(w, '0')
export const AE_FIELDS = ['AETERM', 'AESTDAT', 'AEONGO', 'AEENDAT', 'AETOXGR', 'AESER', 'AESDTH', 'AESLIFE', 'AESHOSP', 'AESDISAB', 'AESCONG', 'AESMIE', 'AEREL', 'AEACN', 'AEOUT']
const NOT_DONE = 'Scanner unavailable; scan not done in window'

export function generateOnkStudy(seed = 44303): OnkSeed {
  const r = rng(seed)
  const ra = rng(seed + 1) // adverse event entry lags: a stream of their own, so the other records' timing is unchanged
  const F = ONK_SOURCE.forms
  const by = (form: string, subj: string) => (F[form] ?? []).filter((x) => x.SUBJID === subj)
  const subjects: SeedSubject[] = []
  const entries: Entry[] = []
  const issues: Issue[] = []
  const arms: Record<string, OnkArm> = {}
  for (const s of ONK_SOURCE.subjects) {
    const id = s.subj, dm = by('DM', id)[0], site = ONK_SITES.find((x) => x.id === dm.SITEID)!
    const lag = () => r.int(...LAG[site.profile])
    const add = (visit: string, form: string, inst: number, visitDate: string, truth: Row, entryDate?: string) => {
      const e: Entry = { subj: id, site: site.id, visit, form, inst, visitDate, entryDate: entryDate ?? addDays(visitDate, lag()), truth, values: { ...truth } }
      entries.push(e); return e
    }
    const scr = dm.DMDAT
    const irt = by('IRT', id)[0]
    const sf = ONK_SCREEN_FAIL[id]
    const subj: SeedSubject = { id, site: site.id, scr, fate: irt ? 'completed' : 'screen-fail', lastVisit: 'SCR', arm: (s.arm ?? 'ONK44') as SeedSubject['arm'] }
    if (s.arm) arms[id] = s.arm as OnkArm
    subjects.push(subj)

    // Screening: consent, demography, eligibility and prior procedures on the screening day.
    const ic = add('SCR', 'IC', 1, scr, { DSSTDAT: by('IC', id)[0].ICDAT })
    add('SCR', 'SV', 1, scr, { VISOCCUR: 'Y', VISDAT: scr, UNSREAS: '' }, ic.entryDate)
    add('SCR', 'DM', 1, scr, { BRTHDAT: dm.BRTHDAT, SEX: dm.SEX, RACE: dm.RACE, ETHNIC: dm.ETHNIC }, ic.entryDate)
    add('SCR', 'IE', 1, scr, sf ? { IEYN: 'N', IETESTCD: sf } : { IEYN: 'Y', IETESTCD: '' }, ic.entryDate)
    for (const p of by('PRP', id)) add('SCR', 'PRP', Number(p.PRSPID), scr, { PROC: p.PROC, PRCAT: p.PRCAT, LOC: p.LOC, LAT: p.LAT, STDAT: p.STDAT, ENDAT: p.ENDAT, DOSE: p.DOSE, DOSEU: p.DOSEU }, ic.entryDate)
    const lc = by('LC', id)[0]
    if (!irt) { add('LOG', 'LC', 1, lc.LCDAT, { LCDAT: lc.LCDAT }, addDays(lc.LCDAT, lag() + 3)); continue }

    // Tumour assessments: the baseline scan (screening) and every 6 weeks from randomisation.
    const rand = irt.RANDDT
    subj.d1 = rand
    const visits = ['Screening', ...ONK_ASSESS.map((v) => `Week ${v.slice(1)}`)]
    let scrScan = ''
    for (const raw of visits) {
      const v = visitOfRaw(raw)
      const tui = by('TUI', id).filter((x) => x.VISIT === raw), trm = by('TRM', id).filter((x) => x.VISIT === raw), rsp = by('RSP', id).find((x) => x.VISIT === raw)
      if (!trm.length && !rsp) continue
      const notDone = trm.length > 0 && trm.every((x) => x.NOTDONE)
      const scan = notDone ? addDays(rand, Number(v.slice(1)) * 7) : (trm.find((x) => x.ASSDAT)?.ASSDAT ?? rsp?.ASSDAT ?? '')
      let entry: string
      if (v === 'SCR') { scrScan = scan; entry = addDays(scan, lag()) }
      else {
        const sv = add(v, 'SV', 1, scan, notDone ? { VISOCCUR: 'N', VISDAT: '', UNSREAS: NOT_DONE } : { VISOCCUR: 'Y', VISDAT: scan, UNSREAS: '' })
        entry = sv.entryDate
        subj.lastVisit = v
      }
      tui.forEach((x, i) => add(v, 'TUI', i + 1, scan, { ASSDAT: x.ASSDAT, LESID: x.LESID, LESTYPE: x.LESTYPE, LOC: x.LOC, LAT: x.LAT, NODAL: x.NODAL, METHOD: x.METHOD }, entry))
      trm.forEach((x, i) => add(v, 'TRM', i + 1, scan, { ASSDAT: x.ASSDAT, LESID: x.LESID, DIAM: x.DIAM, TSTM: x.TSTM === 'Y' ? 'Y' : '', LESSTAT: x.LESSTAT, NOTDONE: x.NOTDONE }, entry))
      if (rsp) add(v, 'RSP', 1, scan, { ASSDAT: rsp.ASSDAT, SUMDIAM: rsp.SUMDIAM, TRGRESP: rsp.TRGRESP, NTRGRESP: rsp.NTRGRESP, NEWLES: rsp.NEWLES, OVRLRESP: rsp.OVRLRESP }, entry)
    }
    void scrScan
    // Day 1 is the randomisation visit; the date comes from the IRT confirmation.
    add('D1', 'SV', 1, rand, { VISOCCUR: 'Y', VISDAT: rand, UNSREAS: '' })
    // Treatment cycles, death and last contact are subject logs.
    for (const x of by('EX', id)) add('LOG', 'EX', Number(x.CYCLE), x.EXSTDAT, { CYCLE: x.CYCLE, EXSTDAT: x.EXSTDAT, EXENDAT: x.EXENDAT }, addDays(x.EXENDAT, lag()))
    // Adverse events: entered a few days after onset (a serious one within a day or two, after the SAE form).
    for (const a of by('AE', id)) {
      const t: Row = {}
      for (const f of AE_FIELDS) t[f] = a[f] ?? ''
      add('LOG', 'AE', Number(a.AESPID), a.AESTDAT, t, addDays(a.AEOUT === 'FATAL' ? a.AEENDAT : a.AESER === 'Y' ? a.AESTDAT : a.AEENDAT || a.AESTDAT, a.AESER === 'Y' ? ra.int(1, 2) : ra.int(...LAG[site.profile])))
    }
    const dth = by('DTH', id)[0]
    if (dth) { const d = dth.DTHDAT.length === 7 ? `${dth.DTHDAT}-28` : dth.DTHDAT; add('LOG', 'DTH', 1, d, { DTHDAT: dth.DTHDAT, DTHCAUSE: dth.DTHCAUSE }, addDays(d, lag() + 2)) }
    add('LOG', 'LC', 1, lc.LCDAT, { LCDAT: lc.LCDAT }, addDays(lc.LCDAT, lag()))
  }

  // Planted issues: the source's own oddities (true values) and the sites' transcription errors.
  let n = 0
  const find = (subj: string, visit: string, form: string, inst: number | ((e: Entry) => boolean) = 1) => {
    const e = entries.find((x) => x.subj === subj && x.visit === visit && x.form === form && (typeof inst === 'number' ? x.inst === inst : inst(x)))
    if (!e) throw new Error(`ONK seed plant has no record: ${subj} ${visit} ${form}`)
    return e
  }
  const plant = (e: Entry, field: string, kind: Issue['kind'], find: IssueFinder, note: string, entered?: string) => {
    if (kind === 'error') e.values[field] = entered!
    issues.push({ id: `KI-${pad(++n)}`, subj: e.subj, site: e.site, visit: e.visit, form: e.form, inst: e.inst, field, kind, find, note })
  }
  const P = ONK_SOURCE.planted
  plant(find(P.sumError, 'W12', 'RSP'), 'SUMDIAM', 'true-value', { check: 'RSP-93' }, 'The investigator’s signed RECIST worksheet gives a sum of 37 mm; the lesion pages add up to 27 mm. Confirmed as signed: the response (PR) was assessed on the correct measurements. The SDTM team derives the sum from the measurements.')
  plant(find(P.investigatorPR, 'W18', 'RSP'), 'TRGRESP', 'true-value', { check: 'RSP-94' }, 'The investigator called a partial response at a 28% decrease from baseline (RECIST needs 30%). Confirmed as the investigator’s assessment; the independent review is the primary assessment.')
  plant(find(P.partialDeath, 'LOG', 'DTH'), 'DTHDAT', 'true-value', { check: 'DTH-93' }, 'The participant died abroad; the family reported only the month. Confirmed: the day is unknown.')
  plant(find(P.scanNotDone, 'W18', 'SV'), 'VISOCCUR', 'true-value', { check: 'SV-98' }, 'The scanner was unavailable and the Week 18 scan was not done in the window. Confirmed: a procedure-not-done deviation.')
  const e1 = find('401-007', 'SCR', 'IC'); plant(e1, 'DSSTDAT', 'error', { check: 'IC-92' }, 'Consent date typed a week late; the signed form is dated the screening day.', addDays(e1.truth.DSSTDAT, 7))
  const e2 = find('401-010', 'SCR', 'DM'); plant(e2, 'BRTHDAT', 'error', { check: 'DM-95' }, 'The screening date was typed in the date of birth field.', e2.visitDate)
  const e3 = find('401-014', 'SCR', 'PRP', 1); plant(e3, 'STDAT', 'error', { check: 'PRP-92' }, 'Procedure date typed day first (DD/MM/YYYY).', e3.truth.STDAT.length === 10 ? `${e3.truth.STDAT.slice(8)}/${e3.truth.STDAT.slice(5, 7)}/${e3.truth.STDAT.slice(0, 4)}` : `${e3.truth.STDAT.slice(5)}/${e3.truth.STDAT.slice(0, 4)}`)
  // A target diameter with its digits swapped (the swap more than doubles the lesion).
  const swap = entries.find((e) => e.site === '401' && e.form === 'TRM' && e.visit === 'W12' && /^[1-4]\d$/.test(e.truth.DIAM) && Number([...e.truth.DIAM].reverse().join('')) >= 2.2 * Number(e.truth.DIAM) && !['401-005', '401-007', '401-010', '401-014'].includes(e.subj))!
  plant(swap, 'DIAM', 'error', { check: 'TRM-99' }, `Diameter typed with its digits swapped (${[...swap.truth.DIAM].reverse().join('')} for ${swap.truth.DIAM} mm). The response page is right, so the response checks fire too; they close by themselves when the diameter is corrected.`, [...swap.truth.DIAM].reverse().join(''))
  plant(find('401-026', 'W30', 'RSP'), 'OVRLRESP', 'error', { check: 'RSP-97' }, 'Overall response entered as SD; a new lesion was found, so the worksheet says PD.', 'SD')
  const e6 = find('401-023', 'W12', 'RSP'); plant(e6, 'ASSDAT', 'error', { check: 'RSP-99' }, 'Scan date typed a day late on the response page. The independent review file has the right date.', addDays(e6.truth.ASSDAT, 1))
  const e7 = find('401-035', 'LOG', 'EX', 3); plant(e7, 'EXENDAT', 'error', { check: 'EX-96' }, 'End date of cycle 3 typed a month late.', addDays(e7.truth.EXENDAT, 30))
  plant(find('401-031', 'SCR', 'TUI', 1), 'NODAL', 'error', { check: 'TUI-93' }, '“Lymph node?” left blank on the first lesion page.', '')
  plant(find('402-030', 'LOG', 'LC'), 'LCDAT', 'error', { check: 'LC-91' }, 'Date of last contact left blank.', '')
  // Adverse event pages.
  const fn = entries.find((e) => e.form === 'AE' && e.site === '401' && e.truth.AESER === 'Y' && /neutropeni/i.test(e.truth.AETERM))!
  plant(fn, 'AESHOSP', 'error', { check: 'AE-96' }, 'Serious febrile neutropenia entered with no seriousness criterion: the participant was admitted, but “hospitalisation” was left No.', 'N')
  const short = entries.find((e) => e.form === 'AE' && e.site === '401' && e.truth.AESER === 'N' && e.truth.AEENDAT && (Date.parse(e.truth.AEENDAT) - Date.parse(e.truth.AESTDAT)) / 86400000 < 25 && !['401-007', '401-010', '401-014', '401-031'].includes(e.subj))!
  plant(short, 'AEENDAT', 'error', { check: 'AE-95' }, 'End date typed with the previous month, so the event ends before it began.', addDays(short.truth.AEENDAT, -30))
  const fatal = entries.find((e) => e.form === 'AE' && e.site === '402' && e.truth.AEOUT === 'FATAL')!
  plant(fatal, 'AEOUT', 'error', { check: 'AE-97' }, 'Fatal event entered with the outcome “Not recovered/not resolved”; the death form and the SAE report say the participant died of it.', 'NOT RECOVERED/NOT RESOLVED')
  const e10 = find(P.tooSmall, 'W18', 'TRM', (e) => e.truth.TSTM === 'Y'); plant(e10, 'DIAM', 'error', { check: 'TRM-93' }, 'A 3 mm diameter entered for a lesion ticked as too small to measure; the radiologist’s report says “too small to measure”.', '3')

  entries.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.subj.localeCompare(b.subj) || a.visit.localeCompare(b.visit) || a.form.localeCompare(b.form) || a.inst - b.inst)
  return { subjects, entries, issues, hidden: [], onk: { arms, cutoff: ONK_SOURCE.cutoff } }
}

let cache: OnkSeed | null = null
export const onkSeed = () => (cache ??= generateOnkStudy())
export const ONK_START = ONK_STUDY.start
