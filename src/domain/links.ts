// Companion apps in the portfolio. Plain links, so each app stays independent.
export interface AppLink { name: string; url?: string; status: 'live' | 'repository' | 'planned'; why: string }
const GH = 'https://randomthingsonlineatsk-cloud.github.io'
export const LINKS: Record<string, AppLink> = {
  trial: { name: 'Clinical Trial Simulator', url: `${GH}/clinical-trial-simulator/`, status: 'live', why: 'Vasclarin’s earlier development: this console runs the phase 2 study that follows the simulator’s Phase I.' },
  ectd: { name: 'eCTD Dossier Builder', url: `${GH}/ectd-dossier-builder/`, status: 'live', why: 'The DMP, lock records and archive are trial master file documents behind the clinical sections of a dossier.' },
  pvi: { name: 'PV Intake & Triage Console', url: 'https://r6j9p36xbegaek4lcdp5268p.macaly.app', status: 'live', why: 'How drug safety receives and triages the SAEs you reconcile here.' },
  pvd: { name: 'Pharmacovigilance Detective', url: 'https://pharmacovigilance-detective.randomthingsonlineatsk.workers.dev', status: 'live', why: 'Seriousness, expectedness, causality and reporting timelines of the same kind of cases.' },
  edc: { name: 'EDC Study Build Lab', status: 'planned', why: 'The build side: CRF design, edit-check programming and UAT. When it exists, this console will import its study build file.' },
  coding: { name: 'Medical Coding Trainer', status: 'planned', why: 'Deeper practice with coding conventions.' },
  sdtm: { name: 'SDTM Mapping Trainer', status: 'planned', why: 'The annotated CRF shows SDTM targets; the locked CDASH export becomes its input.' },
  tlf: { name: 'TLF Programming Lab', status: 'planned', why: 'Receives the locked, archived dataset export.' },
}
