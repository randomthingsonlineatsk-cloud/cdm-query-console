// Consent versions from the Plain Language Lab: the approved consent form versions per
// ethics committee and the version each site uses. Importing them points the superseded-
// version check (IC-04, IC-54 or IC-74) at the latest approved English adult consent form.
import type { Project } from './types'
import { parseKey } from './types'
import { audit, me } from './project'

export interface ConsentVersionsFile {
  format: 'plain-language-lab/consent-versions'; schema: 1; exportedUtc: string; study: string
  versions: { document: string; language: string; version: string; committee: string; sites: string[]; approved: string }[]
  inUse: { site: string; document: string; language: string; version: string; from: string }[]
}

const num = (v: string) => v.replace(/^v/, '').split('.').map(Number)
const cmp = (a: string, b: string) => { const x = num(a), y = num(b); return x[0] - y[0] || (x[1] ?? 0) - (y[1] ?? 0) }

export function readConsentVersions(text: string): ConsentVersionsFile {
  let x: ConsentVersionsFile
  try { x = JSON.parse(text) } catch { throw new Error('This file is not JSON.') }
  if (x?.format !== 'plain-language-lab/consent-versions') throw new Error('This is not a consent-versions file from the Plain Language Lab (Versions and ethics → Download the consent versions for the CDM Console).')
  if (!Array.isArray(x.versions) || !Array.isArray(x.inUse)) throw new Error('The file has no versions list.')
  return x
}

/** The latest approved version of the English adult consent form, if any. */
export function latestApproved(f: ConsentVersionsFile): string | null {
  const v = f.versions.filter((a) => a.document === 'consent' && a.language === 'en').map((a) => a.version).sort(cmp)
  return v.at(-1) ?? null
}

const RE = /ICVER != '(v[\d.]+)'/
export const versionCheck = (p: Project) => p.checks.find((c) => c.form === 'IC' && c.field === 'ICVER' && RE.test(c.expr))

/** What the import would do: the check, its current and new versions, and how many recorded versions the check would flag. */
export function previewConsent(p: Project, f: ConsentVersionsFile, study: string) {
  if (f.study !== study) throw new Error(`The file is for ${f.study}; this project runs ${study}.`)
  const to = latestApproved(f)
  if (!to) throw new Error('No English adult consent version has been approved yet. Record an ethics approval in the Plain Language Lab first.')
  const c = versionCheck(p)
  if (!c) throw new Error('This project has no superseded-version check on IC.ICVER.')
  const from = RE.exec(c.expr)![1]
  const flagged = Object.values(p.items).filter((it) => parseKey(it.key).field === 'ICVER').map((it) => it.versions.at(-1)?.value ?? '').filter((v) => v && v !== to).length
  return { check: c.id, from, to, flagged }
}

/** Apply: store the file, then point the check at the latest approved version (older versions fire). */
export function applyConsent(p: Project, f: ConsentVersionsFile, study: string) {
  const r = previewConsent(p, f, study), c = versionCheck(p)!
  p.consentVersions = f
  if (r.from !== r.to) {
    c.expr = c.expr.replace(RE, `ICVER != '${r.to}'`)
    c.message = c.message.split(r.from).join(r.to)
    c.tests = [...c.tests.filter((t) => !t.values?.ICVER), { name: `${r.from} fires`, values: { ICVER: r.from }, fire: true }, { name: `${r.to} passes`, values: { ICVER: r.to }, fire: false }]
    audit(p, me(p), 'check.edit', c.id, `ICVER != '${r.from}'`, `ICVER != '${r.to}'`, `Latest approved consent version from the Plain Language Lab (file exported ${f.exportedUtc.slice(0, 10)})`)
  }
  return r
}
