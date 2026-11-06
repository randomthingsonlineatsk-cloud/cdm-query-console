import { describe, expect, test } from 'vitest'
import { createProject, advance, sign, closeQuery, raiseManual, editValue, value } from '../src/domain/project'
import { startMission, scoreM11, scoreM12, certificate } from '../src/domain/missions'
import { prepareForLock, prepareLocked, checklist, privacyFindings, signCasebooks, recordAuditReview, confirmPrivacy, softLock, addHardSignature, requestUnlock, approveUnlock, createArchive, archiveFiles, randomised } from '../src/domain/lock'
import { codeTerm, approveCoding, expected, smd } from '../src/domain/coding'
import { sdvRequired, sdvState, verify, classify, expectedImportant } from '../src/domain/oversight'
import { ptOf } from '../src/domain/dictmed'
import { DRUGS } from '../src/domain/dictdrug'
import { CLOSE_OUT } from '../src/domain/seed'
import type { Project, Signature } from '../src/domain/types'

const sig = (p: Project, uid: string, pin: string, roles: Signature['role'][]) => sign(p, uid, pin, 'Approved', 'test', roles) as Signature
const as = (p: Project, uid: string) => { p.currentUserId = uid }
function finishCleaning(p: Project) {
  for (let i = 0; i < 4; i++) { advance(p, 6); as(p, 'arao'); for (const q of p.queries.filter((x) => x.status === 'answered')) closeQuery(p, q.id) }
  as(p, 'tibarra')
  for (const r of Object.values(p.coding).filter((x) => x.status === 'uncoded')) {
    const ind = value(p, r.key.replace('|CMTRT', '|CMINDC'))
    const e = expected(r.key.split('|')[2], r.verbatim, ind)!
    if (e.kind === 'drug') codeTerm(p, r.key, DRUGS.find((d) => d.generic && d.ingredients.join('+') === e.ingredient)!.id, e.atc)
    else if (e.kind === 'pt') codeTerm(p, r.key, [...smd(p).terms.values()].find((t) => t.level === 'LLT' && t.current && ptOf(smd(p), t.code)?.name === e.pt)!.code)
  }
  as(p, 'jweber'); approveCoding(p, Object.values(p.coding).filter((r) => r.status === 'coded').map((r) => r.key), sig(p, 'jweber', '2222', ['dmlead']))
  as(p, 'arao'); for (const d of p.deviations.filter((x) => x.status !== 'classified')) classify(p, d.id, expectedImportant(d) ?? false, 'Per the plan')
  as(p, 'mlind'); for (const fk of Object.keys(p.forms)) if (!p.forms[fk].deleted) for (const f of sdvRequired(p, fk)) if (sdvState(p, `${fk}|${f}`) !== 'verified') verify(p, `${fk}|${f}`)
}

