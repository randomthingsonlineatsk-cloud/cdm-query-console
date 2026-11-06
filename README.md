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

## What is in Phase 1

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

Phase 4 adds database lock, unlock and archive, links to the companion apps, and the
certificate.

## Run it

```bash
npm install
npm run dev      # local development
npm test         # domain tests (Vitest)
npm run build    # production build in dist/
```

React 19, TypeScript, Vite and Tailwind CSS. Browser only; no server.

## Licence

Apache License 2.0. See `LICENSE` and `NOTICE`.

Built by Khan Gulrez Shagufa Fazal Ahmed.
