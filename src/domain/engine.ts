// Runs edit checks against the casebook. Builds the evaluation context for one form instance:
// its own fields as variables, plus functions that read the rest of the subject's casebook.

import { parse, evaluate, truth, type Ctx, type Val, type Node } from './expr'
import type { Check, CheckTest, Project } from './types'
import { VISITS, FORMS } from './study'

export interface FormData { subj: string; visit: string; form: string; inst: number; values: Record<string, string>; deleted?: boolean }

// All form instances of one subject with their current values (deleted instances excluded unless asked).
export function formsOfSubject(p: Project, subj: string, withDeleted = false): FormData[] {
  const pre = subj + '|'
  const byKey = new Map<string, FormData>()
  for (const [fk, fs] of Object.entries(p.forms)) {
    if (!fk.startsWith(pre) || (fs.deleted && !withDeleted)) continue
    const [, visit, form, inst] = fk.split('|')
    byKey.set(fk, { subj, visit, form, inst: Number(inst), values: {}, deleted: fs.deleted })
  }
  for (const [k, item] of Object.entries(p.items)) {
    if (!k.startsWith(pre)) continue
    const i = k.lastIndexOf('|')
    const fd = byKey.get(k.slice(0, i))
    if (fd) fd.values[k.slice(i + 1)] = item.versions[item.versions.length - 1].value
  }
  return [...byKey.values()]
}

function subjectFns(forms: FormData[], visit: string, today: string): Record<string, (...a: Val[]) => Val> {
  const get = (v: string, f: string, field: string) => forms.find((x) => x.visit === v && x.form === f && x.inst === 1)?.values[field] ?? ''
  const visdat = (v: string) => (get(v, 'SV', 'VISOCCUR') === 'Y' ? get(v, 'SV', 'VISDAT') : '')
  const eosForm = () => forms.find((x) => x.form === 'EOS')
  const aes = () => forms.filter((x) => x.form === 'AE')
  const win = VISITS.find((v) => v.id === visit)
  return {
    consent: () => forms.find((x) => x.form === 'IC' && x.inst === 1)?.values.DSSTDAT ?? '',
    rand: () => visdat('D1'),
    visdat: (v) => visdat(String(v)),
    val: (v, f, field) => get(String(v), String(f), String(field)),
    vis: () => visit,
    today: () => today,
    winlo: () => win?.lo ?? '',
    winhi: () => win?.hi ?? '',
    prevvisdat: () => {
      const i = VISITS.findIndex((v) => v.id === visit)
      for (let j = i - 1; j >= 0; j--) { const d = visdat(VISITS[j].id); if (d) return d }
      return ''
    },
    prevdisp: (field) => {
      const i = VISITS.findIndex((v) => v.id === visit)
      for (let j = i - 1; j >= 0; j--) if (get(VISITS[j].id, 'EX', 'EXDISP') === 'Y') return get(VISITS[j].id, 'EX', String(field))
      return ''
    },
    prevdispdat: () => {
      const i = VISITS.findIndex((v) => v.id === visit)
      for (let j = i - 1; j >= 0; j--) if (get(VISITS[j].id, 'EX', 'EXDISP') === 'Y') return visdat(VISITS[j].id)
      return ''
    },
    lastvisdat: () => VISITS.map((v) => visdat(v.id)).filter(Boolean).sort().pop() ?? '',
    eos: () => eosForm()?.values.DSDECOD ?? '',
    eosdat: () => eosForm()?.values.EOSDAT ?? '',
    aecount: (field, value) => aes().filter((a) => String(a.values[String(field)] ?? '').toUpperCase() === String(value).toUpperCase()).length,
    aematch: (text) => aes().filter((a) => String(a.values.AETERM ?? '').toUpperCase().includes(String(text).toUpperCase())).length,
  }
}

