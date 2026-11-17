import { describe, expect, test } from 'vitest'
import text from './fixtures/HRP-301.consent-versions.json?raw'
import { createOstProject } from '../src/domain/project'
import { readConsentVersions, previewConsent, applyConsent, latestApproved, versionCheck } from '../src/domain/consentVersions'
import { runTest } from '../src/domain/engine'

describe('consent versions from the Plain Language Lab', () => {
  test('reads the file and finds the latest approved English consent', () => {
    const f = readConsentVersions(text)
    expect(f.study).toBe('HRP-301'); expect(latestApproved(f)).toBe('v3.0')
    expect(() => readConsentVersions('{"format":"other"}')).toThrow(/not a consent-versions file/)
  })
  test('IC-74 follows the latest approved version, with its tests and an audit entry', () => {
    const p = createOstProject(), f = readConsentVersions(text)
    expect(() => previewConsent(p, f, 'ALV-3-301')).toThrow(/this project runs ALV-3-301/)
    const pr = previewConsent(p, f, 'HRP-301')
    expect(pr).toMatchObject({ check: 'IC-74', from: 'v2.0', to: 'v3.0' })
    const n = p.audit.length
    applyConsent(p, f, 'HRP-301')
    const c = versionCheck(p)!
    expect(c.expr).toBe("present(ICVER) and ICVER != 'v3.0'"); expect(c.message).toContain('v3.0'); expect(c.message).not.toContain('v2.0')
    for (const t of c.tests) expect(runTest(c, t), t.name).toBe(t.fire)
    expect(c.tests.map((t) => t.name)).toEqual(['v2.0 fires', 'v3.0 passes'])
    expect(p.audit.length).toBe(n + 1); expect(p.consentVersions?.versions).toHaveLength(3)
    // A second import changes nothing more.
    applyConsent(p, f, 'HRP-301'); expect(p.audit.length).toBe(n + 1)
  })
})
