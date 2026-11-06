import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '../state'
import { sign } from '../domain/project'
import type { Role, Signature } from '../domain/types'
import { ROLE_LABEL } from '../domain/types'

export function Panel({ title, sub, right, children, className }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-lab-line bg-lab-panel/80 p-4 space-y-3', className)}>
      {(title || right) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-mono text-sm text-lab-text">{title}</h2>}
            {sub && <p className="text-xs text-lab-text-muted mt-0.5">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

const TONE = {
  blue: 'border-lab-fda/60 text-lab-fda bg-lab-fda-soft',
  green: 'border-lab-cdsco/60 text-lab-cdsco bg-lab-cdsco-soft',
  amber: 'border-lab-amber/60 text-lab-amber bg-lab-amber-soft',
  red: 'border-lab-red/60 text-lab-red bg-lab-red-soft',
  purple: 'border-lab-ema/60 text-lab-ema bg-lab-ema-soft',
  grey: 'border-lab-line text-lab-text-muted bg-lab-panel-strong',
}
export type Tone = keyof typeof TONE
export function Pill({ tone = 'grey', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide whitespace-nowrap', TONE[tone], className)}>{children}</span>
}

export function Btn({ tone = 'blue', className, ...props }: React.ComponentProps<'button'> & { tone?: Tone | 'solid' }) {
  const t = tone === 'solid' ? 'bg-lab-fda text-lab-bg border-lab-fda hover:bg-lab-fda/90' : cn(TONE[tone], 'hover:brightness-125')
  return <button {...props} className={cn('inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition disabled:opacity-40 disabled:pointer-events-none', t, className)} />
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-lab-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn('px-3 py-1.5 font-mono text-xs border-b-2 -mb-px transition', value === t.id ? 'border-lab-fda text-lab-fda' : 'border-transparent text-lab-text-muted hover:text-lab-text')}>{t.label}</button>
      ))}
    </div>
  )
}

export const inputCls = 'w-full rounded-md border border-lab-line bg-lab-panel-strong px-2 py-1.5 text-sm text-lab-text placeholder:text-lab-text-muted/70 focus:outline-none focus:ring-2 focus:ring-lab-fda/50'
export function TextArea(props: React.ComponentProps<'textarea'>) { return <textarea {...props} className={cn(inputCls, 'min-h-20 font-sans', props.className)} /> }
export function Select({ options, ...props }: React.ComponentProps<'select'> & { options: { value: string; label: string }[] }) {
  return <select {...props} className={cn(inputCls, props.className)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
}

export function Table({ head, rows, empty = 'Nothing to show.', className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded border border-lab-line', className)}>
      <table className="w-full text-xs">
        <thead className="bg-lab-panel-strong text-lab-text-muted font-mono text-[10px] uppercase"><tr>{head.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-normal whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-2 py-3 text-lab-text-muted">{empty}</td></tr>}
          {rows.map((r, i) => <tr key={i} className="border-t border-lab-line/70 align-top hover:bg-lab-panel-strong/50">{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-lab-text">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={cn('w-full rounded-lg border border-lab-line bg-lab-panel p-4 space-y-3 max-h-[90vh] overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-mono text-sm text-lab-text">{title}</h2><button aria-label="Close" className="text-lab-text-muted hover:text-lab-text px-2" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}

// Two-part electronic signature (21 CFR 11.200(a)(1)): user ID and PIN, with the meaning shown.
export function SignBox({ meaning, what, roles, onSigned, label = 'Sign' }: { meaning: string; what: string; roles: Role[]; onSigned: (s: Signature) => void; label?: string }) {
  const { p, act } = useStore()
  const [uid, setUid] = useState(p.users.find((u) => roles.includes(u.role))?.id ?? '')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="rounded border border-lab-ema/50 bg-lab-ema-soft/40 p-3 space-y-2">
      <p className="text-xs text-lab-text"><span className="font-mono text-lab-ema">Electronic signature</span> · Meaning: <b>{meaning}</b> · Needs: {roles.map((r) => ROLE_LABEL[r]).join(' or ')}</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="User ID" className={cn(inputCls, 'w-36 font-mono')} value={uid} onChange={(e) => setUid(e.target.value)} placeholder="User ID" />
        <input aria-label="PIN" className={cn(inputCls, 'w-28 font-mono')} type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
        <Btn tone="purple" onClick={() => act((pp) => { const r = sign(pp, uid.trim(), pin, meaning, what, roles); if (typeof r === 'string') { setErr(r); return } setErr(''); setPin(''); onSigned(r) })}>{label}</Btn>
      </div>
      {err && <p className="text-xs text-lab-red">{err}</p>}
      <p className="text-[10px] text-lab-text-muted">Practice PINs are listed under Project → Users. In a real system a PIN is never shown or shared.</p>
    </div>
  )
}
export function SigLine({ s }: { s?: Signature }) {
  if (!s) return <Pill tone="amber">Not signed</Pill>
  return <span className="text-xs text-lab-cdsco font-mono">✓ {s.meaning} · {s.userId} ({s.role}) · {s.utc.replace('T', ' ').slice(0, 16)} UTC</span>
}

export const fmtUtc = (u?: string) => (u ? u.replace('T', ' ').slice(0, 16) : '')
export function Stat({ label, value, tone = 'grey' }: { label: string; value: React.ReactNode; tone?: Tone }) {
  const color = { blue: 'text-lab-fda', green: 'text-lab-cdsco', amber: 'text-lab-amber', red: 'text-lab-red', purple: 'text-lab-ema', grey: 'text-lab-text' }[tone]
  return <div className="rounded border border-lab-line bg-lab-panel-strong/60 px-3 py-2"><p className="font-mono text-[10px] uppercase text-lab-text-muted">{label}</p><p className={cn('font-mono text-lg', color)}>{value}</p></div>
}
export const ic = (extra: string) => cn(inputCls, extra)