// Test context for UAT: fields from the test, functions from the test's ctx map.
export function testCtx(t: CheckTest): Ctx {
  const m = t.ctx ?? {}
  const g = (k: string) => m[k] ?? ''
  return {
    get: (n) => (Object.hasOwn(t.values, n) ? t.values[n] : ''),
    fn: {
      consent: () => g('consent'), rand: () => g('rand'), vis: () => g('vis') || 'W4', today: () => g('today') || '2026-06-01',
      visdat: (v) => g(`visdat:${v}`), val: (v, f, x) => g(`val:${v}|${f}|${x}`),
      winlo: () => g('winlo'), winhi: () => g('winhi'), prevvisdat: () => g('prevvisdat'), lastvisdat: () => g('lastvisdat'), prevdisp: (f) => g(`prevdisp:${f}`), prevdispdat: () => g('prevdispdat'),
      eos: () => g('eos'), eosdat: () => g('eosdat'),
      aecount: (f, v) => Number(g(`aecount:${f}|${v}`) || 0), aematch: (x) => Number(g(`aematch:${x}`) || 0),
    },
  }
}

const parsed = new Map<string, Node | Error>()
export function compile(src: string): Node | Error {
  let n = parsed.get(src)
  if (!n) { try { n = parse(src) } catch (e) { n = e as Error } parsed.set(src, n) }
  return n
}
export function fires(check: Check, ctx: Ctx): boolean | 'error' {
  const n = compile(check.expr)
  if (n instanceof Error) return 'error'
  try { return truth(evaluate(n, ctx)) } catch { return 'error' }
}
export function runTest(check: Check, t: CheckTest) { return fires(check, testCtx(t)) }

export interface Firing { checkId: string; key: string; text: string; action: Check['action']; fixValue?: string }

export function interpolate(msg: string, values: Record<string, string>, fns: Record<string, (...a: Val[]) => Val>, visit: string): string {
  return msg.replace(/\{([^}]+)\}/g, (_, k: string) => {
    if (k.startsWith('val:')) { const [v, f, x] = k.slice(4).split('|'); return String(fns.val(v, f, x) || 'blank') }
    if (k === 'visdat') return String(fns.visdat(visit) || 'blank')
    if (k === 'studyday') { const r = String(fns.rand()), d = values.VISDAT; return r && d ? String(Math.round((Date.parse(d) - Date.parse(r)) / 86400000) + 1) : '?' }
    if (k === 'winlo' || k === 'winhi' || k === 'eos') return String(fns[k]() || 'blank')
    return values[k] === undefined || values[k] === '' ? 'blank' : values[k]
  })
}

// Checks that still run on a visit recorded as not done (they exist to catch exactly that).
const RUNS_ON_MISSED = new Set(['EX-03'])

export function runChecksOnSubject(p: Project, subj: string, checks = p.checks): Firing[] {
  const forms = formsOfSubject(p, subj)
  const out: Firing[] = []
  for (const fd of forms) {
    const missed = fd.form !== 'SV' && fd.visit !== 'LOG' && forms.find((x) => x.visit === fd.visit && x.form === 'SV')?.values.VISOCCUR === 'N'
    const fns = subjectFns(forms, fd.visit, p.clock)
    const ctx: Ctx = { get: (n) => (Object.hasOwn(fd.values, n) ? fd.values[n] : ''), fn: fns }
    for (const ch of checks) {
      if (!ch.active || ch.form !== fd.form) continue
      if (ch.visits && !ch.visits.includes(fd.visit)) continue
      if (missed && !RUNS_ON_MISSED.has(ch.id)) continue
      if (fires(ch, ctx) !== true) continue
      const key = `${fd.subj}|${fd.visit}|${fd.form}|${fd.inst}|${ch.field}`
      const f: Firing = { checkId: ch.id, key, action: ch.action, text: interpolate(ch.message, fd.values, fns, fd.visit) }
      if (ch.action === 'autofix' && ch.fix) {
        const n = compile(ch.fix)
        if (!(n instanceof Error)) { try { const v = evaluate(n, ctx); f.fixValue = v === '' || v === null ? '' : String(v) } catch { /* leave unset */ } }
      }
      out.push(f)
    }
  }
  return out
}

export const fieldsOfForm = (form: string) => FORMS[form].fields.map((f) => f.id)
