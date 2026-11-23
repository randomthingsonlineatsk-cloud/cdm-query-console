// The hand-over to the SDTM Mapping Trainer: ONK-44-302 hard-locked by the prepared scenario, as a
// project file cut down to what that app's importer reads (forms, the current value of each item,
// the coded dictionary path of each term, the lock status). Written to its tests/fixtures when that repo is beside this one; its
// tests/onkcdm.test.mjs checks that these forms give back its raw datasets and reference SDTM.
import { expect, test } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createProject, createOnkProject } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { prepareLocked } from '../src/domain/lock'

test('ONK-44-302 locked project file for the SDTM Mapping Trainer', () => {
  const p = createOnkProject(); applyStudy(p)
  prepareLocked(p)
  expect(p.lock.status).toBe('hard')
  const items = Object.fromEntries(Object.entries(p.items).map(([k, it]) => [k, { versions: [{ value: it.versions.at(-1).value }] }]))
  const coding = Object.fromEntries(Object.entries(p.coding).map(([k, c]) => [k, { key: c.key, status: c.status, terms: c.terms }]))
  const forms = Object.fromEntries(Object.entries(p.forms).map(([k, f]) => [k, f.deleted ? { deleted: true } : {}]))
  const out = JSON.stringify({ format: 'cdm-query-console-project', version: 1, exportedUtc: '2026-12-01T00:00:00.000Z', note: 'ONK-44-302 hard-locked by the prepared scenario (tests/onkhandoff.test.mjs in the CDM Query & Edit-Check Console); only the parts the importer reads.', project: { study: p.study, name: 'ONK-44-302 locked (prepared scenario)', lock: { status: p.lock.status }, forms, items, coding } })
  const dir = '../sdtm-mapping-trainer/tests/fixtures'
  if (existsSync(dir)) { const f = `${dir}/onk-cdm-locked.json`; if (!existsSync(f) || readFileSync(f, 'utf8') !== out) writeFileSync(f, out) }
  applyStudy(createProject())
}, 120000)
