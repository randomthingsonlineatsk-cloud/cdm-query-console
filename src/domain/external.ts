// External data: vendor transfers checked against their data transfer agreements, loaded,
// and reconciled against the EDC. Three fictional vendors: a central laboratory, a central
// ECG reader and an IRT. Each transfer is cumulative and arrives monthly.

import type { Project, ReconDecision } from './types'
import { seedStudy, accession } from './seed'
import { formsOfSubject } from './engine'
import { audit, me, nowUtc, raiseManual } from './project'
import { addDays, hash, rng, daysBetween } from './util'
import { STUDY, ACTIVE, OST_ID } from './study'
import { isActive } from './queries'

export type VendorId = 'CL' | 'ECG' | 'IRT'
export interface Dta {
  vendor: VendorId; name: string; system: string; file: string; delimiter: string
  columns: string[]; required: string[]; prohibited: string[]; keys: string; frequency: string; cutoff: number
  rules: string[]
}
export const DTAS: Record<VendorId, Dta> = {
  CL: { vendor: 'CL', name: 'Northgate Central Laboratory (fictional)', system: 'central laboratory results', file: 'HLV204201_NGCL_YYYYMMDD.txt', delimiter: '|',
    columns: ['STUDYID', 'SITEID', 'SUBJID', 'VISIT', 'ACCSNUM', 'COLLDT', 'COLLTM', 'LBTESTCD', 'LBORRES', 'LBORRESU', 'LBORNRLO', 'LBORNRHI'],
    required: ['STUDYID', 'SUBJID', 'VISIT', 'ACCSNUM', 'COLLDT', 'LBTESTCD', 'LBORRES', 'LBORRESU'], prohibited: ['TRTARM', 'ARMCD', 'RANDNO'],
    keys: 'Accession number, then subject and visit', frequency: 'Monthly, cumulative, first Monday', cutoff: 7,
    rules: ['Results in SI units: glucose mmol/L, sodium mmol/L, HbA1c %.', 'Reference ranges from the central laboratory, sent with each result.', 'Unscheduled repeat samples (VISIT = UNS, for example after haemolysis) are sent but are not recorded in the EDC.', 'Data cut-off: samples received up to 7 days before the transfer date.', 'Pipe-delimited text, header row, one row per test.'] },
  ECG: { vendor: 'ECG', name: 'Corvia Cardiac Core Lab (fictional)', system: 'central ECG readings', file: 'HLV204201_CVECG_YYYYMMDD.txt', delimiter: '|',
    columns: ['STUDYID', 'SUBJID', 'VISIT', 'EGDTC', 'QTCF', 'EGINTP'], required: ['STUDYID', 'SUBJID', 'VISIT', 'EGDTC', 'QTCF'], prohibited: ['TRTARM', 'ARMCD'],
    keys: 'Subject and visit', frequency: 'Monthly, cumulative, first Monday', cutoff: 7,
    rules: ['EGDTC is the date the ECG was recorded at the site, not the date it was read.', 'Central QTcF is the analysis value; the site reading in the EDC is for safety.', 'Pipe-delimited text, header row.'] },
  IRT: { vendor: 'IRT', name: 'Randiq IRT (fictional)', system: 'randomisation and drug supply', file: 'HLV204201_RQIRT_YYYYMMDD.txt', delimiter: '|',
    columns: ['STUDYID', 'SUBJID', 'RANDDT', 'RANDNO', 'VISIT', 'KITNO', 'DISPDT'], required: ['STUDYID', 'SUBJID', 'RANDDT', 'RANDNO', 'VISIT', 'KITNO'], prohibited: ['TRTARM', 'ARMCD', 'ARM'],
    keys: 'Subject and visit', frequency: 'Monthly, cumulative, first Monday', cutoff: 7,
    rules: ['The treatment arm is never transferred to the blinded data management team.', 'Kit numbers as assigned by IRT, K followed by four digits.', 'Pipe-delimited text, header row.'] },
}
export const VENDOR_IDS: VendorId[] = ['CL', 'ECG', 'IRT']
const MONTHLY = ['2026-04-06', '2026-05-04', '2026-06-01', '2026-07-06', '2026-08-03', '2026-09-07', '2026-10-05', '2026-11-02', '2026-12-07']

