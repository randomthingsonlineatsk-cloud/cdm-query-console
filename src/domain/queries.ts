// Query writing rules, ageing and metrics. The rules follow common CDM practice: a query
// names the data point, states what was seen, asks rather than tells, never suggests the
// answer, stays neutral, and is short enough to read at a glance.

import type { Project, Query } from './types'
import { daysBetween, median } from './util'
import { SITES } from './study'

export interface QualityRule { id: string; label: string; points: number; ok: boolean }
const LEADING = /\b(change (it )?to|should be|correct (it )?to|please (enter|update|amend|change)|must be|is wrong|is incorrect|replace with|set (it )?to)\b/i
const ASK = /\?|please (verify|confirm|clarify|review|check)|can you confirm|could you (confirm|check|verify)/i
const BLAME = /\b(careless|mistake|you failed|again\b|sloppy|obviously|clearly wrong)\b|!!/i
const ALLOWED_CAPS = new Set(['QTCF', 'SDTM', 'CDASH', 'ECG', 'IMP', 'ALCOA', 'MEDDRA', 'WHODRUG', 'EDC', 'SAE', 'YYYY-MM-DD', 'DIABP', 'SYSBP'])

export function scoreQuery(text: string, mention: string[] = []): { score: number; rules: QualityRule[] } {
  const t = text.trim()
  const caps = (t.match(/\b[A-Z]{5,}\b/g) ?? []).filter((w) => !ALLOWED_CAPS.has(w))
  const named = mention.length ? mention.some((m) => t.toLowerCase().includes(m.toLowerCase())) : /[a-z]{4,}/i.test(t)
  const rules: QualityRule[] = [
    { id: 'names', label: 'Names the data point', points: 20, ok: named },
    { id: 'states', label: 'States the value or discrepancy seen', points: 20, ok: /\d/.test(t) || /\b(blank|missing|not recorded|empty|no value)\b/i.test(t) },
    { id: 'asks', label: 'Asks the site to verify, confirm or clarify', points: 20, ok: ASK.test(t) },
    { id: 'neutral', label: 'Does not suggest or dictate the answer', points: 25, ok: !LEADING.test(t) },
    { id: 'tone', label: 'Neutral, professional tone (no blame, no shouting)', points: 10, ok: !BLAME.test(t) && caps.length === 0 },
    { id: 'length', label: 'Concise: 25 to 300 characters', points: 5, ok: t.length >= 25 && t.length <= 300 },
  ]
  return { score: rules.reduce((s, r) => s + (r.ok ? r.points : 0), 0), rules }
}

export const BUCKETS = [
  { id: '0-7', label: '0 to 7 days', lo: 0, hi: 7 },
  { id: '8-14', label: '8 to 14 days', lo: 8, hi: 14 },
  { id: '15-30', label: '15 to 30 days', lo: 15, hi: 30 },
  { id: '31-60', label: '31 to 60 days', lo: 31, hi: 60 },
  { id: '60+', label: 'Over 60 days', lo: 61, hi: Infinity },
]
export const ageOf = (q: Query, today: string) => daysBetween(q.raisedUtc.slice(0, 10), (q.closedUtc ?? today).slice(0, 10))
export const bucketOf = (age: number) => BUCKETS.find((b) => age >= b.lo && age <= b.hi)!.id
export const siteOf = (key: string) => key.slice(0, 3)
export const isActive = (q: Query) => q.status === 'open' || q.status === 'answered'

export interface SiteMetrics {
  site: string; open: number; answered: number; closed: number; cancelled: number
  buckets: Record<string, number>; medianDaysToClose: number; requeryRate: number
  autoShare: number; perHundred: number; dataPoints: number; entryLag: number
}
export function metrics(p: Project): SiteMetrics[] {
  const dp: Record<string, number> = {}
  for (const k of Object.keys(p.items)) dp[siteOf(k)] = (dp[siteOf(k)] ?? 0) + 1
  const lags: Record<string, number[]> = {}
  for (const f of Object.values(p.forms)) if (f.visitDate && f.key.split('|')[2] === 'SV') (lags[siteOf(f.key)] ??= []).push(daysBetween(f.visitDate, f.enteredUtc.slice(0, 10)))
  return SITES.map((s) => {
    const qs = p.queries.filter((q) => siteOf(q.key) === s.id)
    const buckets = Object.fromEntries(BUCKETS.map((b) => [b.id, 0]))
    for (const q of qs) if (isActive(q)) buckets[bucketOf(ageOf(q, p.clock))]++
    const closed = qs.filter((q) => q.status === 'closed')
    return {
      site: s.id,
      open: qs.filter((q) => q.status === 'open').length,
      answered: qs.filter((q) => q.status === 'answered').length,
      closed: closed.length,
      cancelled: qs.filter((q) => q.status === 'cancelled').length,
      buckets,
      medianDaysToClose: median(closed.map((q) => ageOf(q, p.clock))),
      requeryRate: qs.length ? qs.filter((q) => q.requeries > 0).length / qs.length : 0,
      autoShare: qs.length ? qs.filter((q) => q.source === 'auto').length / qs.length : 0,
      perHundred: dp[s.id] ? (qs.length / dp[s.id]) * 100 : 0,
      dataPoints: dp[s.id] ?? 0,
      entryLag: median(lags[s.id] ?? []),
    }
  })
}
