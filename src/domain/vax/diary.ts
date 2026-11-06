// The e-diary at run time. Participants fill in each day's diary in the evening; the entry
// stays open until noon the next day, then locks. A missed day cannot be recovered later, so
// the data manager watches compliance while the window is open and asks the site to remind
// the participant. Diary data are electronic source: the data manager cannot edit them. A
// correction is a data clarification form (DCF) started by the site with a contemporaneous
// source, applied by the diary vendor, and kept in the audit trail (EMA guideline on
// computerised systems and electronic data in clinical trials, 2023, Annex 5).

import type { DiaryDay, Project, VaxState } from '../types'
import { addDays, hash, simUtc } from '../util'
import { audit, me, nowUtc, SYSTEM, value } from '../project'
import { formsOfSubject } from '../engine'
import { vaxSeed, type DiaryTruth, type Behaviour } from './seed'
import { DIARY_DAYS, gradeOf, DIARY_ITEMS, VAX_CODELISTS } from './study'

export const emptyVax = (): VaxState => ({ days: {}, alerts: [], deviceFixed: {}, dcf: {}, recon: {}, vendorQueries: [] })
export const dayKey = (subj: string, dose: number, day: number) => `${subj}|${dose}|${day}`
const u01 = (s: string) => parseInt(hash(s).slice(-6), 16) / 0xffffff
const EVENING: Record<Behaviour, number> = { diligent: 0.96, forgetful: 0.55, device: 0.96 }

function upload(p: Project, subj: string, enteredOn: string, beh: Behaviour) {
  if (beh !== 'device') return enteredOn
  // A device that does not sync uploads four days late, until the site fixes it.
  const fixed = p.vax!.deviceFixed[subj]
  const late = addDays(enteredOn, 4)
  if (!fixed) return late
  if (enteredOn >= fixed) return enteredOn
  const after = addDays(fixed, 1)
  return after < late ? after : late
}

// Called once for each new study date.
export function processDiary(p: Project) {
  const v = (p.vax ??= emptyVax())
  const s = vaxSeed().vax
  const D = p.clock
  const y = addDays(D, -1), y2 = addDays(D, -2)
  for (const x of s.diary) {
    if (x.date !== y && x.date !== y2) continue
    const k = dayKey(x.subj, x.dose, x.day)
    const beh = s.behaviour[x.subj]
    const f = s.forced[k]
    const d: DiaryDay = (v.days[k] ??= {})
    if (x.date === y && d.entered === undefined && !d.openedOn) {
      const evening = f ? f === 'entered' : u01('ev' + k) < EVENING[beh]
      if (evening) { d.entered = true; d.enteredUtc = simUtc(y, 19 * 60 + Math.floor(u01('t' + k) * 180)); d.uploadDate = upload(p, x.subj, y, beh); d.values = { ...x.entered } }
      if (!evening || beh === 'device') d.openedOn = D
    }
    if (x.date === y2 && d.entered === undefined) {
      const alerted = d.alertDate === d.openedOn
      const late = f ? f === 'entered' : u01('late' + k) < (alerted ? 0.85 : 0.15)
      if (late) { d.entered = true; d.enteredUtc = simUtc(y, 8 * 60 + Math.floor(u01('t2' + k) * 200)); d.uploadDate = upload(p, x.subj, y, beh); d.values = { ...x.entered } }
      else d.entered = false
    }
  }
  // Vendor applies the corrections sent the day before.
  for (const [id, dec] of Object.entries(v.dcf)) {
    if (dec.decision !== 'send' || dec.applied || dec.utc.slice(0, 10) >= D) continue
    const r = s.requests.find((x) => x.id === id); if (!r) continue
    const d = v.days[dayKey(r.subj, r.dose, r.day)]
    dec.applied = D
    if (!d?.values || r.field === 'ALL') continue
    const from = d.values[r.field] ?? ''
    d.values[r.field] = dec.value ?? r.to
    ;(d.changes ??= []).push({ utc: simUtc(D, 10 * 60), field: r.field, from, to: d.values[r.field], dcf: id })
    audit(p, SYSTEM, 'diary.dcf-applied', `${r.subj} dose ${r.dose} day ${r.day + 1} · ${r.field}`, from, d.values[r.field], `Applied by the diary vendor under ${id}`, simUtc(D, 10 * 60))
  }
}

