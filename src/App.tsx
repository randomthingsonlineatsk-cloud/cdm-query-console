import { createContext, useContext, useState } from 'react'
import { StoreProvider, useStore } from './state'
import { ROLE_LABEL } from './domain/types'
import { advance, me, audit } from './domain/project'
import { isActive } from './domain/queries'
import { STUDY } from './domain/study'
import { Btn, Pill, Select } from './views/ui'
import Overview from './views/Overview'
import Startup from './views/Startup'
import Casebook from './views/Casebook'
import Checks from './views/Checks'
import Listings from './views/Listings'
import Queries from './views/Queries'
import Missions from './views/Missions'
import AuditView from './views/Audit'
import ProjectView from './views/ProjectView'

export type View = 'overview' | 'startup' | 'casebook' | 'checks' | 'listings' | 'queries' | 'missions' | 'audit' | 'project'
interface Nav { view: View; arg?: string; go: (v: View, arg?: string) => void }
const NavCtx = createContext<Nav>({ view: 'overview', go: () => {} })
export const useNav = () => useContext(NavCtx)

const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Study' }, { id: 'startup', label: 'Start-up' }, { id: 'casebook', label: 'Casebook' },
  { id: 'checks', label: 'Edit checks' }, { id: 'listings', label: 'Listings' }, { id: 'queries', label: 'Queries' },
  { id: 'missions', label: 'Missions' }, { id: 'audit', label: 'Audit trail' }, { id: 'project', label: 'Project' },
]

function Shell() {
  const { p, act, error, setError, saved } = useStore()
  const [nav, setNav] = useState<{ view: View; arg?: string }>({ view: 'overview' })
  const go = (view: View, arg?: string) => { setNav({ view, arg }); window.scrollTo({ top: 0 }) }
  const u = me(p)
  const open = p.queries.filter((q) => q.status === 'open').length
  const answered = p.queries.filter((q) => q.status === 'answered').length
  const V = { overview: Overview, startup: Startup, casebook: Casebook, checks: Checks, listings: Listings, queries: Queries, missions: Missions, audit: AuditView, project: ProjectView }[nav.view]
  return (
    <NavCtx.Provider value={{ ...nav, go }}>
      <div className="min-h-screen bg-lab-bg text-lab-text flex flex-col">
        <header className="border-b border-lab-line bg-lab-panel/90 sticky top-0 z-40 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="mr-auto">
              <p className="font-mono text-sm text-lab-fda">CDM Query &amp; Edit-Check Console</p>
              <p className="text-[11px] text-lab-text-muted">{STUDY.protocol} · {STUDY.drug} · fictional study for training</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-lab-text-muted">Study date</span>
              <span className="font-mono text-sm text-lab-text" data-testid="clock">{p.clock}</span>
              {p.live ? <Pill tone="green">Live</Pill> : <Pill tone="amber">Start-up</Pill>}
              {[1, 7, 28].map((d) => <Btn key={d} tone="grey" disabled={!p.live} title={p.live ? `Advance the study clock ${d} day(s)` : 'Go live first'} onClick={() => act((pp) => advance(pp, d))}>+{d === 1 ? '1 day' : d === 7 ? '1 wk' : '4 wk'}</Btn>)}
            </div>
            <label className="flex items-center gap-2 text-xs text-lab-text-muted">
              <span className="font-mono">Acting as</span>
              <Select aria-label="Acting as" className="w-64 py-1 text-xs" value={p.currentUserId} onChange={(e) => act((pp) => { pp.currentUserId = e.target.value; audit(pp, me(pp), 'session.switch', 'Acting user', undefined, `${me(pp).name} (${me(pp).role})`, 'Practice role switch') })}
                options={p.users.map((x) => ({ value: x.id, label: `${x.name} · ${ROLE_LABEL[x.role]}` }))} />
            </label>
          </div>
          <nav className="max-w-7xl mx-auto px-4 flex flex-wrap gap-1" aria-label="Main">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => go(v.id)} aria-current={nav.view === v.id ? 'page' : undefined}
                className={`px-3 py-1.5 font-mono text-xs border-b-2 ${nav.view === v.id ? 'border-lab-fda text-lab-fda' : 'border-transparent text-lab-text-muted hover:text-lab-text'}`}>
                {v.label}{v.id === 'queries' && (open + answered > 0) ? <span className="ml-1 text-lab-amber">{open}/{answered}</span> : null}
              </button>
            ))}
          </nav>
        </header>
        {error && <div role="alert" className="max-w-7xl mx-auto w-full px-4 pt-3"><div className="rounded border border-lab-red/60 bg-lab-red-soft px-3 py-2 text-sm text-lab-red flex justify-between gap-2"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss">✕</button></div></div>}
        <main className="max-w-7xl mx-auto w-full px-4 py-4 flex-1">
          <p className="sr-only">Acting as {u.name}, {ROLE_LABEL[u.role]}. {p.queries.filter(isActive).length} active queries.</p>
          <V />
        </main>
        <footer className="border-t border-lab-line text-[11px] text-lab-text-muted">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2">
            <span>Built by Khan Gulrez Shagufa Fazal Ahmed</span>
            <span>Training simulator. Fictional study, sponsor, sites, subjects and data. Saved in this browser only{saved ? ` · saved ${saved}` : ''}.</span>
          </div>
        </footer>
      </div>
    </NavCtx.Provider>
  )
}

export default function App() { return <StoreProvider><Shell /></StoreProvider> }
