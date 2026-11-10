// The Study Medical Dictionary (SMD): a fictional terminology with the same five-level
// structure as MedDRA (system class > group > cluster > preferred term > lowest-level term),
// one primary path per preferred term, and lowest-level terms that can be retired in a new
// version. Names, codes and hierarchy are invented for training; no MedDRA content is used.

import { hash } from './util'

export type Level = 'SOC' | 'HLGT' | 'HLT' | 'PT' | 'LLT'
export interface Term { code: string; name: string; level: Level; parent?: string; current: boolean; secondary?: string[] }
export interface MedDict { version: string; released: string; terms: Map<string, Term>; byName: Map<string, Term[]> }

// One line per term. Indentation sets the level: SOC, two spaces HLGT, four HLT, six PT.
// A PT line lists its LLTs after "|", separated by ";". The PT name is always also an LLT.
const V1 = `
Brain and nerves
  Head pain conditions
    Headache types
      Head pain | Headache; Head ache; Headaches; Frontal headache; Tension headache; Pain in head
      Migraine attack | Migraine; Migraine with aura
  Balance and consciousness
    Vertigo and light-headedness
      Light-headedness | Dizziness; Dizzy; Feeling dizzy; Giddiness; Light headed
      Spinning vertigo | Vertigo; Room spinning
    Fainting events
      Fainting | Syncope; Faint; Passed out; Blackout
  Brain blood supply
    Brief brain ischaemia
      Transient brain ischaemia | Transient ischaemic attack; TIA; Mini stroke
    Stroke events
      Brain infarction | Ischaemic stroke; Stroke; Cerebral infarction
  Nerve sensations
    Abnormal skin sensation
      Tingling | Pins and needles; Paraesthesia; Tingling in fingers
      Numbness | Numbness in hands; Loss of sensation
Heart and rhythm
  Heart rhythm disorders
    Atrial rhythm disorders
      Atrial fibrillation event | Atrial fibrillation; AF; Irregular heartbeat
    Heart rate changes
      Slow heart rate | Bradycardia; Slow pulse
      Fast heart rate | Tachycardia; Racing heart; Palpitations
  Heart blood supply
    Chest pain of heart origin
      Heart-related chest pain | Angina; Angina pectoris; Cardiac chest pain
    Heart attack events
      Heart muscle infarction | Myocardial infarction; Heart attack
  ECG findings
    Repolarisation findings
      QT prolongation | QTc prolonged; Long QT; Prolonged QT interval
Blood vessels and circulation
  Blood pressure changes
    Low blood pressure
      Low blood pressure | Hypotension; Blood pressure low; Orthostatic hypotension; Postural hypotension
    High blood pressure
      Raised blood pressure | Hypertension; Essential hypertension; High blood pressure; Blood pressure increased; Hypertension aggravated; Worsening of hypertension
  Swelling and fluid
    Limb swelling
      Swelling of the legs | Ankle swelling; Swollen ankles; Swelling both ankles; Oedema of legs; Peripheral oedema; Leg swelling
    Flushing
      Flushing episode | Flushing; Hot flush; Facial flushing
Lungs and airways
  Cough and airway irritation
    Cough symptoms
      Cough | Dry cough; Coughing; Tickly cough; Productive cough
    Throat symptoms
      Sore throat | Throat pain; Pharyngitis symptoms
  Breathing difficulty
    Shortness of breath
      Breathlessness | Shortness of breath; Dyspnoea; Breathless on exertion
  Nose conditions
    Nose bleeding
      Nosebleed | Epistaxis; Nose bleed; Bleeding from nose
  Airway narrowing
    Asthma conditions
      Asthma | Asthma, well controlled; Bronchial asthma; Allergic asthma; Asthma aggravated; Worsening of asthma; Asthma exacerbation
      Wheezing | Wheeze; Wheezy chest
  Voice disorders
    Voice changes
      Hoarseness | Dysphonia; Hoarse voice; Loss of voice
Digestive system
  Stomach and gut symptoms
    Nausea and vomiting
      Nausea | Nauseous; Feeling sick; Queasy
      Vomiting | Vomit; Being sick; Emesis
    Bowel habit changes
      Diarrhoea | Diarrhea; Loose stools; Frequent loose stools
      Constipation | Hard stools; Constipated
    Abdominal pain
      Abdominal pain | Stomach ache; Tummy pain; Upper abdominal pain
  Acid and reflux
    Reflux conditions
      Acid reflux disease | Gastro-oesophageal reflux; GERD; GORD; Heartburn; Acid reflux
  Gut bleeding
    Upper gut bleeding
      Upper gut haemorrhage | Gastrointestinal bleed; GI bleed; Haematemesis
  Appendix conditions
    Appendix inflammation
      Appendix inflammation | Appendicitis; Acute appendicitis
Kidneys and urinary tract
  Kidney function
    Acute kidney conditions
      Acute kidney injury | Acute renal failure; AKI; Kidney injury acute
  Stones
    Kidney stones
      Kidney stone | Renal colic; Kidney stones; Renal calculus; Nephrolithiasis
Infections
  Airway infections
    Upper airway infections
      Upper respiratory tract infection | URTI; Common cold; Head cold; Upper respiratory infection; Nasopharyngitis
    Lung infections
      Pneumonia | Community-acquired pneumonia; Chest infection with consolidation; Lobar pneumonia
  Skin infections
    Soft tissue infections
      Cellulitis | Cellulitis left leg; Cellulitis right leg; Skin infection spreading; Cellulitis of hand
    Hair follicle infections
      Folliculitis | Folliculitis on legs; Infected hair follicles
  Fungal infections
    Oral fungal infections
      Oral thrush | Oral candidiasis; Thrush in mouth; Candida of mouth
  Herpes virus infections
    Varicella zoster infections
      Herpes zoster | Shingles; Zoster; Herpes zoster on chest
    Herpes simplex infections
      Cold sore | Oral herpes; Cold sore on lip; Herpes labialis
  Gut infections
    Gastroenteritis
      Gastroenteritis | Stomach bug; Viral gastroenteritis; Gastro
Skin
  Rashes
    Rash types
      Rash | Skin rash; Rash on forearm; Itchy rash; Itchy rash forearm; Red rash
      Itching | Pruritus; Itchy skin
  Eczema conditions
    Hand and contact eczema
      Hand eczema | Chronic hand eczema; Hand eczema flare; Flare of hand eczema; Worsening hand eczema; Hand dermatitis
    Atopic eczema
      Atopic dermatitis | Atopic eczema; Atopic dermatitis in childhood; Childhood eczema; Worsening of atopic dermatitis; Atopic dermatitis flare
  Sebaceous gland conditions
    Acne conditions
      Acne | Acne on face; Spots on chin; Acne vulgaris
  Allergic swelling
    Deep tissue swelling
      Angioedema | Angioedema of lips; Swelling of face and lips; Tongue swelling
  Hives
    Urticaria conditions
      Urticaria | Hives; Nettle rash; Wheals
Muscles, bones and joints
  Muscle symptoms
    Muscle spasm and cramp
      Muscle cramps | Muscle cramp; Leg cramps; Cramps in calves; Night cramps
      Muscle pain | Myalgia; Aching muscles
  Back and joint pain
    Back pain
      Back pain | Low back ache; Lower back pain; Backache; Low back pain
    Joint pain
      Joint pain | Arthralgia; Knee pain; Painful joints
    Degenerative joint disease
      Joint degeneration | Osteoarthritis of the knee; Osteoarthritis; Knee osteoarthritis
Metabolism and nutrition
  Glucose disorders
    Diabetes
      Type 2 diabetes | Type 2 diabetes mellitus; Diabetes mellitus type II; Non-insulin dependent diabetes
  Lipid disorders
    Raised cholesterol
      Raised cholesterol | Hypercholesterolaemia; High cholesterol; Hyperlipidaemia
  Electrolyte disorders
    Potassium disorders
      High potassium | Hyperkalaemia; Potassium increased; Raised potassium
      Low potassium | Hypokalaemia; Potassium decreased
Hormones and glands
  Thyroid conditions
    Underactive thyroid
      Underactive thyroid | Hypothyroidism; Low thyroid
Immune and allergy
  Allergic conditions
    Nose allergy
      Allergic nose inflammation | Seasonal allergic rhinitis; Hay fever; Allergic rhinitis
Mental health and sleep
  Sleep disorders
    Sleeplessness
      Sleeplessness | Insomnia; Difficulty sleeping; Poor sleep; Unable to sleep
  Mood
    Low mood
      Low mood | Depressed mood; Feeling low
    Anxiety
      Anxiety | Anxious; Nervousness
Eyes
  Eye surface conditions
    Conjunctival conditions
      Conjunctivitis | Pink eye; Sticky eye; Conjunctival inflammation
    Tear film conditions
      Dry eye | Dry eyes; Eye dryness
General and site of use
  Application and injection site reactions
    Application site reactions
      Application site irritation | Application site burning; Stinging at application site; Application site redness; Burning where cream applied
    Injection site reactions
      Injection site reaction | Injection site pain; Injection site redness; Injection site swelling
  General body symptoms
    Tiredness and weakness
      Fatigue | Tiredness; Feeling tired; Tired; Lethargy; Exhaustion
      Weakness | Asthenia; Feeling weak
    Fever
      Fever | Pyrexia; High temperature; Feverish
  Chest symptoms not of heart origin
    Non-cardiac chest pain
      Chest pain | Chest discomfort; Pain in chest; Non-cardiac chest pain
Injuries and accidents
  Falls and fractures
    Falls
      Fall | Fall at home; Tripped and fell
    Upper limb fractures
      Wrist fracture | Fractured wrist; Broken wrist; Fracture of radius
  Head injuries
    Concussion
      Concussion | Head injury with concussion; Mild traumatic brain injury
  Road accidents
    Road accidents
      Road traffic accident | Car accident; RTA; Motor vehicle accident
  Medication errors
    Dosing errors
      Extra dose taken | Accidental overdose; Took extra tablet; Double dose taken
      Missed dose | Dose missed; Forgot to take dose
Test results
  Blood chemistry results
    Liver enzymes
      Liver enzymes raised | ALT increased; Transaminases increased; Raised liver enzymes
    Kidney function results
      Creatinine raised | Blood creatinine increased; Raised creatinine
    Electrolyte results
      Blood potassium raised | Serum potassium increased; Blood potassium increased; Potassium raised on blood test
Operations and procedures
  Abdominal operations
    Appendix removal
      Appendix removal | Appendicectomy; Appendectomy
  Joint operations
    Joint replacement
      Knee replacement | Total knee replacement; Knee arthroplasty
`

