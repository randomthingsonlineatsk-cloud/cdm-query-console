// Skills Passport record: a small JSON file that carries the certificate to the Regulatory Skills
// Passport on the pharmolecule hub. It holds the exact text the verification code was made from
// (the basis), the code, the criteria and a seal (a hash of everything else in the record). The
// Passport recomputes both, so an edited name, score or date shows as not verified. Anyone can
// recompute these hashes: it shows a record is unchanged, not who earned it.
// Keep in step with pharmolecule/passport.html (schema 1) and the other apps' passport files.
import { hash } from './util'

export const PASSPORT_KIND = 'pharmolecule/passport-record' as const
export const PASSPORT_SCHEMA = 1
export const PASSPORT_PAGE = 'https://randomthingsonlineatsk-cloud.github.io/pharmolecule/passport.html'
const NOTICE = 'Portfolio certificate from a training app. Not an accreditation.'

export interface PassportFields { app: string; appName: string; certificate: string; appUrl: string; name: string; userId: string; issued: string; basis: string; code: string; criteria: { label: string; met: boolean }[]; distinction: boolean; endorsements?: string[] }
export type PassportRecord = PassportFields & { kind: typeof PASSPORT_KIND; schema: number; alg: 'cyrb53'; notice: string; seal: string }

export function sealOf(rec: object): string { const { seal: _s, ...rest } = rec as Record<string, unknown>; return hash(JSON.stringify(rest)) }
export function passportRecord(fields: PassportFields): PassportRecord {
  const rec = { kind: PASSPORT_KIND, schema: PASSPORT_SCHEMA, ...fields, alg: 'cyrb53' as const, notice: NOTICE }
  return { ...rec, seal: sealOf(rec) }
}
export function downloadRecord(file: string, rec: PassportRecord) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
