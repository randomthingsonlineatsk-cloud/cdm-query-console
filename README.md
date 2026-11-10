# CDM Query & Edit-Check Console

A browser practice app for clinical data management on the run side of a study. You are the
data management team at a CRO for a fictional phase 2 hypertension trial, from start-up to
clean live data: the data management plan, the CRF completion guidelines, the data
validation specification and its UAT, the eCRF, automatic and manual queries, ageing and
metrics, and an ALCOA+ audit trail.

**Live app:** https://randomthingsonlineatsk-cloud.github.io/cdm-query-console/

A second study, the vaccine trial ALV-3-301, teaches participant-reported data: an
electronic diary of solicited reactions, compliance, corrections through the diary vendor,
and reconciliation (Phase 5).

A third study, HRP-301 (VERDANT-1), is the Ostrevia phase 3 trial in chronic hand eczema that the
eCTD Dossier Builder's NDA and the Labelling Workbench's label are about. It has hepatitis B
screening, the IGA-CHE and HECSI severity scales and an itch rating, a central laboratory and an
IRT by transfer, four SAEs to reconcile, and planted entry errors and protocol deviations.
Mission M20 takes it to hard lock; its exported project file is what the SDTM Mapping Trainer maps
next, in the Ostrevia lifecycle journey (https://randomthingsonlineatsk-cloud.github.io/pharmolecule/journey.html).
Coded terms now travel in the project file with their full dictionary path, as an EDC coding
extract carries them.

Everything is fictional: the studies HLV-204-201, ALV-3-301 and HRP-301, Ostrevia (lumiravostat), Halcyon Ridge Pharmaceuticals, Vasclarin (VSC-9), Aurelivax
(ALV-3), Halvern Therapeutics, Aurelis Vaccines, Marrowbridge Clinical, all sites, subjects and
participants. Training only; not a validated system; never enter real patient data.

## What Phase 1 covers

- **Start-up.** A data management plan with eight planted errors to find and correct; CRF
  completion guidelines; training records; a risk assessment with quality tolerance limits
  (ICH E6(R3) 3.10); a go-live checklist with two-part electronic signatures (user ID and PIN).
- **Data validation specification.** 112 edit checks stored as data: missing, range, date
  logic, cross-form, protocol logic, derived BMI and coding. Each fires as a query, an
  automatic derivation or a coder task. 227 UAT test cases; three checks ship with
  programming errors for you to find.
- **Check language.** Logic is written in a small expression language with its own parser:
  no `eval`, no access to anything outside the casebook.
- **eCRF.** CDASHIG v2.3 forms across seven visits plus AE and CM logs, with an annotated
  CRF view showing the SDTM target of each field.
- **A simulated study.** A study clock you move forward. Sites enter visits with their own
  lag and error rate and answer queries on their own timetable; one has a new coordinator,
  one is slow, one uses other lab units, one enrols late. About 130 planted issues with an
  answer key.
- **Queries.** Raise, answer, re-query, close and cancel, with role rules; automatic
  queries close themselves when the data are fixed. Ageing buckets and per-site metrics
  (time to close, re-query rate, data entry lag). Manual queries are scored on query
  writing rules.
- **Listings** for manual review: AEs, duplicate AEs, medications without a matching AE,
  vital-sign trends, visit windows, labs with units.
- **Audit trail.** Append-only versions for every value; every action logged with who,
  when (UTC) and why; a hash chain you can verify.
- **Missions.** Fix the DMP, Test the checks, Clean a messy site, Write a good query.
- **Project files.** Saved in IndexedDB; export and import as a file with a checksum.
  Records carry user and class IDs for the later classroom mode.

## What Phase 2 adds

- **Medical coding.** A fictional five-level Study Medical Dictionary (about 440 terms, the
  same structure as MedDRA, no MedDRA content) and a fictional drug dictionary (157
  records in a WHODrug B3-style layout, with a four-level ATC-shaped classification using
  letters the real ATC does not use). Auto-coding by exact match, a study synonym list,
  manual coding with class chosen by indication, coding queries to the site, and approval
  with an electronic signature. A version 1.1 release retires, moves and demotes terms;
  the upgrade shows the impact, flags terms to recode and hierarchy changes to review.
- **SAE reconciliation.** Twelve SAEs in the EDC against a fictional safety database, field
  by field: matching, manual links for a mistyped key, classes (EDC error, safety database
  error, acceptable difference, not reported, missing from the EDC), queries and notes that
  get answered as time passes, a data cut-off and two sign-offs.
- **Vendor data.** Data transfer agreements for a central laboratory, a central ECG reader
  and an IRT; monthly cumulative transfers checked against the DTA (file name, delimiter,
  columns, blinding, record count, required fields, dates); load or reject; reconciliation
  on keys; unit conversion rules for standardised results.
- **Missions M5 to M8.** Code the backlog, Reconcile SAEs before the cut-off, Reconcile the
  central lab transfer, Upgrade the dictionary.

## What Phase 3 adds

- **Source data verification.** A targeted (risk-based) or full SDV plan with a signature;
  the CRA compares each EDC value with the source document, verifies or queries; a later
  change voids the verification.
- **Protocol deviations.** A DV log fed automatically when a query on a deviation-type check
  closes with the data confirmed, plus manual entries; each deviation classed important or
  not against the study's deviation plan, and counted per site.
- **Centralised monitoring** (ICH E6(R3) 3.11.4.2). Seven key risk indicators per site
  against the other sites: AE rate, terminal-digit preference, copied values, entry lag,
  query rate, query response time and missing data. Flags are reviewed and either acted on
  (for-cause visit, retraining, escalation) or explained. A for-cause visit at the
  under-reporting site finds the AEs that never reached the EDC.
- **Quality tolerance limits** (3.10) measured live, with warnings, breaches and a signed
  breach record of root cause and corrective action.
- **Study dashboard.** Per-site entry lag, missing pages, active and ageing queries, SDV
  progress, coding backlog and deviations.
- **Missions M9 and M10.** Spot the suspicious sites; Keep within the QTLs.

## What Phase 4 adds

- **Database lock.** A checklist with live evidence for each item: all data entered, all
  queries closed, SDV complete, coding approved, SAE and vendor reconciliations signed,
  deviations classified, investigator casebook signatures current, audit trail review
  recorded, privacy check passed. Soft lock (data change only in answer to an open query),
  then hard lock with the lead data manager's and the sponsor's signatures.
- **Unlock procedure.** A justified request naming the subjects, two approvals, the change
  made through the usual query, then re-lock with the checklist met again. Only the named
  subjects can change while unlocked.
- **Archive.** A ZIP of open-format files: one CDASH-style CSV per form, the audit trail and
  every item version, edit checks, form metadata, coding, queries, deviations, signatures
  and the lock record, with a retention date (25 years) and a checksum. A CDASH-style CSV
  export is also available at any time from the Project tab.
- **Missions M11 and M12** (Lock on time; Unlock correctly), each in a prepared project of
  its own, and a **certificate** for ten missions passed at 70% or more, with a
  verification code.
- **Links** to the companion apps (Clinical Trial Simulator, eCTD Dossier Builder, the PV
  apps, the [EDC Study Build Lab](https://randomthingsonlineatsk-cloud.github.io/edc-study-build-lab/) (whose released study build file this console imports), the [Medical Coding Trainer](https://randomthingsonlineatsk-cloud.github.io/medical-coding-trainer/) (same training dictionaries), the SDTM Mapping Trainer
  and the planned TLF Programming Lab).
- **Several projects** in one browser, with a switcher on the Project tab.

## Added after Phase 4

- **Mission M13, Audit the trail:** review a 20-entry audit-trail extract from a fictional
  site eSource system and name the ALCOA+ attribute each planted entry breaks. Every entry
  of the console's own audit trail is labelled with the attributes it demonstrates.
- **Levels:** guided (tips, a progress check, 50% more time), standard, and expert (no tips,
  25% less time, mistakes cost double). The pass mark is 70% at every level.
- **A prepared project for every mission**, with the mission sizes from the spec: a
  12-check UAT release with 2 faulty checks, 10 poor queries to rewrite, 30 AE verbatims to
  code with auto-coding off.
- **Forms:** a CDASH DV (protocol deviation) eCRF form behind the deviation log; drug
  accountability (tablets dispensed and returned, derived compliance, a check on 80–120%);
  unscheduled visits with a reason and their own listing.
- **Field-level CRF completion guidelines:** every eCRF field has its own instruction, shown
  in the casebook, in the edit dialog and on the Start-up tab, with its format, unit, codelist
  and whether it is required.
- **Interim lock:** clean and freeze data up to a cut-off and take a signed snapshot while
  the database stays open.
- **Keyboard use:** dialogs take focus, keep Tab inside, close on Escape and return focus;
  tabs follow the arrow-key pattern; focus is always visible. `e2e/keyboard.cjs` walks the
  main flows with the keyboard only.

- **Study build files:** export the study (visits, forms, codelists, edit checks, CRF
  completion guidelines) as a `cdm-study-build` file, or import an amended one from a build
  tool. The import is checked against the protocol and needs the lead data manager's
  signature; it voids the UAT sign-off. Format: `docs/study-build-format.md`.
- **Classroom mode (optional):** an instructor creates a class and sets missions as
  assignments with a level and a due date; students join with a code, run the mission in its
  prepared project and submit it. The instructor re-scores each submission in their own
  browser with the app's scoring, comments, and sees a leaderboard. It uses the shared
  classroom server (Cloudflare Worker and D1) kept in the
  [eCTD Dossier Builder](https://github.com/randomthingsonlineatsk-cloud/ectd-dossier-builder)
  repository, routes under `/cdm/v1`. Set `VITE_CLASSROOM_API` at build time to use your own.

## What Phase 5 adds: a vaccine trial with an e-diary

Start it from Project → Start a new project → "vaccine trial with e-diary (ALV-3-301)".

- **The study:** an observer-blind, randomised 2:1, placebo-controlled phase 3 trial of a
  fictional two-dose respiratory vaccine in healthy adults, 60 participants at 4 sites,
  doses on Day 1 and Day 29, phone contacts on Days 8 and 36, follow-up to Day 181.
- **E-diary** for 7 days after each dose (oral temperature, redness and swelling in mm,
  pain and seven systemic reactions, medicines taken, medical visits), each day open until
  12:00 the next day. Grades are derived on the FDA *Toxicity Grading Scale for Healthy
  Adult and Adolescent Volunteers Enrolled in Preventive Vaccine Clinical Trials* (2007).
- **Compliance** by participant and day, with alerts to sites while a day is still open; a
  device that does not sync shows up as late uploads.
- **Corrections (DCF):** diary data are electronic source and cannot be edited by data
  management. A change goes to the diary vendor through a data clarification form only
  with a contemporaneous source, as the EMA *Guideline on computerised systems and
  electronic data in clinical trials* (2023, Annex 5) describes; the rest are returned.
- **Vendor transfers**, **reconciliation** (diary against the eCRF continuing-reaction,
  medication and AE records, the vendor's device links, and the central lab) and the
  **immunogenicity** transfer (titres below the lower limit of quantification, haemolysed
  and missing samples).
- **Blinding:** the data management team never sees the allocation; only the unblinded
  pharmacist (Lena Haas, PIN 9999) can, and viewing it is audited.
- **Missions M14 to M17:** keep the diary complete, correct participant data, reconcile the
  diary, and review an e-diary audit trail. The certificate counts passes on either study
  (ten of seventeen).

## ICH E6(R3) Annex 2: decentralised elements and real-world data

ICH E6(R3) Annex 2 (additional considerations for decentralised elements, pragmatic elements
and real-world data) reached Step 4 on 3 June 2026; EMA applies it from 15 January 2027.

- **Mission M18, Review decentralised data:** protocol amendment 2 of HLV-204-201 adds remote
  consent, Week 8 home nursing visits, direct-to-participant shipment of the investigational
  product, a connected home blood-pressure monitor (a digital health technology) and, at one
  site, an electronic health record extract. A data-source map sets out each stream's
  provider, how its data arrive, how the investigator keeps oversight, and what the protocol
  requires. The learner reviews 30 records (6 per stream) and chooses one action for each: no
  issue, a site query, a clarification to the service provider, escalation to the
  investigator, a protocol deviation, escalation to the sponsor, or recording that the data
  are not fit for use. Every answer cites the Annex 2 section behind it (for example 2.2.1
  identity checks for remote consent, 2.4.1 delegation of home nurses, 3.6.2 shipment only
  after investigator authorisation, 3.9.1 DHT safety alerts, 3.5.1(c) linkage, 3.4.2 consent
  to use health records).
- The certificate counts passes across all missions (ten needed).

Source: ICH E6(R3) Annex 2, Step 4, 3 June 2026,
https://database.ich.org/sites/default/files/ICH_E6(R3)_Annex%202_Guideline_Step%204_2026_0603_0.pdf

## ICH M11 protocol and the Protocol-to-Database Twin

ICH M11 (the Clinical electronic Structured Harmonised Protocol, CeSHarP) reached Step 4 on
19 November 2025; EMA's Step 5 guideline, template and technical specification apply from 11
June 2026.

- **Protocol twin tab:** HLV-204-201's protocol held as data in the M11 structure (title page,
  1.1.2 overall design, section 3 objectives and estimands, 5.2 and 5.3 criteria, the 1.3
  schedule of activities with windows, and the statements from other sections the build
  depends on), traced to the database build field by field. The twin lists procedures the
  build does not collect, forms and fields the build collects that no procedure needs (with
  the data points each costs), windows and eligibility criteria that disagree, and places
  where the protocol contradicts itself.
- **Data burden:** data points per participant and for the study, form instances, edit checks,
  expected queries and query hours, for the build, for what the protocol asks, and for
  proposed changes (drop a visit, add PK sampling, ambulatory BP, a questionnaire, more labs).
  The query rate and time per query are assumptions the user sets.
- **Core edit checks generated from the protocol** (windows, criteria, ranges, required
  fields), each traced to its M11 section, and the structured protocol as JSON.
- **Mission M19, Twin the protocol:** decide for each of the twelve findings whether to change
  the build, stop collecting, raise it with the protocol author, or keep it as it is.

Source: ICH M11 CeSHarP template, Step 5 (EMA/CHMP/ICH/778801/2022),
https://www.ema.europa.eu/en/documents/template-form/ich-m11-clinical-electronic-structured-harmonised-protocol-cesharp-template-step-5_en.pdf

All five phases and the additions are complete.

## Run it

```bash
npm install
npm run dev      # local development
npm test         # domain tests (Vitest)
npm run build    # production build in dist/
```

React 19, TypeScript, Vite and Tailwind CSS. Everything runs in the browser; only classroom
mode talks to a server.

## Licence

Apache License 2.0. See `LICENSE` and `NOTICE`.

Built by Khan Gulrez Shagufa Fazal Ahmed.
