// Total bilirubin in HRP-301's central laboratory transfer, and the same results added to the
// locked HRP-301 database the SDTM Mapping Trainer ships (its final central laboratory transfer),
// when that repo is beside this one. Each sample's other results are unchanged.
import { expect, test } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createOstProject } from '../src/domain/project'
import { applyStudy } from '../src/domain/build'
import { seedStudy } from '../src/domain/seed'
import { transferFile, transferLog, ostBilirubinFor } from '../src/domain/external'
import { rng, hash } from '../src/domain/util'

test('the transfer carries total bilirubin; the SDTM Trainer’s locked data get the same values', () => {
  const p = createOstProject(); applyStudy(p)
  const t = transferLog('2026-12-31').filter((x) => x.vendor === 'CL').at(-1)
  const lines = transferFile(p, t).text.split('\n'), head = lines[0].split('|'), rows = lines.slice(1).map((l) => Object.fromEntries(l.split('|').map((v, i) => [head[i], v])))
  const bili = rows.filter((r) => r[head[7]] === 'BILI')
  expect(bili.length).toBeGreaterThan(200)
  const ost = seedStudy().ost
  const F = '../sdtm-mapping-trainer/src/data/hrp301.json'
  if (!existsSync(F)) return
  const d = JSON.parse(readFileSync(F, 'utf8'))
  const cl = d.cl.filter((r) => r.LBTESTCD !== 'BILI')
  // The replayed random stream gives back the ALT of every sample, so the bilirubin is the one the transfer sends.
  const samples = [...new Map(cl.map((r) => [r.ACCSNUM, r])).values()]
  let checked = 0
  for (const s of samples) {
    const hi = ost.altHigh.some((x) => x.subj === s.SUBJID && x.visit === s.VISIT)
    if (!hi) { const r = rng(parseInt(hash(s.ACCSNUM).slice(-8), 16)); const alt = cl.find((x) => x.ACCSNUM === s.ACCSNUM && x.LBTESTCD === 'ALT'); if (alt) { expect(Math.max(8, r.normal(22, 7)).toFixed(0)).toBe(alt.LBORRES); checked++ } }
  }
  expect(checked).toBeGreaterThan(200)
  const out = []
  for (const r of cl) {
    out.push(r)
    if (r.LBTESTCD === 'LYMPH') {
      const hi = ost.altHigh.some((x) => x.subj === r.SUBJID && x.visit === r.VISIT)
      out.push({ ...r, LBTESTCD: 'BILI', LBORRES: ostBilirubinFor(r.ACCSNUM, hi), LBORRESU: 'umol/L', LBORNRLO: '3', LBORNRHI: '21' })
    }
  }
  d.cl = out
  writeFileSync(F, JSON.stringify(d))
})