// What the data manager sees for one diary day today.
export type DayView = 'received' | 'open' | 'missed' | 'future' | 'not due'
export function viewOf(p: Project, x: DiaryTruth): DayView {
  const d = p.vax?.days[dayKey(x.subj, x.dose, x.day)]
  if (x.date >= p.clock) return 'future'
  if (d?.entered && d.uploadDate && d.uploadDate <= p.clock) return 'received'
  if (x.date === addDays(p.clock, -1)) return 'open'
  return 'missed'
}
export function diaryFor(subj: string) { return vaxSeed().vax.diary.filter((x) => x.subj === subj) }

export function sendAlert(p: Project, key: string, note: string) {
  const u = me(p)
  if (!['dm', 'dmlead', 'cra'].includes(u.role)) throw new Error('Data management or the CRA sends compliance alerts.')
  const v = (p.vax ??= emptyVax())
  const [subj, dose, day] = key.split('|')
  const x = vaxSeed().vax.diary.find((y) => y.subj === subj && String(y.dose) === dose && String(y.day) === day)
  if (!x || viewOf(p, x) !== 'open') throw new Error('Alerts are for a diary day that is still open (until 12:00 today).')
  const d = (v.days[key] ??= {})
  if (d.alertDate === p.clock) throw new Error('The site has already been alerted about this day.')
  d.alertDate = p.clock
  if (vaxSeed().vax.behaviour[subj] === 'device' && !v.deviceFixed[subj]) {
    v.deviceFixed[subj] = p.clock
    for (const [k, dd] of Object.entries(v.days)) if (k.startsWith(subj + '|') && dd.entered && dd.uploadDate && dd.uploadDate > p.clock) dd.uploadDate = addDays(p.clock, 1)
  }
  v.alerts.push({ key, date: p.clock, userId: u.id, utc: nowUtc(p), note: note.trim() || 'Please remind the participant to complete yesterday’s diary before 12:00 today.' })
  audit(p, u, 'diary.alert', `${subj} dose ${dose} day ${Number(day) + 1}`, undefined, 'site alerted', note.trim() || 'Compliance reminder')
}
export function alertOutcome(p: Project, key: string): string {
  const [subj] = key.split('|')
  const d = p.vax?.days[key]
  if (!d) return ''
  if (vaxSeed().vax.behaviour[subj] === 'device') return 'The participant had completed the diary but the device was not syncing. The site restarted it; the data upload with the next transfer.'
  if (d.entered === undefined) return 'Site is calling the participant.'
  return d.entered ? 'The participant completed the day before the window closed.' : 'The participant could not be reached in time; the day is missing.'
}

// ---------- data clarification forms ----------
export const dcfVisible = (p: Project) => vaxSeed().vax.requests.filter((r) => r.date <= p.clock)
export function decideDcf(p: Project, id: string, decision: 'send' | 'return', reason: string, valueTo?: string) {
  const u = me(p)
  if (!['dm', 'dmlead'].includes(u.role)) throw new Error('Data management reviews data clarification forms.')
  const v = (p.vax ??= emptyVax())
  if (v.dcf[id]?.applied) throw new Error('The vendor has already applied this correction.')
  if (!reason.trim()) throw new Error('Record the reason for the decision.')
  const r = vaxSeed().vax.requests.find((x) => x.id === id)!
  v.dcf[id] = { decision, value: decision === 'send' ? (valueTo ?? r.to).trim() : undefined, reason: reason.trim(), userId: u.id, utc: nowUtc(p) }
  audit(p, u, decision === 'send' ? 'diary.dcf-send' : 'diary.dcf-return', `${id} · ${r.subj} dose ${r.dose} day ${r.day + 1} · ${r.field}`, r.from, decision === 'send' ? v.dcf[id].value : 'returned to site', reason.trim())
}

