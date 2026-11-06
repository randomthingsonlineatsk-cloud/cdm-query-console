// Data model. Every record that a person creates carries userId, and the project carries
// classId, so the shared classroom mode can be added later without a migration.

export type Role = 'dm' | 'dmlead' | 'cra' | 'site' | 'pi' | 'coder' | 'safety' | 'sponsor' | 'system'
export const ROLE_LABEL: Record<Role, string> = {
  dm: 'Clinical data manager', dmlead: 'Lead data manager', cra: 'Clinical research associate',
  site: 'Site study coordinator', pi: 'Principal investigator', coder: 'Medical coder', safety: 'Drug safety physician', sponsor: 'Sponsor clinical lead', system: 'System',
}

export interface User { id: string; name: string; role: Role; siteId?: string; pin: string; trained: boolean }

// Key of one data point: subject | visit | form | instance | field
export type ItemKey = string
export const itemKey = (subj: string, visit: string, form: string, inst: number, field: string): ItemKey => `${subj}|${visit}|${form}|${inst}|${field}`
export const formKeyOf = (k: ItemKey) => k.split('|').slice(0, 4).join('|')
export const parseKey = (k: ItemKey) => { const [subj, visit, form, inst, field] = k.split('|'); return { subj, visit, form, inst: Number(inst), field } }

export interface Version { value: string; userId: string; role: Role; utc: string; reason: string }
export interface Item { key: ItemKey; versions: Version[] } // append-only; last version is current

export type FormStatus = 'entered' | 'sdv' | 'frozen' | 'signed'
export interface FormState { key: string; status: FormStatus; enteredUtc: string; enteredBy: string; visitDate?: string; deleted?: boolean; deletedReason?: string }

export type QueryStatus = 'open' | 'answered' | 'closed' | 'cancelled'
export interface QueryMsg { utc: string; userId: string; role: Role; kind: 'raise' | 'response' | 'requery' | 'close' | 'cancel' | 'autoclose' | 'note'; text: string }
export interface Query {
  id: string; key: ItemKey; source: 'auto' | 'manual'; checkId?: string
  status: QueryStatus; raisedBy: string; raisedUtc: string; text: string
  requeries: number; closedUtc?: string; answeredUtc?: string
  msgs: QueryMsg[]; quality?: number // style score of the raising text, 0 to 100
  dueDate?: string        // simulated date the site is expected to respond
  valueAtClose?: string   // value of the item when the query closed
}
export interface CoderTask { id: string; key: ItemKey; checkId: string; utc: string; status: 'pending' | 'done'; text: string }

export type CheckCategory = 'missing' | 'range' | 'date' | 'cross-form' | 'protocol' | 'derived' | 'coding'
export type CheckAction = 'query' | 'autofix' | 'coder'
export interface CheckTest { name: string; values: Record<string, string>; ctx?: Record<string, string>; fire: boolean }
export interface Check {
  id: string; title: string; category: CheckCategory; action: CheckAction
  form: string; field: string; visits?: string[]
  expr: string; message: string; fix?: string
  tests: CheckTest[]; active: boolean
}

export interface AuditEntry {
  seq: number; utc: string; userId: string; role: Role; action: string
  entity: string; old?: string; new?: string; reason?: string; hash: string
}

export interface Signature { meaning: string; userId: string; role: Role; utc: string; what: string }

export interface UatResult { checkId: string; test: string; expected: boolean; actual: boolean | 'error'; utc: string; userId: string }

export interface Startup {
  dmpFlags: Record<string, string>   // statement id -> chosen correction id
  dmpApproved?: Signature
  ccgApproved?: Signature
  uat: UatResult[]
  uatSigned?: Signature
  risk: Record<string, { likelihood: number; impact: number; detect: number }>
  qtl: Record<string, number>
  riskApproved?: Signature
  goLive?: Signature
}

export type Level = 'guided' | 'standard' | 'expert'
export interface MissionRun { id: string; startedUtc: string; endedUtc?: string; score?: number; passed?: boolean; detail?: string[]; userId: string; answers?: Record<string, string>; level?: Level }