// Version 1.1: the changes a learner meets in an upgrade.
export const V11_CHANGES = [
  { kind: 'retire', llt: 'Head ache', note: 'Spelling variant retired; use Headache.' },
  { kind: 'retire', llt: 'Tiredness', note: 'Retired as too vague; use Fatigue or Feeling tired.' },
  { kind: 'retire', llt: 'Low back ache', note: 'Retired; use Low back pain.' },
  { kind: 'retire', llt: 'Dizzy', note: 'Adjective form retired; use Dizziness.' },
  { kind: 'move-pt', pt: 'Swelling of the legs', toHlt: 'Fluid retention in limbs', toHlgt: 'Fluid balance', toSoc: 'General and site of use', note: 'Moved from Blood vessels and circulation to General and site of use.' },
  { kind: 'demote', pt: 'Muscle cramps', toPt: 'Muscle pain', note: 'Muscle cramps is now an LLT under Muscle pain; LLT codes keep, PT changes.' },
  { kind: 'add', pt: 'Upper respiratory tract infection', llt: 'Upper airway infection', note: 'New LLT.' },
  { kind: 'add', pt: 'Head pain', llt: 'Headache worse in morning', note: 'New LLT.' },
] as const

const codeFor = (level: Level, name: string) => {
  const pre = { SOC: '91', HLGT: '92', HLT: '93', PT: '94', LLT: '95' }[level]
  return pre + String(parseInt(hash(level + ':' + name.toLowerCase()).slice(-10), 16) % 1_000_000).padStart(6, '0')
}