// ---------- diary transfers ----------
export interface Transfer { file: string; date: string; records: number; participants: number; issues: string[] }
export function transfers(p: Project): Transfer[] {
  const s = vaxSeed().vax
  const by = new Map<string, { recs: number; subs: Set<string> }>()
  for (const x of s.diary) {
    const d = p.vax?.days[dayKey(x.subj, x.dose, x.day)]
    if (!d?.entered || !d.uploadDate || d.uploadDate > p.clock) continue
    const e = by.get(d.uploadDate) ?? { recs: 0, subs: new Set() }
    e.recs++; e.subs.add(x.subj); by.set(d.uploadDate, e)
  }
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, e]) => {
    const issues = [...e.subs].filter((subj) => ecrfDevice(p, subj) && ecrfDevice(p, subj) !== s.devices[subj]).map((subj) => `${subj}: the vendor links device ${s.devices[subj]}; the eCRF records ${ecrfDevice(p, subj)}`)
    return { file: `ALV3301_EDIARY_${date.replace(/-/g, '')}.csv`, date, records: e.recs, participants: e.subs.size, issues }
  })
}
export function ecrfDevice(p: Project, subj: string) { return value(p, `${subj}|D1|VAX|1|DIARYDEV`) }
export function queryVendor(p: Project, about: string, text: string) {
  const u = me(p)
  if (!['dm', 'dmlead'].includes(u.role)) throw new Error('Data management queries the vendor.')
  if (!text.trim()) throw new Error('Write what the vendor should check.')
  const v = (p.vax ??= emptyVax())
  const q = { id: `VQ-${String(v.vendorQueries.length + 1).padStart(3, '0')}`, about, text: text.trim(), utc: nowUtc(p), userId: u.id }
  v.vendorQueries.push(q)
  audit(p, u, 'diary.vendor-query', q.id, undefined, about, q.text)
}

// ---------- compliance ----------
export function compliance(p: Project, from = '0000', to = addDays(p.clock, -2)) {
  const s = vaxSeed().vax
  const due = s.diary.filter((x) => x.date >= from && x.date <= to)
  const entered = due.filter((x) => p.vax?.days[dayKey(x.subj, x.dose, x.day)]?.entered)
  return { due: due.length, entered: entered.length, pct: due.length ? Math.round((entered.length / due.length) * 1000) / 10 : 100 }
}

