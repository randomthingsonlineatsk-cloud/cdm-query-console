// The Study Drug Dictionary (SDD): a fictional drug dictionary with the record structure of
// WHODrug Global in its B3 format (drug record number, sequence number 1 for the active
// moiety or salt, sequence number 2 for the name) and a four-level anatomical-therapeutic
// classification shaped like ATC. Ingredient names are public INNs; every record number,
// trade name and classification code is invented. Classification letters are chosen so they
// cannot be mistaken for real ATC codes.

export interface AtcClass { code: string; name: string; level: 1 | 2 | 3 | 4 }
export interface DrugRecord {
  id: string            // drug record number + seq1 + seq2, e.g. 004512-01-001
  drn: string; seq1: string; seq2: string
  name: string          // the name as it appears on a label
  generic: boolean      // seq2 001 is the active-ingredient name
  ingredients: string[]
  atc: string[]         // level-4 class codes; more than one means choose by indication
}

const ATC: AtcClass[] = []
const cls = (code: string, name: string) => ATC.push({ code, name, level: code.length === 1 ? 1 : code.length === 3 ? 2 : code.length === 4 ? 3 : 4 })
;[
  ['E', 'Alimentary tract and metabolism'], ['E02', 'Acid-related disorders'], ['E02B', 'Ulcer and reflux agents'], ['E02BC', 'Proton pump blockers'], ['E02BA', 'H2 receptor blockers'],
  ['E07', 'Gut motility and antidiarrhoeals'], ['E07D', 'Intestinal motility reducers'], ['E07DA', 'Opioid-receptor antidiarrhoeals'],
  ['E10', 'Glucose-lowering drugs'], ['E10B', 'Oral glucose-lowering drugs'], ['E10BA', 'Biguanide class'], ['E10BH', 'DPP-4 blocker class'],
  ['E11', 'Vitamins'], ['E11C', 'Vitamin D group'], ['E11CC', 'Vitamin D and analogues'],
  ['F', 'Heart and circulation'], ['F07', 'Beta-blocking agents'], ['F07A', 'Beta blockers'], ['F07AB', 'Cardioselective beta blockers'],
  ['F08', 'Calcium channel blockers'], ['F08C', 'Vascular-selective calcium blockers'], ['F08CA', 'Dihydropyridine class'],
  ['F09', 'Renin-angiotensin agents'], ['F09A', 'ACE blockers'], ['F09AA', 'ACE blockers, plain'], ['F09C', 'Angiotensin receptor blockers'], ['F09CA', 'Angiotensin receptor blockers, plain'],
  ['F03', 'Diuretics'], ['F03A', 'Low-ceiling diuretics'], ['F03AA', 'Thiazide class'], ['F03C', 'High-ceiling diuretics'], ['F03CA', 'Sulfonamide loop class'],
  ['F03D', 'Potassium-sparing agents'], ['F03DA', 'Aldosterone antagonist class'], ['F10', 'Lipid-modifying agents'], ['F10A', 'Lipid modifiers, plain'], ['F10AA', 'Statin class'],
  ['W', 'Blood and blood-forming organs'], ['W01', 'Antithrombotic agents'], ['W01A', 'Antithrombotics'], ['W01AC', 'Platelet aggregation blockers'], ['W01AF', 'Direct factor Xa blockers'],
  ['I', 'Anti-infectives for systemic use'], ['I01', 'Antibacterials for systemic use'], ['I01C', 'Beta-lactam penicillins'], ['I01CA', 'Extended-spectrum penicillins'], ['I01CR', 'Penicillin combinations with beta-lactamase blockers'],
  ['I01A', 'Tetracycline class'], ['I01AA', 'Tetracyclines'], ['I01D', 'Other beta-lactams'], ['I01DC', 'Second-generation cephalosporins'], ['I01F', 'Macrolide class'], ['I01FA', 'Macrolides'], ['I01M', 'Quinolone class'], ['I01MA', 'Fluoroquinolones'],
  ['K', 'Nervous system and pain'], ['K02', 'Analgesics'], ['K02A', 'Opioids'], ['K02AA', 'Natural opium alkaloids'], ['K02AJ', 'Opioids in combination with non-opioid analgesics'], ['K02AX', 'Other opioids'],
  ['K02B', 'Other analgesics and antipyretics'], ['K02BA', 'Salicylic acid class (analgesic)'], ['K02BE', 'Anilide class'],
  ['K05', 'Psycholeptics'], ['K05B', 'Anxiolytics'], ['K05BA', 'Benzodiazepine anxiolytics'], ['K05C', 'Hypnotics and sedatives'], ['K05CF', 'Benzodiazepine-related hypnotics'],
  ['K06', 'Psychoanaleptics'], ['K06A', 'Antidepressants'], ['K06AB', 'Selective serotonin reuptake blockers'],
  ['O', 'Musculo-skeletal system'], ['O01', 'Anti-inflammatory and antirheumatic products'], ['O01A', 'Non-steroidal anti-inflammatories'], ['O01AE', 'Propionic acid class'], ['O01AB', 'Acetic acid class'],
  ['Q', 'Respiratory system and allergy'], ['Q06', 'Systemic antihistamines'], ['Q06A', 'Antihistamines for systemic use'], ['Q06AE', 'Piperazine class'], ['Q06AX', 'Other systemic antihistamines'],
  ['Q03', 'Drugs for obstructive airway diseases'], ['Q03A', 'Inhaled adrenergics'], ['Q03AC', 'Selective beta-2 agonists'],
  ['Q03D', 'Other systemic drugs for obstructive airway diseases'], ['Q03DC', 'Leukotriene receptor blockers'], ['Q05', 'Cough and cold preparations'], ['Q05C', 'Expectorants'], ['Q05CB', 'Mucolytics'],
  ['T', 'Systemic hormonal preparations'], ['T03', 'Thyroid therapy'], ['T03A', 'Thyroid preparations'], ['T03AA', 'Thyroid hormones'],
  ['T02', 'Corticosteroids for systemic use'], ['T02A', 'Corticosteroids, plain'], ['T02AB', 'Glucocorticoids'],
  ['U', 'Dermatologicals'], ['U07', 'Topical corticosteroids'], ['U07A', 'Corticosteroids, plain (skin)'], ['U07AA', 'Weak topical corticosteroids'], ['U07AD', 'Very potent topical corticosteroids'],
  ['I05', 'Antivirals for systemic use'], ['I05A', 'Direct acting antivirals'], ['I05AB', 'Nucleoside antivirals (herpes)'],
  ['X', 'Genito-urinary system'], ['X04', 'Urologicals'], ['X04C', 'Prostate drugs'], ['X04CA', 'Alpha-adrenoreceptor blockers (urology)'],
  ['Q03B', 'Other inhaled drugs for obstructive airway diseases'], ['Q03BA', 'Inhaled glucocorticoids'], ['Q03BB', 'Inhaled anticholinergics'],
  ['Q01', 'Nasal preparations'], ['Q01A', 'Decongestants and other nasal preparations'], ['Q01AD', 'Nasal corticosteroids'],
  ['U02', 'Emollients and protectives'], ['U02A', 'Emollients and protectives'], ['U02AC', 'Soft paraffin and fat products'],
  ['U07AC', 'Potent topical corticosteroids'], ['U11', 'Other dermatological preparations'], ['U11A', 'Other dermatological preparations'], ['U11AH', 'Agents for dermatitis, excluding corticosteroids'],
  ['E01', 'Stomatological preparations'], ['E01A', 'Stomatological preparations'], ['E01AB', 'Anti-infectives for local oral treatment'],
  ['K02BX', 'Other analgesics in combination (non-opioid)'],
].forEach(([c, n]) => cls(c, n))