function build(version: string, released: string, src: string): MedDict {
  const terms = new Map<string, Term>()
  const stack: string[] = []
  const add = (t: Term) => { terms.set(t.code, t); return t }
  for (const raw of src.split('\n')) {
    if (!raw.trim()) continue
    const depth = (raw.length - raw.trimStart().length) / 2
    const level = (['SOC', 'HLGT', 'HLT', 'PT'] as Level[])[depth]
    const [name, llts] = raw.trim().split('|').map((s) => s.trim())
    const t = add({ code: codeFor(level, name), name, level, parent: depth ? stack[depth - 1] : undefined, current: true })
    stack[depth] = t.code; stack.length = depth + 1
    if (level === 'PT') for (const l of [name, ...(llts ? llts.split(';').map((s) => s.trim()) : [])]) add({ code: codeFor('LLT', l), name: l, level: 'LLT', parent: t.code, current: true })
  }
  return index({ version, released, terms, byName: new Map() })
}
function index(d: MedDict): MedDict {
  d.byName = new Map()
  for (const t of d.terms.values()) { const k = t.name.toLowerCase(); d.byName.set(k, [...(d.byName.get(k) ?? []), t]) }
  return d
}

function upgrade(v1: MedDict): MedDict {
  const terms = new Map<string, Term>([...v1.terms].map(([k, t]) => [k, { ...t, secondary: undefined }]))
  const d: MedDict = { version: '1.1', released: '2026-09-01', terms, byName: new Map() }
  const find = (level: Level, name: string) => [...terms.values()].find((t) => t.level === level && t.name === name)!
  for (const c of V11_CHANGES) {
    if (c.kind === 'retire') find('LLT', c.llt).current = false
    if (c.kind === 'add') { const pt = find('PT', c.pt); terms.set(codeFor('LLT', c.llt), { code: codeFor('LLT', c.llt), name: c.llt, level: 'LLT', parent: pt.code, current: true }) }
    if (c.kind === 'move-pt') {
      const soc = find('SOC', c.toSoc)
      const hlgt = { code: codeFor('HLGT', c.toHlgt), name: c.toHlgt, level: 'HLGT' as Level, parent: soc.code, current: true }
      const hlt = { code: codeFor('HLT', c.toHlt), name: c.toHlt, level: 'HLT' as Level, parent: hlgt.code, current: true }
      terms.set(hlgt.code, hlgt); terms.set(hlt.code, hlt)
      find('PT', c.pt).parent = hlt.code
    }
    if (c.kind === 'demote') {
      const pt = find('PT', c.pt), to = find('PT', c.toPt)
      for (const t of terms.values()) if (t.level === 'LLT' && t.parent === pt.code) t.parent = to.code
      terms.delete(pt.code)
    }
  }
  return index(d)
}

