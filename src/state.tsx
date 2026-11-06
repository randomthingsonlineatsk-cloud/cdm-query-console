import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Project } from './domain/types'
import { createProject } from './domain/project'
import { listProjects, saveProject } from './domain/store'

interface Store { p: Project; tick: number; act: (fn: (p: Project) => void) => boolean; replace: (p: Project) => void; error: string; setError: (s: string) => void; saved: string }
const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<Project | null>(null)
  const [tick, setTick] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    listProjects().then((all) => {
      ref.current = all.sort((a, b) => b.updatedUtc.localeCompare(a.updatedUtc))[0] ?? createProject()
    }).catch(() => { ref.current = createProject() }).finally(() => { setReady(true); setTick((t) => t + 1) })
  }, [])

  const persist = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (!ref.current) return
      saveProject(ref.current).then(() => setSaved(new Date().toLocaleTimeString())).catch((e) => setError(`Could not save to this browser: ${(e as Error).message}`))
    }, 400)
  }, [])

  const act = useCallback((fn: (p: Project) => void) => {
    try { fn(ref.current!); setError(''); return true } catch (e) { setError((e as Error).message); return false } finally { setTick((t) => t + 1); persist() }
  }, [persist])
  const replace = useCallback((np: Project) => { ref.current = np; setTick((t) => t + 1); persist() }, [persist])

  if (!ready || !ref.current) return <div className="min-h-screen bg-lab-bg text-lab-text-muted grid place-items-center font-mono text-sm">Loading the study…</div>
  return <Ctx.Provider value={{ p: ref.current, tick, act, replace, error, setError, saved }}>{children}</Ctx.Provider>
}