// ingredient | ATC codes | trade names (fictional)
const SRC = `
atorvastatin|F10AA|Lipidra;Statorva;Atorlo
rosuvastatin|F10AA|Rosuvel;Lipocrest
simvastatin|F10AA|Simvera
metformin|E10BA|Glucofen;Metforal;Diabiq
sitagliptin|E10BH|Sitaglo
omeprazole|E02BC|Omepra;Gastrozol
pantoprazole|E02BC|Pantorel;Acidex
famotidine|E02BA|Famora
loperamide|E07DA|Stopora
levothyroxine|T03AA|Thyrolex;Levorin;L-thyroxine
cetirizine|Q06AE|Cetrin;Allerza
loratadine|Q06AX|Loranil;Claritane
fexofenadine|Q06AX|Fexalen
paracetamol|K02BE|Pyrexol;Acetaminophen;Calmadol
paracetamol+codeine|K02AJ|Codaprin;Paracod
tramadol|K02AX|Tramalon
acetylsalicylic acid|W01AC;K02BA|Aspirin;Cardiprin;Aspira
clopidogrel|W01AC|Clopivar
apixaban|W01AF|Apixor
ibuprofen|O01AE|Ibufen;Brufan;Nurolax
naproxen|O01AE|Naprolan
diclofenac|O01AB|Diclomax;Voltarel
amlodipine|F08CA|Amlovas;Norvela
nifedipine|F08CA|Nifecor
bisoprolol|F07AB|Bisocard
metoprolol|F07AB|Metocor;Betaloc-S
ramipril|F09AA|Ramicor;Tritace-V
lisinopril|F09AA|Lisoril
losartan|F09CA|Losaril;Cozarel
valsartan|F09CA|Valsacor
hydrochlorothiazide|F03AA|Hydrozide
indapamide|F03AA|Indapra
furosemide|F03CA|Furolan;Lasirex
amoxicillin|I01CA|Amoxil-T;Moxacin
amoxicillin+clavulanic acid|I01CR|Clavomox;Augmenta-C
clarithromycin|I01FA|Clarimac
azithromycin|I01FA|Azithrol;Zitrex
ciprofloxacin|I01MA|Ciproxal
zolpidem|K05CF|Zolpira
sertraline|K06AB|Sertalin
prednisolone|T02AB|Prednilon
hydrocortisone|U07AA|Hydrocrem
salbutamol|Q03AC|Salbuvent;Ventarol
acetylcysteine|Q05CB|Mucosolv
colecalciferol|E11CC|Vitadee;D-Cal3
tamsulosin|X04CA|Tamsulin
pravastatin|F10AA|Pravacol
gliclazide|E10BA|Glicora
esomeprazole|E02BC|Esomex;Nexorel
ranitidine|E02BA|Ranitab
desloratadine|Q06AX|Deslora
candesartan|F09CA|Candecor
perindopril|F09AA|Perinor;Coversa
atenolol|F07AB|Atenorm
carvedilol|F07AB|Carvedex
spironolactone|F03DA|Spirolac
doxycycline|I01AA|Doxyclin
cefuroxime|I01DC|Cefurin
codeine|K02AA|Codeinol
diazepam|K05BA|Valzepam
citalopram|K06AB|Citaprex
montelukast|Q03DC|Montalair
budesonide|T02AB;Q03BA|Budecort;Pulmibud
clobetasol|U07AD|Clobecort;Dermaclob
valaciclovir|I05AB|Valzovir
fluticasone|Q03BA;Q01AD|Flutavent;Nasoflute
tiotropium|Q03BB|Tiovent
mometasone|U07AC;Q01AD|Mometa;Nasomet
white soft paraffin|U02AC|Emolla;Paraderm
tacrolimus|U11AH|Tacroderm
dupilumab|U11AH|Dermabla
nystatin|E01AB|Nystan
paracetamol+caffeine|K02BX|Calmadol Extra
`