// Multiaxiality: a preferred term sits in one primary system class and may be linked to others.
// Counts and tables use the primary class; searches and safety reviews can use all of them.
export const SECONDARY: Record<string, string[]> = {
  'Pneumonia': ['Lungs and airways'], 'Upper respiratory tract infection': ['Lungs and airways'], 'Cellulitis': ['Skin'], 'Folliculitis': ['Skin'],
  'Herpes zoster': ['Skin', 'Brain and nerves'], 'Cold sore': ['Skin'], 'Gastroenteritis': ['Digestive system'], 'Oral thrush': ['Digestive system'],
  'Angioedema': ['Immune and allergy'], 'Urticaria': ['Immune and allergy'], 'Allergic nose inflammation': ['Lungs and airways'], 'Asthma': ['Immune and allergy'],
  'Fainting': ['Blood vessels and circulation'], 'Heart-related chest pain': ['Blood vessels and circulation'], 'Brain infarction': ['Blood vessels and circulation'], 'Transient brain ischaemia': ['Blood vessels and circulation'],
  'Conjunctivitis': ['Infections'], 'Type 2 diabetes': ['Hormones and glands'],
}
function linkSecondary(d: MedDict): MedDict {
  const socs = [...d.terms.values()].filter((t) => t.level === 'SOC')
  for (const t of d.terms.values()) if (t.level === 'PT' && SECONDARY[t.name]) t.secondary = SECONDARY[t.name].map((n) => socs.find((x) => x.name === n)?.code).filter(Boolean) as string[]
  return d
}
export const SMD_10 = linkSecondary(build('1.0', '2026-03-01', V1))
export const SMD_11 = linkSecondary(upgrade(SMD_10))
export const SMD: Record<string, MedDict> = { '1.0': SMD_10, '1.1': SMD_11 }

export function path(d: MedDict, code: string): Term[] {
  const out: Term[] = []
  let t = d.terms.get(code)
  while (t) { out.unshift(t); t = t.parent ? d.terms.get(t.parent) : undefined }
  return out // SOC, HLGT, HLT, PT, LLT
}
export const ptOf = (d: MedDict, llt: string) => path(d, llt).find((t) => t.level === 'PT')
export const exactLlt = (d: MedDict, verbatim: string) => (d.byName.get(verbatim.trim().toLowerCase()) ?? []).find((t) => t.level === 'LLT' && t.current)
export function searchMed(d: MedDict, q: string, limit = 30): Term[] {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  const words = s.split(/\s+/)
  return [...d.terms.values()].filter((t) => t.level === 'LLT' && words.every((w) => t.name.toLowerCase().includes(w)))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.length - b.name.length).slice(0, limit)
}
export const medStats = (d: MedDict) => {
  const c: Record<Level, number> = { SOC: 0, HLGT: 0, HLT: 0, PT: 0, LLT: 0 }
  for (const t of d.terms.values()) c[t.level]++
  return c
}

export const socOf = (d: MedDict, code: string) => path(d, code)[0]
export const secondarySocs = (d: MedDict, ptCode: string) => (d.terms.get(ptCode)?.secondary ?? []).map((c) => d.terms.get(c)!).filter(Boolean)