// The vendors and transfer agreements of the open study. HRP-301 has a central laboratory
// (safety laboratory and HBV DNA monitoring) and an IRT, and no central ECG reading.
const HLV_DTAS = structuredClone(DTAS)
const OST_CL_RULES = ['Results in conventional units as agreed: ALT and AST U/L, neutrophils and lymphocytes 10^9/L, HBV DNA IU/mL.', 'HBV DNA is tested every 4 weeks (Weeks 4, 8, 12 and 16) only for participants anti-HBc positive at screening; below the lower limit of quantification (10 IU/mL) it is reported as UNDETECTABLE.', 'Reference ranges from the central laboratory, sent with each result.', 'Data cut-off: samples received up to 7 days before the transfer date.', 'Pipe-delimited text, header row, one row per test.']
export const SI_UNITS: Record<string, string> = { GLUC: 'mmol/L', SODIUM: 'mmol/L', HBA1C: '%', ALT: 'U/L', AST: 'U/L', NEUT: '10^9/L', LYMPH: '10^9/L', HBVDNA: 'IU/mL' }
export function applyVendors(study: string) {
  const ost = study === OST_ID
  VENDOR_IDS.splice(0, VENDOR_IDS.length, ...(ost ? ['CL', 'IRT'] as VendorId[] : ['CL', 'ECG', 'IRT'] as VendorId[]))
  for (const v of ['CL', 'ECG', 'IRT'] as VendorId[]) Object.assign(DTAS[v], structuredClone(HLV_DTAS[v]))
  if (ost) {
    DTAS.CL.file = 'HRP301_NGCL_YYYYMMDD.txt'; DTAS.CL.rules = OST_CL_RULES
    DTAS.IRT.file = 'HRP301_RQIRT_YYYYMMDD.txt'
    DTAS.IRT.rules = ['The treatment arm is never transferred to the blinded data management team.', 'Kit numbers as assigned by IRT, K followed by four digits; one bottle of 35 tablets per kit.', 'Pipe-delimited text, header row.']
  }
}

export interface Transfer { id: string; vendor: VendorId; date: string; file: string; declared: number; resendOf?: string }
export function transferLog(clock: string): Transfer[] {
  const out: Transfer[] = []
  for (const v of VENDOR_IDS) for (const d of MONTHLY) {
    const t: Transfer = { id: `${v}-${d}`, vendor: v, date: d, file: DTAS[v].file.replace('YYYYMMDD', d.replaceAll('-', '')), declared: 0 }
    out.push(t)
    const bad = (v === 'CL' && d === '2026-08-03') || (v === 'IRT' && d === '2026-07-06') || (v === 'ECG' && d === '2026-06-01')
    if (bad) { const d2 = addDays(d, 2); out.push({ id: `${v}-${d2}`, vendor: v, date: d2, file: DTAS[v].file.replace('YYYYMMDD', d2.replaceAll('-', '')), declared: 0, resendOf: t.id }) }
  }
  return out.filter((t) => t.date <= clock).sort((a, b) => a.date.localeCompare(b.date) || a.vendor.localeCompare(b.vendor))
}

const fixed = (p: Project, id: string, date: string) => { const f = p.ext.vendorFixes[id]; return !!f && f < date }

