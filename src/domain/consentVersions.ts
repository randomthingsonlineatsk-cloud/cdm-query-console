// Consent versions from the Plain Language Lab: the consent form versions each ethics committee
// approved, and when. Importing them does two things:
//  1. The superseded-version check (IC-04, IC-54 or IC-74) is pointed at the newest version that
//     every mapped committee has approved: a version older than that is wrong at every site.
//  2. A site-level reconciliation compares each participant's signed version and date with the
//     approvals of the committee for that participant's site: a version that committee never
//     approved, a form signed before its approval, or a superseded version signed more than
//     IMPLEMENTATION_DAYS after the newer version was approved there.
import type { Project } from './types'
import { parseKey, itemKey } from './types'
import { audit, me } from './project'
import { SITES } from './study'

export interface ConsentVersionsFile {
  format: 'plain-language-lab/consent-versions'; schema: 1; exportedUtc: string; study: string
  committees?: { id: string; name: string; country: string; sites: string[] }[]
  versions: { document: string; language: string; version: string; committeeId?: string; committee: string; country?: string; sites: string[]; approved: string }[]
  inUse: { site: string; document: string; language: string; version: string; from: string }[]
}
export type SiteMap = Record<string, string> // console site id → committee id
export const IMPLEMENTATION_DAYS = 30

const num = (v: string) => v.replace(/^v/, '').split('.').map(Number)
export const cmpVersion = (a: string, b: string) => { const x = num(a), y = num(b); return x[0] - y[0] || (x[1] ?? 0) - (y[1] ?? 0) }
const norm = (c: string) => c.replace(/^the /i, '').trim().toLowerCase()
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

export function readConsentVersions(text: string): ConsentVersionsFile {
  let x: ConsentVersionsFile
  try { x = JSON.parse(text) } catch { throw new Error('This file is not JSON.') }
  if (x?.format !== 'plain-language-lab/consent-versions') throw new Error('This is not a consent-versions file from the Plain Language Lab (Versions and ethics → Download the consent versions for the CDM Console).')
  if (!Array.isArray(x.versions) || !Array.isArray(x.inUse)) throw new Error('The file has no versions list.')
  // Files from before committees were exported: one committee per name.
  x.committees ??= [...new Set(x.versions.map((v) => v.committee))].map((name) => { const v = x.versions.find((y) => y.committee === name)!; return { id: v.committeeId ?? name, name, country: v.country ?? '', sites: v.sites } })
  for (const v of x.versions) { v.committeeId ??= x.committees.find((c) => c.name === v.committee)?.id ?? v.committee; v.country ??= x.committees.find((c) => c.id === v.committeeId)?.country ?? '' }
  return x
}

/** English adult consent approvals of one committee, oldest version first. */
export const approvalsOf = (f: ConsentVersionsFile, committeeId: string) =>
  f.versions.filter((v) => v.document === 'consent' && v.language === 'en' && v.committeeId === committeeId).sort((a, b) => cmpVersion(a.version, b.version))

/** The newest version anywhere (kept for the summary). */
export function latestApproved(f: ConsentVersionsFile): string | null {
  return f.versions.filter((a) => a.document === 'consent' && a.language === 'en').map((a) => a.version).sort(cmpVersion).at(-1) ?? null
}

/** Each console site → the committee in the same country (the first, where a country has several). */
export function defaultSiteMap(f: ConsentVersionsFile, sites = SITES): SiteMap {
  const m: SiteMap = {}
  for (const s of sites) { const c = f.committees!.find((x) => norm(x.country) === norm(s.country)); if (c) m[s.id] = c.id }
  return m
}

/** The newest version every mapped committee with an approval has approved. */
export function commonApproved(f: ConsentVersionsFile, map: SiteMap): string | null {
  const coms = [...new Set(Object.values(map))].filter((c) => approvalsOf(f, c).length)
  if (!coms.length) return null
  const sets = coms.map((c) => new Set(approvalsOf(f, c).map((a) => a.version)))
  return [...sets[0]].filter((v) => sets.every((s) => s.has(v))).sort(cmpVersion).at(-1) ?? null
}

const RE = /ICVER != '(v[\d.]+)'/
export const versionCheck = (p: Project) => p.checks.find((c) => c.form === 'IC' && c.field === 'ICVER' && RE.test(c.expr))

