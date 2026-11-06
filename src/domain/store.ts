// IndexedDB persistence and project files. Everything stays in this browser unless the user
// exports a file.

import type { Project } from './types'
import { hash } from './util'
import { verifyAudit } from './project'

const DB = 'cdm-query-console', STORE = 'projects', VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
    t.oncomplete = () => db.close()
  })
}
export const saveProject = (p: Project) => tx('readwrite', (s) => s.put(p))
export const loadProject = (id: string) => tx<Project | undefined>('readonly', (s) => s.get(id) as IDBRequest<Project | undefined>)
export const listProjects = () => tx<Project[]>('readonly', (s) => s.getAll() as IDBRequest<Project[]>)
export const deleteProject = (id: string) => tx('readwrite', (s) => s.delete(id))

export interface ProjectFile { format: 'cdm-query-console-project'; version: 1; exportedUtc: string; checksum: string; project: Project }

export function exportFile(p: Project): string {
  const body = JSON.stringify(p)
  const f: ProjectFile = { format: 'cdm-query-console-project', version: 1, exportedUtc: new Date().toISOString(), checksum: hash(body), project: p }
  return JSON.stringify(f)
}
export function importFile(text: string): { project: Project; warnings: string[] } {
  let f: ProjectFile
  try { f = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  if (f?.format !== 'cdm-query-console-project' || !f.project) throw new Error('This is not a CDM Query & Edit-Check Console project file.')
  const p = f.project
  if (p.schema !== 1) throw new Error(`Unsupported project schema ${String(p.schema)}.`)
  for (const k of ['users', 'checks', 'items', 'forms', 'queries', 'audit', 'startup'] as const) if (!(k in p)) throw new Error(`The file is missing "${k}".`)
  const warnings: string[] = []
  if (hash(JSON.stringify(p)) !== f.checksum) warnings.push('The file checksum does not match: the file was changed after export.')
  const br = verifyAudit(p)
  if (br >= 0) warnings.push(`The audit trail chain breaks at entry ${br + 1}: entries were edited outside the app.`)
  p.coderTasks ??= []; p.enteredSeed ??= {}; p.missions ??= []; p.signatures ??= []
  return { project: p, warnings }
}