// Build a transfer file from the source truth, with the vendor's own planted problems.
export function transferFile(p: Project, t: Transfer): { text: string; declared: number } {
  const dta = DTAS[t.vendor]
  const seed = seedStudy()
  const cut = addDays(t.date, -dta.cutoff)
  const rows: string[][] = []
  const st = STUDY.protocol.replace(/-/g, '')
  if (t.vendor === 'CL') {
    for (const e of seed.entries.filter((x) => x.form === 'LBC' && x.truth.LBPERF === 'Y' && x.truth.LBDAT <= cut)) {
      const key = `${e.subj}|${e.visit}`
      if (key === '106-004|W4' && !fixed(p, 'CL:106-004|W4:missing-vendor', t.date)) continue
      const visit = key === '101-008|W4' && !fixed(p, `CL:${key}:visit`, t.date) ? 'W8' : e.visit
      const r = rng(parseInt(hash(e.truth.LBREFID).slice(-8), 16))
      if (ACTIVE.id === OST_ID) {
        if (key === '304-007|W8' && !fixed(p, 'CL:304-007|W8:missing-vendor', t.date)) continue
        const ost = (seed as { ost?: { hbcPositive: string[]; altHigh: { subj: string; visit: string; alt: number }[] } }).ost
        const hi = ost?.altHigh.find((x) => x.subj === e.subj && x.visit === e.visit)
        const row = (test: string, val: string, unit: string, lo: string, hiR: string) => rows.push([st, e.site, e.subj, visit, e.truth.LBREFID, e.truth.LBDAT, e.truth.LBTIM, test, val, unit, lo, hiR])
        const alt = hi ? hi.alt : Math.max(8, r.normal(22, 7))
        row('ALT', alt.toFixed(0), 'U/L', '7', '40')
        row('AST', (hi ? hi.alt * 0.7 : Math.max(10, r.normal(23, 6))).toFixed(0), 'U/L', '10', '40')
        row('NEUT', Math.max(1.6, r.normal(3.9, 1)).toFixed(1), '10^9/L', '1.8', '7.5')
        row('LYMPH', Math.max(0.8, r.normal(2.0, 0.5)).toFixed(1), '10^9/L', '1.0', '4.0')
        if (ost?.hbcPositive.includes(e.subj) && ['W4', 'W8', 'W12', 'W16'].includes(e.visit)) row('HBVDNA', 'UNDETECTABLE', 'IU/mL', '', '')
        continue
      }
      const mg = e.site === '105' && e.truth.LBDAT >= '2026-06-15' && t.date >= '2026-07-06' && !fixed(p, 'CL:units:105:GLUC', t.date)
      const g = r.normal(5.4, 0.6)
      rows.push([st, e.site, e.subj, visit, e.truth.LBREFID, e.truth.LBDAT, e.truth.LBTIM, 'GLUC', mg ? (g * 18.016).toFixed(0) : g.toFixed(1), mg ? 'mg/dL' : 'mmol/L', mg ? '70' : '3.9', mg ? '100' : '5.5'])
      rows.push([st, e.site, e.subj, visit, e.truth.LBREFID, e.truth.LBDAT, e.truth.LBTIM, 'SODIUM', r.normal(140, 2).toFixed(0), 'mmol/L', '135', '145'])
      rows.push([st, e.site, e.subj, visit, e.truth.LBREFID, e.truth.LBDAT, e.truth.LBTIM, 'HBA1C', r.normal(5.6, 0.4).toFixed(1), '%', '4.0', '6.0'])
    }
    // An unscheduled repeat for a screen failure, which the DTA says is not in the EDC.
    if (t.date >= '2026-05-04' && ACTIVE.id !== OST_ID) { const a = accession('104-008', 'UNS'); rows.push([st, '104', '104-008', 'UNS', a, '2026-04-02', '10:15', 'GLUC', '5.1', 'mmol/L', '3.9', '5.5']) }
  }
  if (t.vendor === 'ECG') {
    for (const e of seed.entries.filter((x) => x.form === 'EG' && x.truth.EGDAT <= cut)) {
      const key = `${e.subj}|${e.visit}`
      if (key === '105-007|SCR' && !fixed(p, `ECG:${key}:missing-vendor`, t.date)) continue
      const date = key === '101-002|W12' && !fixed(p, `ECG:${key}:date`, t.date) ? addDays(e.truth.EGDAT, 3) : e.truth.EGDAT
      rows.push([st, e.subj, e.visit, date, String(Number(e.truth.QTCF) + (parseInt(hash(key).slice(-2), 16) % 9) - 4), 'NORMAL'])
    }
  }
  if (t.vendor === 'IRT') {
    for (const e of seed.entries.filter((x) => x.form === 'EX' && x.truth.EXDISP === 'Y' && x.visitDate <= cut)) {
      const s = seed.subjects.find((x) => x.id === e.subj)!
      const key = `${e.subj}|${e.visit}`
      const kit = key === '106-002|W2' && !fixed(p, `IRT:${key}:kit`, t.date) ? `K${Number(e.truth.EXKIT.slice(1)) + 10}` : e.truth.EXKIT
      const row = [st, e.subj, s.d1!, `R${e.subj.replace('-', '')}`, e.visit, kit, e.visitDate]
      if (t.id === 'IRT-2026-07-06') row.push(s.arm)
      rows.push(row)
    }
  }
  let cols = dta.columns
  if (t.id === 'IRT-2026-07-06') cols = [...cols, 'TRTARM']
  const delim = t.id === 'ECG-2026-06-01' ? ',' : '|'
  const text = [cols.join(delim), ...rows.map((r) => r.join(delim))].join('\n')
  const declared = rows.length + (t.id === 'CL-2026-08-03' ? 42 : 0)
  return { text, declared }
}

