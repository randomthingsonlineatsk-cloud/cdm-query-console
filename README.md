# CDM Query & Edit-Check Console

A browser practice app for clinical data management on the run side of a study. You are the
data management team at a CRO for a fictional phase 2 hypertension trial, from start-up to
clean live data: the data management plan, the CRF completion guidelines, the data
validation specification and its UAT, the eCRF, automatic and manual queries, ageing and
metrics, and an ALCOA+ audit trail.

**Live app:** https://randomthingsonlineatsk-cloud.github.io/cdm-query-console/

Everything is fictional: the study HLV-204-201, Vasclarin (VSC-9), Halvern Therapeutics,
Marrowbridge Clinical, the six sites and all 60 subjects. Training only; not a validated
system; never enter real patient data.

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
  its own, and a **certificate** for ten of twelve missions passed at 70% or more, with a
  verification code.
- **Links** to the companion apps (Clinical Trial Simulator, eCTD Dossier Builder, the PV
  apps, and the planned EDC Study Build Lab, Medical Coding Trainer, SDTM Mapping Trainer
  and TLF Programming Lab).
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

All four phases and the additions are complete.

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
