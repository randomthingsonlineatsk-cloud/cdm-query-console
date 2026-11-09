import { describe, test, expect } from 'vitest'
import { certificate, MISSIONS, CERT_NEEDED } from '../src/domain/missions'
import { passportRecord, sealOf } from '../src/domain/passport'
import { hash } from '../src/domain/util'
import type { MissionRun } from '../src/domain/types'

describe('Skills Passport record', () => {
  test('the code is recomputable from the basis and the seal covers every field', () => {
    const runs = MISSIONS.slice(0, CERT_NEEDED).map((m, i) => ({ id: m.id, passed: true, score: 80 + i } as unknown as MissionRun))
    const c = certificate(runs, 'u-123', 'Asha Rao')
    expect(c.eligible).toBe(true)
    const h = hash(c.basis).slice(-10).toUpperCase()
    expect(c.code).toBe(`CDM-${h.slice(0, 5)}-${h.slice(5)}`)
    const r = passportRecord({ app: 'cdm-query-console', appName: 'CDM Query & Edit-Check Console', certificate: 'Certificate of completion', appUrl: 'x', name: 'Asha Rao', userId: 'u-123', issued: '2026-11-09', basis: c.basis, code: c.code, criteria: [{ label: 'ten missions', met: true }], distinction: false })
    expect(r.seal).toBe(sealOf(r))
    expect(sealOf({ ...r, issued: '2026-11-10' })).not.toBe(r.seal)
  })
})
