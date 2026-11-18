import { describe, expect, test } from 'vitest'
import text from './fixtures/HRP-301.consent-versions.json?raw'
import { createOstProject, createProject, raiseManual } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { readConsentVersions, previewConsent, applyConsent, latestApproved, versionCheck, commonApproved, defaultSiteMap, reconcile } from '../src/domain/consentVersions'
import { prepareMission, scoreM21, latestRun } from '../src/domain/missions'
import { runTest } from '../src/domain/engine'
import { OST_SITES } from '../src/domain/ost/study'

describe('consent versions from the Plain Language Lab', () => {
  test('reads the file, maps sites to committees by country, finds the version every committee approved', () => {
    const f = readConsentVersions(text)
    expect(f.study).toBe('HRP-301'); expect(latestApproved(f)).toBe('v3.0')
    const map = defaultSiteMap(f, OST_SITES)
    expect(map).toEqual({ '301': 'DE-EC', '302': 'US-IRB', '303': 'IN-IEC-PUNE', '304': 'CA-REB' })
    // The US IRB approved 2.0 and 3.0, Pune only 2.0: every committee approved 2.0.
    expect(commonApproved(f, map)).toBe('v2.0')
    expect(() => readConsentVersions('{"format":"other"}')).toThrow(/not a consent-versions file/)
  })
  test('IC-74 follows the version every committee approved, with its tests and an audit entry', () => {
    const p = createOstProject(); applyStudy(p)
    const f = readConsentVersions(text)
    expect(() => previewConsent(p, f, 'ALV-3-301')).toThrow(/this project runs ALV-3-301/)
    expect(previewConsent(p, f, 'HRP-301')).toMatchObject({ check: 'IC-74', from: 'v2.0', to: 'v2.0' })
    const n = p.audit.length
    applyConsent(p, f, 'HRP-301'); expect(p.audit.length).toBe(n); expect(p.consentSiteMap?.['303']).toBe('IN-IEC-PUNE')
    // Once Pune also approves 3.0, 3.0 is approved everywhere that has approvals.
    const g = structuredClone(f); g.versions.push({ ...g.versions.find((v) => v.committeeId === 'IN-IEC-PUNE')!, version: 'v3.0', approved: '2026-07-10' })
    for (const c of ['DE-EC', 'CA-REB']) g.versions.push({ ...g.versions[0], committeeId: c, committee: c, version: 'v3.0', approved: '2026-07-12' })
    for (const c of ['DE-EC', 'CA-REB']) g.versions.push({ ...g.versions[0], committeeId: c, committee: c, version: 'v2.0', approved: '2025-12-01' })
    applyConsent(p, g, 'HRP-301')
    const c = versionCheck(p)!
    expect(c.expr).toBe("present(ICVER) and ICVER != 'v3.0'"); expect(c.message).toContain('v3.0'); expect(c.message).not.toContain('v2.0')
    for (const t of c.tests) expect(runTest(c, t), t.name).toBe(t.fire)
    expect(c.tests.map((t) => t.name)).toEqual(['v2.0 fires', 'v3.0 passes'])
    expect(p.audit.length).toBe(n + 1)
  })
})

describe('M21 Reconcile consent versions by site', () => {
  const prep = () => prepareMission(createProject(), 'M21', createProject, { lock: () => {}, locked: () => {} })
  test('the prepared study holds four site-level findings, one of each kind that applies', () => {
    const p = prep()
    const rows = reconcile(p, p.consentVersions!, p.consentSiteMap!)
    expect(rows.length).toBeGreaterThanOrEqual(40)
    expect(rows.filter((r) => r.status !== 'ok').map((r) => `${r.subj}:${r.status}`)).toEqual(['302-001:before-approval', '303-010:superseded', '303-011:superseded', '303-012:superseded'])
    expect(rows.find((r) => r.subj === '303-009')!.status).toBe('ok') // exactly 30 days: still within the implementation period
    expect(JSON.parse(latestRun(p, 'M21')!.answers!.key)).toEqual(['302-001', '303-010', '303-011', '303-012'])
  })
  test('querying the four findings with clear text passes; a false query costs marks', () => {
    const p = prep(), run = latestRun(p, 'M21')!
    const rows = reconcile(p, p.consentVersions!, p.consentSiteMap!).filter((r) => r.status !== 'ok')
    for (const r of rows) raiseManual(p, r.key, `The consent form version recorded is ${r.version}, signed on ${r.signed}. The ethics committee for this site approved this version on a different date. Please confirm which version the participant signed and the signature date against the signed form.`)
    const q = structuredClone(p); scoreM21(q, latestRun(q, 'M21')!); expect(latestRun(q, 'M21')!.score).toBeGreaterThanOrEqual(85)
    raiseManual(p, reconcile(p, p.consentVersions!, p.consentSiteMap!).find((r) => r.status === 'ok')!.key, 'Please confirm the consent form version against the signed form.')
    scoreM21(p, run); expect(run.score).toBeLessThan(latestRun(q, 'M21')!.score!)
  })
})
