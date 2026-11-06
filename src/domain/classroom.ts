// Classroom mode: the only feature that talks to a server. It uses the shared classroom
// Worker (Cloudflare Worker + D1) kept in the eCTD Dossier Builder repository, routes under
// /cdm/v1. Instructors create a class and set missions as assignments; students join with a
// code, run the mission in a prepared project, and submit it; instructors re-score each
// submission in their own browser, comment, and see a leaderboard.

import type { MissionRun, Project } from './types'
import { SCORERS, scoreM4, scoreM13 } from './missions'
import { migrate } from './project'

export const DEFAULT_API = 'https://ectd-classroom.randomthingsonlineatsk.workers.dev/cdm/v1'
export const BUILT_IN_API = (import.meta.env?.VITE_CLASSROOM_API as string | undefined) || DEFAULT_API
export const SUBMISSION_KIND = 'cdm-query-console/mission-submission'
const KEY = 'cdm-classroom'

export interface Session { api: string; token?: string; role?: 'instructor' | 'student'; className?: string; name?: string }
export function loadSession(): Session {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { ...s, api: s.api || BUILT_IN_API } } catch { return { api: BUILT_IN_API } }
}
export function saveSession(s: Session) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private window: the session lasts for this page only */ } }

export async function api<T = Record<string, unknown>>(s: Session, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(s.api.replace(/\/+$/, '') + path, { method, headers: { 'content-type': 'application/json', ...(s.token ? { authorization: `Bearer ${s.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  } catch { throw new Error('Could not reach the classroom server. Check the address and your connection.') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `The classroom server answered ${res.status}.`)
  return data as T
}

// A mission project is several megabytes of JSON; gzip makes it small enough to submit.
async function gzip(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}
async function gunzip(b64: string): Promise<string> {
  const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export interface Submission { kind: typeof SUBMISSION_KIND; missionId: string; level: string; runStartedUtc: string; score: number; detail: string[]; gz: string; size: number }
export async function submissionPayload(p: Project, run: MissionRun) {
  if (run.score === undefined) throw new Error('Finish and score the mission before submitting it.')
  const text = JSON.stringify(p)
  const sub: Submission = { kind: SUBMISSION_KIND, missionId: run.id, level: run.level ?? 'standard', runStartedUtc: run.startedUtc, score: run.score, detail: run.detail ?? [], gz: await gzip(text), size: text.length }
  return { project: sub, score: run.score, checks: (run.detail ?? []).map((d, i) => ({ id: `d${i + 1}`, label: d, ok: true })) }
}

// Re-score a submitted mission project with this copy of the app's scoring.
export async function verifySubmission(file: Submission): Promise<{ score: number; detail: string[]; project: Project }> {
  if (file?.kind !== SUBMISSION_KIND) throw new Error('This is not a CDM Query & Edit-Check Console mission submission.')
  const p = migrate(JSON.parse(await gunzip(file.gz)) as Project)
  const run = p.missions.find((m) => m.id === file.missionId && m.startedUtc === file.runStartedUtc)
  if (!run) throw new Error(`The submitted project has no run of ${file.missionId}.`)
  const copy: MissionRun = { ...run, score: undefined, passed: undefined, detail: undefined }
  p.missions.push(copy)
  const f = SCORERS[file.missionId] ?? (file.missionId === 'M4' ? scoreM4 : file.missionId === 'M13' ? scoreM13 : undefined)
  if (!f) throw new Error(`No scoring for ${file.missionId} in this version of the app.`)
  f(p, copy)
  p.missions.pop()
  return { score: copy.score ?? 0, detail: copy.detail ?? [], project: p }
}