export interface CheckResult { id: string; label: string; ok: boolean; detail: string }
export function conformance(p: Project, t: Transfer): { checks: CheckResult[]; rows: Record<string, string>[]; header: string[] } {
  const dta = DTAS[t.vendor]
  const { text, declared } = transferFile(p, t)
  const lines = text.split('\n')
  const delim = lines[0].includes('|') ? '|' : ','
  const header = lines[0].split(delim)
  const rows = lines.slice(1).map((l) => Object.fromEntries(l.split(delim).map((v, i) => [header[i], v])))
  const missingCols = dta.columns.filter((c) => !header.includes(c)), extra = header.filter((c) => !dta.columns.includes(c))
  const blinded = header.filter((c) => dta.prohibited.includes(c))
  const blanks = rows.filter((r) => dta.required.some((c) => !r[c])).length
  const badDates = rows.filter((r) => ['COLLDT', 'EGDTC', 'RANDDT', 'DISPDT'].some((c) => r[c] && !/^\d{4}-\d{2}-\d{2}$/.test(r[c]))).length
  const prev = transferLog(p.clock).filter((x) => x.vendor === t.vendor && x.date < t.date && p.ext.transfers[x.id]?.status === 'accepted').pop()
  const prevRows = prev ? transferFile(p, prev).text.split('\n').length - 1 : 0
  const namePattern = new RegExp('^' + dta.file.replace('YYYYMMDD', '\\d{8}').replace('.', '\\.') + '$')
  const checks: CheckResult[] = [
    { id: 'name', label: 'File name follows the DTA convention', ok: namePattern.test(t.file), detail: t.file },
    { id: 'delim', label: `Delimiter is "${dta.delimiter}"`, ok: delim === dta.delimiter, detail: `Found "${delim}"` },
    { id: 'header', label: 'Columns match the DTA, in order', ok: !missingCols.length && !extra.filter((c) => !dta.prohibited.includes(c)).length && header.slice(0, dta.columns.length).join() === dta.columns.join(), detail: missingCols.length || extra.length ? `Missing: ${missingCols.join(', ') || 'none'} · Extra: ${extra.join(', ') || 'none'}` : 'As agreed' },
    { id: 'blind', label: 'No unblinding fields', ok: !blinded.length, detail: blinded.length ? `Prohibited column present: ${blinded.join(', ')}` : 'None found' },
    { id: 'count', label: 'Record count matches the transfer log', ok: declared === rows.length, detail: `Log ${declared}, file ${rows.length}` },
    { id: 'required', label: 'Required fields populated', ok: blanks === 0, detail: `${blanks} rows with a blank required field` },
    { id: 'dates', label: 'Dates in ISO 8601 (YYYY-MM-DD)', ok: badDates === 0, detail: `${badDates} rows with another date format` },
    { id: 'cumulative', label: 'Cumulative: no fewer records than the last accepted transfer', ok: rows.length >= prevRows, detail: `${rows.length} now, ${prevRows} before` },
  ]
  return { checks, rows, header }
}
export const shouldAccept = (p: Project, t: Transfer) => conformance(p, t).checks.every((c) => c.ok)

const dmOnly = (p: Project) => { const u = me(p); if (u.role !== 'dm' && u.role !== 'dmlead') throw new Error('Data management loads and reconciles vendor data.'); return u }
export function decideTransfer(p: Project, t: Transfer, status: 'accepted' | 'rejected', reason: string) {
  const u = dmOnly(p)
  if (status === 'rejected' && !reason.trim()) throw new Error('Give the reason for rejecting the transfer, for the vendor and the file.')
  p.ext.transfers[t.id] = { status, reason: reason.trim(), userId: u.id, utc: nowUtc(p) }
  audit(p, u, `transfer.${status === 'accepted' ? 'load' : 'reject'}`, t.file, undefined, status, reason.trim() || 'Passed DTA checks; loaded')
}

// ---------- reconciliation ----------

