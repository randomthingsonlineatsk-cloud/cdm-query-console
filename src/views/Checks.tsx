import { useMemo, useState } from 'react'
import { useStore } from '../state'
import { CATEGORY_LABEL, SHIPPED_CHECKS, CTX_FNS } from '../domain/checks'
import { VAX_CHECKS } from '../domain/vax/checks'
import { runTest, fieldsOfForm } from '../domain/engine'
import { validate } from '../domain/expr'
import { audit, me, nowUtc, runChecks, allSubjects } from '../domain/project'
import { latestRun } from '../domain/missions'
import { FORMS } from '../domain/study'
import type { Check, CheckCategory } from '../domain/types'
import { Panel, Pill, Btn, Table, Select, TextArea, SignBox, SigLine, Stat } from './ui'

export default function Checks() {
  const { p, act } = useStore()
  const m2 = latestRun(p, 'M2')
  const scope: string[] | null = m2 && m2.score === undefined && m2.answers?.scope ? JSON.parse(m2.answers.scope) : null
  const [cat, setCat] = useState<CheckCategory | 'all' | 'release'>(scope ? 'release' : 'all')
  const [sel, setSel] = useState<string>(p.checks[0].id)
  const results = useMemo(() => {
    const last = new Map<string, boolean>()
    for (const r of p.startup.uat) last.set(`${r.checkId}#${r.test}`, r.actual === r.expected)
    return last
  }, [p, p.startup.uat.length])
  const total = p.checks.reduce((n, c) => n + c.tests.length, 0)
  const run = p.checks.reduce((n, c) => n + c.tests.filter((t) => results.has(`${c.id}#${t.name}`)).length, 0)
  const failing = p.checks.reduce((n, c) => n + c.tests.filter((t) => results.get(`${c.id}#${t.name}`) === false).length, 0)
  const list = p.checks.filter((c) => cat === 'all' || (cat === 'release' ? !!scope?.includes(c.id) : c.category === cat))
  const c = p.checks.find((x) => x.id === sel)!
  const runAll = () => act((pp) => {
    const u = me(pp), utc = nowUtc(pp)
    for (const ch of pp.checks) for (const t of ch.tests) pp.startup.uat.push({ checkId: ch.id, test: t.name, expected: t.fire, actual: runTest(ch, t), utc, userId: u.id })
    audit(pp, u, 'uat.run', 'All checks', undefined, `${total} test cases`, 'UAT execution')
  })
  return (
    <div className="space-y-4">
      <Panel title="Data validation specification and UAT" sub={`${p.checks.length} programmed checks. Each fires as a query to the site, an automatic derivation, or a task for the coder. Test cases run in a sandbox, never on live data.`} right={<SigLine s={p.startup.uatSigned} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Checks" value={p.checks.length} />
          <Stat label="Test cases" value={total} />
          <Stat label="Executed" value={`${run}/${total}`} tone="blue" />
          <Stat label="Failing" value={failing} tone={failing ? 'red' : 'green'} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Btn tone="solid" onClick={runAll}>Run all test cases</Btn>
          <Select aria-label="Category" className="w-56" value={cat} onChange={(e) => setCat(e.target.value as CheckCategory | 'all' | 'release')} options={[...(scope ? [{ value: 'release', label: 'Release under test (12)' }] : []), { value: 'all', label: 'All categories' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
        </div>
      </Panel>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
        <Panel title="Checks" className="lg:max-h-[70vh] lg:overflow-y-auto">
          <Table head={['ID', 'Check', 'Form', 'Action', 'UAT']} rows={list.map((x) => {
            const rs = x.tests.map((t) => results.get(`${x.id}#${t.name}`))
            const st = rs.some((r) => r === false) ? <Pill tone="red">Fail</Pill> : rs.every((r) => r === true) ? <Pill tone="green">Pass</Pill> : <Pill>Not run</Pill>
            return [<button className={`font-mono ${sel === x.id ? 'text-lab-fda' : ''}`} onClick={() => setSel(x.id)}>{x.id}</button>, <button className="text-left" onClick={() => setSel(x.id)}>{x.title}</button>, x.form, <Pill tone={x.action === 'query' ? 'amber' : x.action === 'autofix' ? 'green' : 'purple'}>{x.action === 'autofix' ? 'auto-fix' : x.action === 'coder' ? 'coder task' : 'query'}</Pill>, st]
          })} />
        </Panel>
        <CheckDetail key={c.id} c={c} results={results} />
      </div>
      {!p.startup.uatSigned && (
        <Panel title="UAT summary" sub="Sign when every test case has been executed and passes. The data manager who tested signs; the signature is in the audit trail.">
          {run === total && failing === 0
            ? <SignBox meaning="UAT passed: tested and approved for production" what="UAT summary" roles={['dm', 'dmlead']} onSigned={(s) => act((pp) => { pp.startup.uatSigned = s })} label="Sign UAT summary" />
            : <p className="text-xs text-lab-amber">{run < total ? `${total - run} test cases not executed yet.` : `${failing} test cases fail. Correct the logic and re-run.`}</p>}
        </Panel>
      )}
    </div>
  )
}

function CheckDetail({ c, results }: { c: Check; results: Map<string, boolean> }) {
  const { p, act } = useStore()
  const [expr, setExpr] = useState(c.expr)
  const [msg, setMsg] = useState(c.message)
  const fields = fieldsOfForm(c.form)
  const err = validate(expr, fields, CTX_FNS)
  const shipped = SHIPPED_CHECKS.find((x) => x.id === c.id) ?? VAX_CHECKS.find((x) => x.id === c.id) ?? c
  const locked = !!p.startup.uatSigned && p.live
  const save = () => act((pp) => {
    if (err) throw new Error(err)
    const ch = pp.checks.find((x) => x.id === c.id)!
    const old = ch.expr
    ch.expr = expr; ch.message = msg
    audit(pp, me(pp), 'check.edit', c.id, old, expr, 'Logic corrected after UAT finding')
  })
  const reset = () => { setExpr(shipped.expr); setMsg(shipped.message); act((pp) => { const ch = pp.checks.find((x) => x.id === c.id)!; audit(pp, me(pp), 'check.reset', c.id, ch.expr, shipped.expr, 'Reset to the delivered version'); ch.expr = shipped.expr; ch.message = shipped.message }) }
  const runOne = () => act((pp) => {
    const u = me(pp), utc = nowUtc(pp), ch = pp.checks.find((x) => x.id === c.id)!
    for (const t of ch.tests) pp.startup.uat.push({ checkId: ch.id, test: t.name, expected: t.fire, actual: runTest(ch, t), utc, userId: u.id })
    audit(pp, u, 'uat.run', c.id, undefined, `${ch.tests.length} test cases`, 'UAT execution')
  })
  return (
    <Panel title={`${c.id} · ${c.title}`} sub={`${CATEGORY_LABEL[c.category]} · form ${FORMS[c.form].name} · target ${c.field}${c.visits ? ` · visits ${c.visits.join(', ')}` : ' · all visits'}`}>
      <label className="block text-xs text-lab-text-muted">Logic (fires when true)</label>
      <TextArea aria-label="Check logic" className="font-mono text-xs min-h-16" value={expr} disabled={locked} onChange={(e) => setExpr(e.target.value)} />
      {err ? <p className="text-xs text-lab-red">{err}</p> : <p className="text-[11px] text-lab-text-muted">Fields: {fields.join(', ')}. Functions: {CTX_FNS.map((f) => f + '()').join(', ')}, plus present, isblank, any, days, year, abs, round, len, contains, pattern, isdate, in (…).</p>}
      <label className="block text-xs text-lab-text-muted">{c.action === 'coder' ? 'Coder task text' : c.action === 'autofix' ? 'Derivation note' : 'Query text sent to the site'}</label>
      <TextArea aria-label="Message" className="text-xs min-h-14" value={msg} disabled={locked} onChange={(e) => setMsg(e.target.value)} />
      {c.fix && <p className="text-xs"><span className="text-lab-text-muted">Derivation:</span> <code className="text-lab-cdsco">{c.fix}</code></p>}
      <div className="flex flex-wrap gap-2">
        <Btn tone="solid" disabled={locked || !!err || (expr === c.expr && msg === c.message)} onClick={save}>Save change</Btn>
        <Btn tone="blue" onClick={runOne}>Run this check’s tests</Btn>
        <Btn tone="grey" disabled={locked} onClick={reset}>Reset to delivered</Btn>
        {p.live && <Btn tone="grey" onClick={() => act((pp) => runChecks(pp, allSubjects().filter((s) => Object.keys(pp.forms).some((k) => k.startsWith(s)))))}>Re-run on live data</Btn>}
      </div>
      {locked && <p className="text-[11px] text-lab-amber">The DVS is signed and the study is live. In practice a change now needs a change request, impact assessment and new UAT (Phase 2 adds this).</p>}
      <Table head={['Test case', 'Fields', 'Context', 'Expected', 'Last result']} rows={c.tests.map((t) => {
        const r = results.get(`${c.id}#${t.name}`)
        return [t.name, <code className="text-[10px]">{Object.entries(t.values).map(([k, v]) => `${k}=${v || '∅'}`).join(' ')}</code>, <code className="text-[10px] text-lab-text-muted">{Object.entries(t.ctx ?? {}).map(([k, v]) => `${k}=${v || '∅'}`).join(' ')}</code>, t.fire ? 'fires' : 'no fire', r === undefined ? <Pill>Not run</Pill> : r ? <Pill tone="green">Pass</Pill> : <Pill tone="red">Fail</Pill>]
      })} />
    </Panel>
  )
}