// ---------- reconciliation: diary against eCRF, vendor and lab ----------
export interface ReconRow { id: string; subj: string; kind: 'react' | 'meds' | 'medvisit' | 'dup-ae' | 'device' | 'lab'; diary: string; other: string; matched: boolean; expected: 'match' | 'site' | 'vendor' }
const label = (item: string) => (item === 'TEMP' ? 'Fever' : DIARY_ITEMS.find((i) => i.id === item)?.label ?? item)
export function reconRows(p: Project): ReconRow[] {
  const s = vaxSeed().vax
  const rows: ReconRow[] = []
  const scope = Object.entries(s.doses).filter(([, d]) => d[2] && addDays(d[2], 20) <= p.clock).map(([subj]) => subj)
  for (const subj of scope) {
    const forms = formsOfSubject(p, subj)
    const days = (dose: 1 | 2) => Array.from({ length: DIARY_DAYS }, (_, i) => p.vax?.days[dayKey(subj, dose, i)]?.values)
    for (const dose of [1, 2] as const) {
      const vd = s.doses[subj][dose]!; const end = addDays(vd, DIARY_DAYS - 1)
      const dd = days(dose)
      const last = dd[DIARY_DAYS - 1]
      if (last) for (const item of ['PAIN', 'REDNESS', 'SWELLING', 'TEMP', 'HEADACHE', 'FATIGUE', 'MYALGIA', 'ARTHRALGIA', 'CHILLS', 'NAUSEA', 'DIARRHOEA']) {
        if (gradeOf(item, last[item]) < 1) continue
        const term = item === 'TEMP' ? 'FEVER' : item
        const rx = forms.find((f) => f.form === 'REACT' && f.values.CETERM === term && f.values.CEDOSE === String(dose))
        rows.push({ id: `react|${subj}|${dose}|${item}`, subj, kind: 'react', diary: `Dose ${dose}: ${label(item)} still present on day 7 (${last[item]}${item === 'REDNESS' || item === 'SWELLING' ? ' mm' : item === 'TEMP' ? ' °C' : ''})`, other: rx ? `Continuing-reaction form: started ${rx.values.CESTDAT}, ended ${rx.values.CEENDAT || 'ongoing'}` : 'No continuing-reaction form', matched: !!rx, expected: rx ? 'match' : 'site' })
      }
      const medDays = dd.map((x, i) => (x?.MEDS === 'Y' ? i : -1)).filter((i) => i >= 0)
      if (medDays.length) {
        const cm = forms.find((f) => f.form === 'CM' && f.values.CMSTDAT >= vd && f.values.CMSTDAT <= end)
        rows.push({ id: `meds|${subj}|${dose}`, subj, kind: 'meds', diary: `Dose ${dose}: medicine for fever or pain on day ${medDays.map((i) => i + 1).join(', ')}`, other: cm ? `${cm.values.CMTRT} for ${cm.values.CMINDC}, ${cm.values.CMSTDAT} to ${cm.values.CMENDAT || 'ongoing'}` : 'No medication starting in the diary period', matched: !!cm, expected: cm ? 'match' : 'site' })
      }
      const visit = dd.findIndex((x) => x?.MEDVISIT === 'Y')
      if (visit >= 0) {
        const ae = forms.find((f) => f.form === 'AE' && f.values.AEMAAE === 'Y' && f.values.AESTDAT >= vd && f.values.AESTDAT <= end)
        const rx = forms.find((f) => f.form === 'REACT' && f.values.CEMA === 'Y' && f.values.CEDOSE === String(dose))
        rows.push({ id: `medvisit|${subj}|${dose}`, subj, kind: 'medvisit', diary: `Dose ${dose}: saw a doctor or went to hospital for a reaction on day ${visit + 1}`, other: ae ? `AE "${ae.values.AETERM}" marked medically attended` : rx ? 'Continuing-reaction form marked medically attended' : 'No medically attended AE or reaction', matched: !!(ae || rx), expected: ae || rx ? 'match' : 'site' })
      }
      for (const ae of forms.filter((f) => f.form === 'AE' && f.values.AEMAAE !== 'Y' && f.values.AESTDAT >= vd && f.values.AESTDAT <= end && /fever|pyrexia|injection site/i.test(f.values.AETERM ?? ''))) {
        rows.push({ id: `dup|${subj}|${ae.inst}`, subj, kind: 'dup-ae', diary: `Dose ${dose}: diary collects ${ae.values.AETERM?.toLowerCase()} as a solicited reaction`, other: `Unsolicited AE "${ae.values.AETERM}" starting ${ae.values.AESTDAT}`, matched: false, expected: 'site' })
      }
    }
    const dev = ecrfDevice(p, subj)
    if (dev && dev !== s.devices[subj]) rows.push({ id: `device|${subj}`, subj, kind: 'device', diary: `Vendor links device ${s.devices[subj]} to ${subj}`, other: `eCRF records device ${dev}`, matched: false, expected: 'vendor' })
    for (const r of s.imm.filter((x) => x.subj === subj && x.reported <= p.clock)) {
      const f = forms.find((x) => x.form === 'IMM' && x.visit === r.visit)
      const tube = f?.values.ISREFID ?? '', dt = f?.values.ISDAT ?? ''
      if (tube === r.tube && dt === r.collected) continue
      rows.push({ id: `lab|${subj}|${r.visit}`, subj, kind: 'lab', diary: `Central lab: tube ${r.tube} collected ${r.collected} (${r.visit})`, other: f ? `eCRF: tube ${tube || 'blank'}, collected ${dt || 'blank'}` : 'No eCRF sample record', matched: false, expected: 'site' })
    }
  }
  return rows.sort((a, b) => a.subj.localeCompare(b.subj) || a.kind.localeCompare(b.kind))
}
export function markRecon(p: Project, id: string, v: 'match' | 'site' | 'vendor') {
  const u = me(p)
  if (!['dm', 'dmlead'].includes(u.role)) throw new Error('Data management reconciles the diary.')
  ;(p.vax ??= emptyVax()).recon[id] = v
  audit(p, u, 'diary.reconcile', id, undefined, v, v === 'match' ? 'Records agree' : v === 'site' ? 'Discrepancy for the site to resolve' : 'Discrepancy for the diary vendor')
}

// ---------- immunogenicity transfer ----------
export function immRows(p: Project) {
  const s = vaxSeed().vax
  return s.imm.filter((r) => r.reported <= p.clock).map((r) => {
    const fk = `${r.subj}|${r.visit}|IMM|1`
    const tube = value(p, `${fk}|ISREFID`), dt = value(p, `${fk}|ISDAT`)
    const flags: string[] = []
    if (r.comment) flags.push(r.comment)
    if (r.titre.startsWith('<')) flags.push('Below the lower limit of quantification (10): report as <10, not as 0 or 5')
    if (!p.forms[fk]) flags.push('No eCRF sample record yet')
    else if (tube !== r.tube) flags.push(`Tube on the eCRF is ${tube || 'blank'}`)
    else if (dt !== r.collected) flags.push(`eCRF collection date is ${dt || 'blank'}`)
    return { ...r, flags }
  })
}
export const missingSamples = (p: Project) => Object.keys(p.forms).filter((fk) => fk.endsWith('|IMM|1') && value(p, `${fk}|ISPERF`) === 'N' && !fk.includes('|D1|'))

export const gradeLabel = (code: string) => VAX_CODELISTS.GRADE.find((g) => g.value === code)?.label ?? code