export type ExtClass = 'edc' | 'vendor' | 'acceptable' | 'no-action'
export interface ExtDisc { id: string; vendor: VendorId; subj: string; visit: string; field: string; edc: string; vendorValue: string; expected: ExtClass; edcKey?: string; note?: string }

export const latestLoaded = (p: Project, v: VendorId) => transferLog(p.clock).filter((t) => t.vendor === v && p.ext.transfers[t.id]?.status === 'accepted').pop()

export function extDiscrepancies(p: Project, v: VendorId): ExtDisc[] {
  const t = latestLoaded(p, v); if (!t) return []
  const { rows } = conformance(p, t)
  const seed = seedStudy()
  const cut = addDays(t.date, -DTAS[v].cutoff)
  const out: ExtDisc[] = []
  const subjects = [...new Set(Object.keys(p.forms).map((k) => k.slice(0, 7)))]
  const edc = subjects.flatMap((s) => formsOfSubject(p, s))
  const enteredSeed = (subj: string, visit: string, form: string) => !!p.forms[`${subj}|${visit}|${form}|1`]
  if (v === 'CL') {
    const samples = new Map<string, Record<string, string>>()
    for (const r of rows) if (!samples.has(r.ACCSNUM)) samples.set(r.ACCSNUM, r)
    const used = new Set<string>()
    for (const f of edc.filter((x) => x.form === 'LBC' && x.values.LBPERF === 'Y' && (x.values.LBDAT || '9') <= cut)) {
      const k = `${f.subj}|${f.visit}`
      const r = samples.get(f.values.LBREFID) ?? [...samples.values()].find((x) => x.SUBJID === f.subj && x.VISIT === f.visit)
      const base = `CL:${k}`
      const key = (fld: string) => `${f.subj}|${f.visit}|LBC|1|${fld}`
      if (!r) { out.push({ id: `${base}:missing-vendor`, vendor: v, subj: f.subj, visit: f.visit, field: 'sample', edc: f.values.LBREFID, vendorValue: '', expected: 'vendor', edcKey: key('LBREFID'), note: 'EDC records a sample the central lab has not reported.' }); continue }
      used.add(r.ACCSNUM)
      const truth = seed.entries.find((e) => e.subj === f.subj && e.visit === f.visit && e.form === 'LBC')?.truth ?? {}
      const cmp = (fld: string, ev: string, vv: string, tv: string) => { if (ev !== vv) out.push({ id: `${base}:${fld}`, vendor: v, subj: f.subj, visit: f.visit, field: fld, edc: ev, vendorValue: vv, expected: ev !== tv ? 'edc' : 'vendor', edcKey: key({ accession: 'LBREFID', date: 'LBDAT', time: 'LBTIM', visit: 'LBREFID' }[fld]!) }) }
      cmp('accession', f.values.LBREFID, r.ACCSNUM, truth.LBREFID)
      cmp('visit', f.visit, r.VISIT, f.visit)
      cmp('date', f.values.LBDAT, r.COLLDT, truth.LBDAT)
      cmp('time', f.values.LBTIM, r.COLLTM, truth.LBTIM)
    }
    for (const r of samples.values()) {
      if (used.has(r.ACCSNUM)) continue
      const timing = seed.entries.some((e) => e.form === 'LBC' && e.subj === r.SUBJID && e.truth.LBREFID === r.ACCSNUM && !enteredSeed(e.subj, e.visit, 'LBC'))
      out.push({ id: `CL:${r.SUBJID}|${r.VISIT}:missing-edc:${r.ACCSNUM}`, vendor: v, subj: r.SUBJID, visit: r.VISIT, field: 'sample', edc: '', vendorValue: r.ACCSNUM, expected: r.VISIT === 'UNS' ? 'acceptable' : timing ? 'no-action' : 'edc', note: r.VISIT === 'UNS' ? 'Unscheduled repeat sample.' : timing ? 'The site has not entered this visit yet.' : 'A sample the EDC does not record.' })
    }
    // Units and reference ranges, per site and test.
    const groups = new Map<string, Record<string, string>[]>()
    for (const r of rows) { const g = `${r.SITEID}:${r.LBTESTCD}`; groups.set(g, [...(groups.get(g) ?? []), r]) }
    const SI = SI_UNITS
    for (const [g, rs] of groups) {
      const [site, test] = g.split(':')
      const off = rs.filter((r) => r.LBORRESU !== SI[test])
      if (off.length) out.push({ id: `CL:units:${site}:${test}`, vendor: v, subj: `site ${site}`, visit: `${off.length} results`, field: 'unit', edc: SI[test], vendorValue: [...new Set(off.map((r) => r.LBORRESU))].join(', '), expected: 'vendor', note: `${off.length} ${test} results from site ${site} in ${off[0].LBORRESU}; the DTA requires ${SI[test]}.` })
    }
  }
  if (v === 'ECG') {
    const byKey = new Map(rows.map((r) => [`${r.SUBJID}|${r.VISIT}`, r]))
    for (const f of edc.filter((x) => x.form === 'EG' && (x.values.EGDAT || '9') <= cut)) {
      const k = `${f.subj}|${f.visit}`, r = byKey.get(k)
      const truth = seed.entries.find((e) => e.subj === f.subj && e.visit === f.visit && e.form === 'EG')?.truth ?? {}
      if (!r) { out.push({ id: `ECG:${k}:missing-vendor`, vendor: v, subj: f.subj, visit: f.visit, field: 'ECG', edc: f.values.EGDAT, vendorValue: '', expected: 'vendor', edcKey: `${k}|EG|1|EGDAT`, note: 'ECG recorded at the site but no central reading.' }); continue }
      byKey.delete(k)
      if (r.EGDTC !== f.values.EGDAT) out.push({ id: `ECG:${k}:date`, vendor: v, subj: f.subj, visit: f.visit, field: 'date', edc: f.values.EGDAT, vendorValue: r.EGDTC, expected: f.values.EGDAT !== truth.EGDAT ? 'edc' : 'vendor', edcKey: `${k}|EG|1|EGDAT` })
    }
    for (const [k, r] of byKey) { const [s, vis] = k.split('|'); out.push({ id: `ECG:${k}:missing-edc`, vendor: v, subj: s, visit: vis, field: 'ECG', edc: '', vendorValue: r.EGDTC, expected: enteredSeed(s, vis, 'EG') ? 'edc' : 'no-action', note: 'Central reading with no ECG page in the EDC yet.' }) }
  }
  if (v === 'IRT') {
    const byKey = new Map(rows.map((r) => [`${r.SUBJID}|${r.VISIT}`, r]))
    for (const f of edc.filter((x) => x.form === 'EX' && x.values.EXDISP === 'Y')) {
      const k = `${f.subj}|${f.visit}`, r = byKey.get(k)
      const vd = edc.find((x) => x.subj === f.subj && x.visit === f.visit && x.form === 'SV')?.values.VISDAT ?? ''
      if (vd > cut) continue
      const truth = seed.entries.find((e) => e.subj === f.subj && e.visit === f.visit && e.form === 'EX')?.truth ?? {}
      if (!r) { out.push({ id: `IRT:${k}:missing-vendor`, vendor: v, subj: f.subj, visit: f.visit, field: 'dispensing', edc: f.values.EXKIT, vendorValue: '', expected: truth.EXDISP === 'Y' ? 'vendor' : 'edc', edcKey: `${k}|EX|1|EXDISP`, note: 'Kit dispensed in the EDC with no IRT transaction.' }); continue }
      byKey.delete(k)
      if (r.KITNO !== f.values.EXKIT) out.push({ id: `IRT:${k}:kit`, vendor: v, subj: f.subj, visit: f.visit, field: 'kit', edc: f.values.EXKIT, vendorValue: r.KITNO, expected: f.values.EXKIT !== truth.EXKIT ? 'edc' : 'vendor', edcKey: `${k}|EX|1|EXKIT` })
      if (f.visit === 'D1' && r.RANDDT !== vd) out.push({ id: `IRT:${k}:randdate`, vendor: v, subj: f.subj, visit: f.visit, field: 'randomisation date', edc: vd, vendorValue: r.RANDDT, expected: 'edc', edcKey: `${f.subj}|D1|SV|1|VISDAT` })
    }
    for (const [k, r] of byKey) { const [s, vis] = k.split('|'); out.push({ id: `IRT:${k}:missing-edc`, vendor: v, subj: s, visit: vis, field: 'dispensing', edc: '', vendorValue: r.KITNO, expected: enteredSeed(s, vis, 'EX') ? 'edc' : 'no-action', note: 'IRT dispensing with no EDC page yet.' }) }
  }
  return out
}

