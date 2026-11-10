# Study build file format (`cdm-study-build`, version 1)

The hand-over between a study build tool (the EDC Study Build Lab, or any other tool)
and the CDM Query & Edit-Check Console. One JSON file describes the study's data collection:
the visit schedule, the eCRF forms, the codelists, the edit checks and the CRF completion
guidelines. Export the current build from the console (Project → Study build) to get a
complete, valid example.

```json
{
  "format": "cdm-study-build",
  "version": 1,
  "study": { "protocol": "HLV-204-201", "title": "…", "buildVersion": "1.1", "source": "EDC Study Build Lab" },
  "visits": [ { "id": "W4", "name": "Week 4", "day": 29, "lo": 26, "hi": 32, "forms": ["SV", "VS", "LB", "LBC", "EX"] } ],
  "forms": { "VS": { "id": "VS", "name": "Vital signs", "domain": "VS", "fields": [
    { "id": "SYSBP", "label": "Systolic blood pressure (seated)", "type": "number", "unit": "mmHg", "required": true, "ctq": true }
  ] } },
  "codelists": { "NY": [ { "value": "Y", "label": "Yes" }, { "value": "N", "label": "No" } ] },
  "checks": [ {
    "id": "VS-07", "title": "Systolic BP outside 80 to 220 mmHg", "category": "range", "action": "query",
    "form": "VS", "field": "SYSBP", "expr": "SYSBP < 80 or SYSBP > 220",
    "message": "Systolic BP is {SYSBP} mmHg, outside the expected range of 80 to 220 mmHg. Please verify against the source document.",
    "tests": [ { "name": "1480 fires", "values": { "SYSBP": "1480" }, "fire": true }, { "name": "148 passes", "values": { "SYSBP": "148" }, "fire": false } ],
    "active": true
  } ],
  "ccg": { "general": ["…"], "forms": { "VS": ["…"] }, "fields": { "VS.SYSBP": "Seated, after 5 minutes of rest, mean of three readings…" } }
}
```

## Fields

- **visits**: `day` is the target study day (day 1 is randomisation); `lo` and `hi` are the window.
- **forms**: field `type` is `text`, `number`, `date`, `select` or `yn`; `codelist` names an entry
  in `codelists`; `showIf` hides a field unless another field has a value (`__visit` compares
  with the visit ID); `derived` marks a value the system sets; `ctq` marks critical-to-quality
  data, which targeted SDV covers. Field IDs are CDASHIG v2.3 variable names.
- **checks**: `category` is one of `missing`, `range`, `date`, `cross-form`, `protocol`,
  `derived`, `coding`; `action` is `query`, `autofix` (with `fix`, the derivation) or `coder`.
  `expr` is the console's check language (see `src/domain/expr.ts`): fields of the form by
  name, `and`/`or`/`not`, comparisons, `in (…)`, and the functions `present`, `isblank`, `any`,
  `all`, `days`, `year`, `abs`, `round`, `len`, `contains`, `upper`, `pattern`, `isdate`, plus the
  casebook functions `consent`, `rand`, `visdat`, `val`, `vis`, `today`, `winlo`, `winhi`,
  `prevvisdat`, `lastvisdat`, `prevdisp`, `prevdispdat`, `eos`, `eosdat`, `aecount`, `aematch`.
  `{FIELD}` in `message` inserts a value. Each check should have at least two test cases.
- **ccg**: the CRF completion guidelines. `general` lists study-wide conventions, `forms` gives
  instructions per form, and the optional `fields` gives one instruction per field, keyed
  `FORM.FIELD`. Field lines missing from a build keep the console's own text. The eCRF shows
  each field's line together with its format, unit, codelist and whether it is required.

## What an import may change

The console's simulated sites follow protocol HLV-204-201, so an import amends that study:

- **Allowed:** labels, required and critical-to-quality flags, visit windows, new fields on
  existing forms, new forms (the simulated sites do not enter them), new codelist values, new, changed, deactivated or removed edit checks, and
  new guideline text.
- **Refused:** a different protocol, removing a visit, form, field or codelist value, changing a
  field's type.

An import is approved with the lead data manager's signature, written to the audit trail, and
clears the UAT signature, because changed checks need new user acceptance testing.