describe('lock', () => {
  test('M11: from the prepared study to hard lock, archive, and writes blocked', () => {
    const p = createProject(); prepareForLock(p)
    const run = startMission(p, 'M11')
    expect(checklist(p).filter((c) => !c.ok).map((c) => c.id)).toEqual(expect.arrayContaining(['queries', 'coding', 'sdv', 'dv', 'pi', 'audit', 'privacy']))
    expect(privacyFindings(p)).toHaveLength(1)
    as(p, 'arao'); raiseManual(p, privacyFindings(p)[0].key, 'This comment appears to contain a name and phone number. Please remove the personal identifiers?')
    finishCleaning(p)
    expect(privacyFindings(p)).toHaveLength(0)
    as(p, 'mlind'); for (const fk of Object.keys(p.forms)) for (const f of sdvRequired(p, fk)) if (sdvState(p, `${fk}|${f}`) !== 'verified') verify(p, `${fk}|${f}`)
    as(p, 'arao'); confirmPrivacy(p, '')
    signCasebooks(p, sig(p, 'emarsh', '5555', ['pi']))
    recordAuditReview(p, 'Reviewed all value changes, deletions and failed signatures; every change has a reason.')
    const failing = checklist(p).filter((c) => !c.ok)
    expect(failing.map((c) => `${c.id}: ${c.evidence}`)).toEqual([])
    softLock(p, sig(p, 'jweber', '2222', ['dmlead']))
    as(p, 'pkulk')
    const k = Object.keys(p.items).find((x) => x.endsWith('|PULSE'))!
    expect(() => editValue(p, k, '99', 'x')).toThrow(/soft-locked/)
    addHardSignature(p, sig(p, 'jweber', '2222', ['dmlead']))
    expect(p.lock.status).toBe('soft')
    addHardSignature(p, sig(p, 'hokafor', '8888', ['sponsor']))
    expect(p.lock.status).toBe('hard')
    expect(() => editValue(p, k, '99', 'x')).toThrow(/hard-locked/)
    as(p, 'arao'); expect(() => raiseManual(p, k, 'x')).toThrow(/hard-locked/)
    const bytes = createArchive(p)
    expect(bytes[0]).toBe(0x50); expect(bytes[1]).toBe(0x4b)
    expect(archiveFiles(p).length).toBeGreaterThan(15)
    scoreM11(p, run)
    expect(run.score).toBe(100)
  })
  test('M12: unlock one subject, correct through a query, re-lock', () => {
    const p = createProject(); prepareLocked(p)
    expect(p.lock.status).toBe('hard')
    const run = startMission(p, 'M12')
    as(p, 'arao')
    expect(() => requestUnlock(p, 'short', ['105-007'])).toThrow()
    requestUnlock(p, `Close-out visit at site 105: a nosebleed for ${CLOSE_OUT.subj} in the source notes was never entered as an AE.`, [CLOSE_OUT.subj])
    approveUnlock(p, sig(p, 'jweber', '2222', ['dmlead']))
    approveUnlock(p, sig(p, 'hokafor', '8888', ['sponsor']))
    expect(p.lock.status).toBe('unlocked')
    expect(() => raiseManual(p, '101-001|SCR|VS|1|PULSE', 'x')).toThrow(/unlocked only/)
    raiseManual(p, `${CLOSE_OUT.subj}|LOG|AE|${CLOSE_OUT.inst}|AETERM`, 'The source notes record a nosebleed that is not entered as an adverse event. Please enter it or confirm why not?')
    advance(p, 8)
    const fk = `${CLOSE_OUT.subj}|LOG|AE|${CLOSE_OUT.inst}`
    expect(p.forms[fk]).toBeDefined()
    for (const q of p.queries.filter((x) => x.status === 'answered')) closeQuery(p, q.id)
    as(p, 'jweber'); approveCoding(p, Object.values(p.coding).filter((r) => r.status === 'coded').map((r) => r.key), sig(p, 'jweber', '2222', ['dmlead']))
    as(p, 'mlind'); for (const f of sdvRequired(p, fk)) verify(p, `${fk}|${f}`)
    signCasebooks(p, sig(p, 'emarsh', '5555', ['pi']), [CLOSE_OUT.subj])
    as(p, 'arao'); recordAuditReview(p, 'Reviewed the changes made under UL-1 for 105-007: one AE added through a query.')
    expect(checklist(p).filter((c) => !c.ok).map((c) => `${c.id}: ${c.evidence}`)).toEqual([])
    addHardSignature(p, sig(p, 'jweber', '2222', ['dmlead']))
    addHardSignature(p, sig(p, 'hokafor', '8888', ['sponsor']))
    expect(p.lock.status).toBe('hard')
    scoreM12(p, run)
    expect(run.score).toBe(100)
    expect(randomised(p).length).toBeGreaterThan(50)
  })
  test('certificate needs ten passes and gives a stable code', () => {
    const p = createProject()
    expect(certificate(p.missions, p.userId, 'A').eligible).toBe(false)
    for (const id of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']) p.missions.push({ id, startedUtc: '', userId: 'x', score: 80, passed: true })
    const a = certificate(p.missions, p.userId, 'Khan'), b = certificate(p.missions, p.userId, 'khan ')
    expect(a.eligible).toBe(true); expect(a.code).toBe(b.code); expect(a.code).toMatch(/^CDM-[0-9A-F]{5}-[0-9A-F]{5}$/)
  })
})