export function decideExt(p: Project, d: ExtDisc, cls: ExtClass, reason: string) {
  const u = dmOnly(p)
  const dec: ReconDecision = { cls, reason: reason.trim(), userId: u.id, utc: nowUtc(p) }
  if ((cls === 'acceptable' || cls === 'no-action') && !dec.reason) throw new Error('Give the reason no action is needed.')
  if (cls === 'edc') {
    if (!d.edcKey) throw new Error('There is no EDC record to query. Raise it with the site from the casebook, or class it differently.')
    const existing = p.queries.find((q) => q.key === d.edcKey && q.source === 'manual' && isActive(q))
    dec.queryId = existing?.id ?? raiseManual(p, d.edcKey, `Vendor reconciliation (${DTAS[d.vendor].system}): the EDC shows ${d.field} "${d.edc || 'blank'}", the vendor file shows "${d.vendorValue || 'blank'}". Please check the requisition or source and confirm which is correct.`, u).id
  }
  if (cls === 'vendor') { dec.noteDue = addDays(p.clock, 2); if (!dec.reason) dec.reason = 'Data clarification sent to the vendor' }
  p.ext.decisions[d.id] = dec
  audit(p, u, 'ext.decide', d.id, undefined, cls, dec.reason || `Query ${dec.queryId}`)
}
// The vendor fixes genuine vendor errors in its next transfer; it rejects a wrong request.
export function processVendors(p: Project) {
  for (const [id, dec] of Object.entries(p.ext.decisions)) {
    if (dec.cls !== 'vendor' || dec.done || !dec.noteDue || dec.noteDue > p.clock) continue
    dec.done = true
    const genuine = ['CL:304-007|W8:missing-vendor', 'CL:101-008|W4:visit', 'CL:106-004|W4:missing-vendor', 'CL:units:105:GLUC', 'ECG:105-007|SCR:missing-vendor', 'ECG:101-002|W12:date', 'IRT:106-002|W2:kit'].includes(id)
    if (genuine) { p.ext.vendorFixes[id] = p.clock; audit(p, { id: 'vendor', name: 'Vendor', role: 'system', pin: '', trained: true }, 'vendor.fix', id, undefined, 'corrected', 'Vendor confirmed and will correct in the next transfer', `${p.clock}T12:00:00Z`) }
    else dec.reply = 'Vendor: our record matches the requisition received. Please check the EDC.'
  }
}

