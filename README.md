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

Later phases add coding review with fictional dictionaries, SAE and external-data
reconciliation, SDV and protocol deviations, centralised monitoring, database lock, unlock
and archive, links to the companion apps, and the certificate.

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