export interface ConsentRow { subj: string; site: string; committee: string; version: string; signed: string; status: 'ok' | 'not-approved' | 'before-approval' | 'superseded' | 'no-committee'; why: string; key: string }

const current = (p: Project, subj: string, field: string) => p.items[itemKey(subj, 'SCR', 'IC', 1, field)]?.versions.at(-1)?.value ?? ''

/** One row per participant with a consent page: their version and date against their site's approvals. */
export function reconcile(p: Project, f: ConsentVersionsFile, map: SiteMap): ConsentRow[] {
  const subjects = [...new Set(Object.values(p.items).map((it) => parseKey(it.key)).filter((k) => k.form === 'IC' && k.visit === 'SCR' && k.field === 'ICVER').map((k) => k.subj))].sort()
  return subjects.map((subj) => {
    const site = subj.split('-')[0], committee = map[site] ?? '', version = current(p, subj, 'ICVER'), signed = current(p, subj, 'DSSTDAT')
    const key = itemKey(subj, 'SCR', 'IC', 1, 'ICVER')
    const row = (status: ConsentRow['status'], why: string): ConsentRow => ({ subj, site, committee, version, signed, status, why, key })
    if (!committee) return row('no-committee', 'No ethics committee is mapped to this site.')
    const ap = approvalsOf(f, committee), mine = ap.find((a) => a.version === version)
    const cname = f.committees!.find((c) => c.id === committee)?.name ?? committee
    if (!mine) return row('not-approved', `${version} was never approved by ${cname}.`)
    if (signed && signed < mine.approved) return row('before-approval', `Signed on ${signed}, before ${cname} approved ${version} on ${mine.approved}.`)
    const newer = ap.filter((a) => cmpVersion(a.version, version) > 0 && signed && days(a.approved, signed) > IMPLEMENTATION_DAYS)
    if (newer.length) { const n = newer.at(-1)!; return row('superseded', `Signed ${version} on ${signed}, ${days(n.approved, signed)} days after ${cname} approved ${n.version} on ${n.approved} (allowed: ${IMPLEMENTATION_DAYS} days to bring it in).`) }
    return row('ok', `${version} approved by ${cname} on ${mine.approved}.`)
  })
}

/** What the import would do: the check, its current and new versions, and how many recorded versions the check would flag. */
export function previewConsent(p: Project, f: ConsentVersionsFile, study: string, map = defaultSiteMap(f)) {
  if (f.study !== study) throw new Error(`The file is for ${f.study}; this project runs ${study}.`)
  const to = commonApproved(f, map)
  if (!to) throw new Error('No English adult consent version has been approved by the mapped committees yet. Record an ethics approval in the Plain Language Lab first.')
  const c = versionCheck(p)
  if (!c) throw new Error('This project has no superseded-version check on IC.ICVER.')
  const from = RE.exec(c.expr)![1]
  const flagged = Object.values(p.items).filter((it) => parseKey(it.key).field === 'ICVER').map((it) => it.versions.at(-1)?.value ?? '').filter((v) => v && v !== to).length
  const rows = reconcile(p, f, map)
  return { check: c.id, from, to, flagged, siteFindings: rows.filter((r) => r.status !== 'ok').length }
}

/** Apply: store the file and the site map, then point the check at the version every committee approved. */
export function applyConsent(p: Project, f: ConsentVersionsFile, study: string, map = defaultSiteMap(f)) {
  const r = previewConsent(p, f, study, map), c = versionCheck(p)!
  p.consentVersions = f; p.consentSiteMap = map
  if (r.from !== r.to) {
    c.expr = c.expr.replace(RE, `ICVER != '${r.to}'`)
    c.message = c.message.split(r.from).join(r.to)
    c.tests = [...c.tests.filter((t) => !t.values?.ICVER), { name: `${r.from} fires`, values: { ICVER: r.from }, fire: true }, { name: `${r.to} passes`, values: { ICVER: r.to }, fire: false }]
    audit(p, me(p), 'check.edit', c.id, `ICVER != '${r.from}'`, `ICVER != '${r.to}'`, `Version approved by every ethics committee, from the Plain Language Lab (file exported ${f.exportedUtc.slice(0, 10)})`)
  }
  return r
}