export const ATC_CLASSES = ATC
export const atcByCode = new Map(ATC.map((a) => [a.code, a]))
export const atcPath = (code4: string) => [code4.slice(0, 1), code4.slice(0, 3), code4.slice(0, 4), code4].map((c) => atcByCode.get(c)!).filter(Boolean)

export const DRUGS: DrugRecord[] = []
SRC.trim().split('\n').forEach((line, i) => {
  const [ing, atc, trades] = line.split('|')
  const drn = String(4100 + i * 37).padStart(6, '0')
  const ingredients = ing.split('+').map((s) => s.trim())
  const codes = atc.split(';')
  const nameOf = (s: string) => s.split(/(\+|\s)/).map((w) => (w === '+' || w === ' ' ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('').replace('+', ' + ')
  DRUGS.push({ id: `${drn}-01-001`, drn, seq1: '01', seq2: '001', name: nameOf(ing), generic: true, ingredients, atc: codes })
  trades.split(';').forEach((t, j) => DRUGS.push({ id: `${drn}-01-${String(j + 2).padStart(3, '0')}`, drn, seq1: '01', seq2: String(j + 2).padStart(3, '0'), name: t, generic: false, ingredients, atc: codes }))
})
export const drugById = new Map(DRUGS.map((d) => [d.id, d]))
export const exactDrug = (verbatim: string) => DRUGS.find((d) => d.name.toLowerCase() === verbatim.trim().toLowerCase())
export function searchDrug(q: string, limit = 30) {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  return DRUGS.filter((d) => d.name.toLowerCase().includes(s) || d.ingredients.some((x) => x.includes(s))).slice(0, limit)
}
export const SDD_VERSION = 'SDD 2026 Q1 (B3-style, fictional)'

// SDD 2026 Q3: the changes a learner meets when the drug dictionary is upgraded.
export const SDD_Q3_CHANGES = [
  { kind: 'reclass', ingredient: 'fexofenadine', from: 'Q06AX', to: 'Q06AE', note: 'Fexofenadine moved to the piperazine-class group: every coded record keeps its drug code but its class (CMCLAS) changes.' },
  { kind: 'rename', from: 'Calmadol', toIngredients: 'paracetamol+caffeine', note: 'The trade name Calmadol is now a paracetamol and caffeine combination in the markets the dictionary covers; records coded to "Calmadol" as paracetamol need review against the product the participant took.' },
  { kind: 'new-name', ingredient: 'ibuprofen', name: 'Ibufen Rapid', note: 'New trade name record.' },
] as const
export const SDD_Q3_VERSION = 'SDD 2026 Q3 (B3-style, fictional)'
// The class of a drug record in a dictionary version.
export function atcIn(version: 'Q1' | 'Q3', d: DrugRecord): string[] {
  if (version === 'Q3' && d.ingredients.join('+') === 'fexofenadine') return d.atc.map((a) => (a === 'Q06AX' ? 'Q06AE' : a))
  return d.atc
}
export function drugsIn(version: 'Q1' | 'Q3'): DrugRecord[] {
  if (version === 'Q1') return DRUGS
  const combo = DRUGS.find((d) => d.ingredients.join('+') === 'paracetamol+caffeine' && d.generic)!
  const out = DRUGS.map((d) => (d.name === 'Calmadol' ? { ...d, id: `${combo.drn}-01-003`, drn: combo.drn, seq2: '003', ingredients: combo.ingredients, atc: combo.atc } : { ...d, atc: atcIn('Q3', d) }))
  const ibu = DRUGS.find((d) => d.ingredients.join('+') === 'ibuprofen' && d.generic)!
  const n = DRUGS.filter((d) => d.drn === ibu.drn).length + 1
  out.push({ ...ibu, id: `${ibu.drn}-01-${String(n).padStart(3, '0')}`, seq2: String(n).padStart(3, '0'), name: 'Ibufen Rapid', generic: false })
  return out
}