export interface Project {
  schema: 1; id: string; name: string; classId: string; userId: string
  createdUtc: string; updatedUtc: string
  users: User[]; currentUserId: string
  clock: string            // simulated study date, YYYY-MM-DD
  live: boolean
  checks: Check[]
  items: Record<ItemKey, Item>
  forms: Record<string, FormState>
  queries: Query[]
  nextQuery: number
  coderTasks: CoderTask[]
  enteredSeed: Record<string, true> // seed entries already entered by the simulated sites
  startup: Startup
  audit: AuditEntry[]
  signatures: Signature[]
  missions: MissionRun[]
  seedVersion?: number
  // Phase 2
  coding: Record<ItemKey, CodingRecord>
  synonyms: Record<string, { dict: 'SMD' | 'SDD'; code: string; atc?: string; userId: string; utc: string }>
  smdVersion: '1.0' | '1.1'
  smdUpgrade?: { utc: string; userId: string; note: string; reviewed: string[]; signature?: Signature }
  sae: SaeRecon
  ext: ExtRecon
  // Phase 3
  sdv: Record<ItemKey, { userId: string; utc: string; ver: number }>
  sdvPlan: { mode: 'targeted' | 'full'; signature?: Signature }
  deviations: Deviation[]
  monitoring: { decisions: Record<string, MonitoringDecision>; forCause: Record<string, string> }
  qtlLog: QtlRecord[]
  // Phase 4
  lock: LockState
  missionLevel?: Level
}

export type LockStatus = 'open' | 'soft' | 'hard' | 'unlocked'
export interface UnlockRequest { id: string; justification: string; subjects: string[]; requestedBy: string; utc: string; approvals: Signature[]; status: 'requested' | 'approved' | 'relocked'; relockedUtc?: string }
export interface LockState {
  status: LockStatus
  events: { utc: string; userId: string; action: string; detail: string }[]
  piSign: Record<string, { userId: string; utc: string; auditSeq: number }>
  auditReview?: { userId: string; utc: string; findings: string; upToSeq: number }
  privacy?: { userId: string; utc: string; note: string }
  softSig?: Signature
  hardSigs: Signature[]
  unlocks: UnlockRequest[]
  archive?: { utc: string; retention: string; checksum: string; files: number }
}

export type DvCategory = 'Eligibility' | 'Informed consent' | 'Visit window' | 'Prohibited medication' | 'Investigational product' | 'Safety reporting' | 'Procedure not done' | 'Other'
export interface Deviation {
  id: string; subj: string; category: DvCategory; description: string; source: string; key?: ItemKey
  identified: string; userId: string; utc: string
  important?: boolean; classifiedBy?: string; rationale?: string; status: 'to classify' | 'classified'
}
export interface MonitoringDecision { finding: 'action' | 'explained'; action?: 'for-cause visit' | 'site retraining' | 'escalate to sponsor'; note: string; userId: string; utc: string }
export interface QtlRecord { id: string; qtl: string; observed: number; limit: number; rootCause: string; action: string; utc: string; signature: Signature }

export type CodingStatus = 'uncoded' | 'coded' | 'query' | 'approved'
export interface CodingRecord {
  key: ItemKey; dict: 'SMD' | 'SDD'; verbatim: string; status: CodingStatus
  code?: string; atc?: string; method?: 'auto' | 'synonym' | 'manual'; version?: string
  codedBy?: string; codedUtc?: string; approvedBy?: string; approvedUtc?: string; queryId?: string
  previous?: { code: string; version: string; reason: string }
  review?: boolean // hierarchy changed in a dictionary upgrade; needs review
  history: { utc: string; userId: string; action: string; detail: string }[]
}

export type SaeClass = 'edc' | 'safety' | 'acceptable' | 'not-reported' | 'missing-edc'
export interface ReconDecision { cls: SaeClass | 'vendor' | 'no-action'; reason: string; userId: string; utc: string; queryId?: string; noteDue?: string; done?: boolean; reply?: string }
export interface SaeRecon {
  links: Record<string, string>            // EDC AE form key -> safety case id (manual links)
  decisions: Record<string, ReconDecision> // discrepancy id -> decision
  safetyFixes: Record<string, Record<string, string>> // case id -> fields corrected by the safety team
  createdCases: string[]                    // EDC-only SAEs the safety team has since entered
  cutoff?: string
  signoffDm?: Signature; signoffSafety?: Signature
}
export interface ExtRecon {
  transfers: Record<string, { status: 'accepted' | 'rejected'; reason: string; userId: string; utc: string }>
  decisions: Record<string, ReconDecision>
  rules: { id: string; vendor: string; test: string; from: string; to: string; factor: number; site?: string; userId: string; utc: string }[]
  vendorFixes: Record<string, string>       // discrepancy id -> date the vendor fixed it
  signoff?: Signature
}
