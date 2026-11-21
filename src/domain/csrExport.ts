// "For the CSR": what the clinical study report needs from data management once the database is
// locked. The CSR & Narrative Studio reads it for section 10.2 (important protocol deviations by
// category) and for the narratives (the reconciled safety case of each SAE, and whether the
// clinical and safety databases agree).
import type { Project } from './types'
import { STUDY } from './study'
import { safetyDb, pairs, discrepancies, statusOf, FIELD_LABEL, type SafetyCase } from './safety'

export const CSR_EXPORT_FORMAT = 'cdm-console/csr-export'
export interface CsrExport {
  format: typeof CSR_EXPORT_FORMAT; version: 1; exportedUtc: string
  study: { id: string; protocol: string }
  lock: { status: string; hardLockUtc: string | null; dataCutoff: string }
  deviations: { category: string; important: boolean; count: number; subjects: string[] }[]
  sae: {
    cutoff: string | null; signedDm: boolean; signedSafety: boolean
    cases: (SafetyCase & { usubjid: string })[]
    reconciliation: { usubjid: string; term: string; caseId: string | null; status: 'agrees' | 'accepted difference' | 'open' | 'not in the safety database' | 'not in the clinical database'; notes: string[] }[]
  }
}
const usub = (subj: string) => `${STUDY.protocol}-${subj}`

export function csrExport(p: Project, now = new Date()): CsrExport {
  const devs = new Map<string, { category: string; important: boolean; subjects: Set<string>; count: number }>()
  for (const d of p.deviations.filter((x) => x.status === 'classified')) {
    const k = `${d.category}|${!!d.important}`
    const e = devs.get(k) ?? { category: d.category, important: !!d.important, subjects: new Set<string>(), count: 0 }
    e.count++; e.subjects.add(usub(d.subj)); devs.set(k, e)
  }
  const ds = discrepancies(p)
  const recon = pairs(p).map((x) => {
    const mine = ds.filter((d) => d.pair.id === x.id), open = mine.filter((d) => statusOf(p, d) === 'open' || statusOf(p, d) === 'pending')
    const status = !x.sc ? 'not in the safety database' as const : !x.edc ? 'not in the clinical database' as const : open.length ? 'open' as const : mine.some((d) => statusOf(p, d) === 'accepted') ? 'accepted difference' as const : 'agrees' as const
    const notes = mine.map((d) => `${d.field in FIELD_LABEL ? FIELD_LABEL[d.field as keyof typeof FIELD_LABEL] : d.field}: clinical “${d.edc || 'blank'}”, safety “${d.safety || 'blank'}” (${statusOf(p, d)})`)
    return { usubjid: usub(x.edc?.subj ?? x.sc!.subj), term: x.edc?.pt ?? x.edc?.term ?? x.sc!.term, caseId: x.sc?.caseId ?? null, status, notes }
  })
  const hard = p.lock.events.filter((e) => /hard/i.test(e.action)).at(-1)
  return {
    format: CSR_EXPORT_FORMAT, version: 1, exportedUtc: now.toISOString(),
    study: { id: STUDY.protocol, protocol: STUDY.protocol },
    lock: { status: p.lock.status, hardLockUtc: p.lock.status === 'hard' ? hard?.utc ?? null : null, dataCutoff: p.clock },
    deviations: [...devs.values()].map((d) => ({ category: d.category, important: d.important, count: d.count, subjects: [...d.subjects].sort() })).sort((a, b) => Number(b.important) - Number(a.important) || a.category.localeCompare(b.category)),
    sae: { cutoff: p.sae.cutoff ?? null, signedDm: !!p.sae.signoffDm, signedSafety: !!p.sae.signoffSafety, cases: safetyDb(p).map((c) => ({ ...c, edcForm: undefined, usubjid: usub(c.subj) })), reconciliation: recon },
  }
}