export function addRule(p: Project, r: { vendor: string; test: string; from: string; to: string; factor: number; site?: string }) {
  const u = dmOnly(p)
  if (!(r.factor > 0)) throw new Error('The factor must be a positive number.')
  const rule = { ...r, id: `R${p.ext.rules.length + 1}`, userId: u.id, utc: nowUtc(p) }
  p.ext.rules.push(rule)
  audit(p, u, 'ext.rule', `${r.vendor} ${r.test}`, undefined, `${r.from} → ${r.to} ÷ ${r.factor}`, 'Unit conversion rule for standardised results')
}
// Standardised value for a central-lab row after the conversion rules.
export function standardise(p: Project, r: Record<string, string>) {
  const rule = p.ext.rules.find((x) => x.test === r.LBTESTCD && x.from === r.LBORRESU && (!x.site || x.site === r.SITEID))
  if (!rule) return { value: r.LBORRES, unit: r.LBORRESU, lo: r.LBORNRLO, hi: r.LBORNRHI, converted: false }
  const c = (x: string) => (Number(x) / rule.factor).toFixed(1)
  return { value: c(r.LBORRES), unit: rule.to, lo: c(r.LBORNRLO), hi: c(r.LBORNRHI), converted: true }
}
export const daysSince = (a: string, b: string) => daysBetween(a, b)

export function signExt(p: Project, s: import('./types').Signature) {
  const open = VENDOR_IDS.reduce((n, v) => n + extDiscrepancies(p, v).filter((d) => !p.ext.decisions[d.id]).length, 0)
  if (!VENDOR_IDS.every((v) => latestLoaded(p, v))) throw new Error('Load a transfer from every vendor first.')
  if (open) throw new Error(`${open} vendor discrepancies are not classed yet.`)
  p.ext.signoff = s
  audit(p, me(p), 'ext.signoff', 'Vendor reconciliation', undefined, 'signed', `Signed by ${s.userId}`, s.utc)
}
