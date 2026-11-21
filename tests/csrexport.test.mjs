// The export for the CSR, from a locked HRP-301; written into the CSR & Narrative Studio as its
// bundled data-management file when that repo is beside this one.
import { describe, expect, test } from 'vitest'
import { createProject, createOstProject } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { prepareLocked } from '../src/domain/lock'
import { csrExport } from '../src/domain/csrExport'

describe('export for the CSR', () => {
  test('a locked HRP-301: deviations by category, four SAEs reconciled', async () => {
    const p = createOstProject(); applyStudy(p)
    prepareLocked(p)
    const x = csrExport(p, new Date('2026-11-01T00:00:00Z'))
    expect(x.lock.status).toBe('hard')
    expect(x.study.id).toBe('HRP-301')
    expect(x.sae.reconciliation.map((r) => r.usubjid).sort()).toEqual(['HRP-301-301-007', 'HRP-301-302-002', 'HRP-301-303-006', 'HRP-301-304-003'])
    expect(x.deviations.length).toBeGreaterThan(0)
    const fs = await import('node:fs')
    const out = '../csr-narrative-studio/src/data/cdm-hrp-301.json'
    if (fs.existsSync('../csr-narrative-studio/src/data')) fs.writeFileSync(out, JSON.stringify(x, null, 1) + '\n')
    applyStudy(createProject())
  }, 900000)
})
