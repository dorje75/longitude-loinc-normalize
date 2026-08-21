# longitude-loinc-normalize

Reads a lab result the way a lab printed it, and gives you back a LOINC code and
a value in one consistent unit.

Built for [Longitude](https://longitude.montandpaix.com/preview), where it is
what lets one chart hold results from four different laboratories. That link is
a live demo with a few years of made up results in it. Nothing to sign up for
and nothing to install.

```ts
import { normalizeObservation } from "longitude-loinc-normalize";

const result = normalizeObservation({
  analyteRaw: "Fasting Blood Sugar",
  valueRaw: 92,
  unitRaw: "mg/dL",
  refLowRaw: 70,
  refHighRaw: 100,
  extractionConfidence: 1,
});

// result.observation
// {
//   loincCode: "1558-6",
//   canonicalValue: 5.106,
//   canonicalUnit: "mmol/L",
//   refLowCanonical: 3.885,
//   refHighCanonical: 5.55,
//   needsReview: false,
//   ...
// }
```

Give it the same test from a different lab, printed under a different name in a
different unit, and you get the same code and the same scale back.

```ts
normalizeObservation({
  analyteRaw: "Glucose, Fasting",
  valueRaw: 5.11,
  unitRaw: "mmol/L",
  // ...
});
// same loincCode, same canonicalUnit, value within rounding
```

No dependencies.

## Why this exists

Every lab prints results differently. One writes mg/dL, another writes mmol/L.
One calls a test SGPT, another calls it ALT. Each quotes its own idea of a
normal range. So if you change clinic, your old results and your new ones cannot
be put on the same chart, even though they measure the same thing.

This library does the boring part of fixing that: work out which test was
printed, and convert the number onto one scale.

It was pulled out of Longitude, a small app for keeping a family's lab reports
in one place, built because nobody in mine could answer a simple question like
whether a number had been climbing for three years.

## The parts that are not obvious

These are the cases that make this harder than a lookup table, and the reason
the library exists at all.

**HbA1c is not a multiplication.** Going from NGSP percent to IFCC mmol/mol is
`(percent - 2.15) * 10.929`. There is a subtraction in there. A conversion table
of multipliers gets HbA1c wrong every single time, and it gets it wrong quietly,
producing a number that looks plausible on a chart.

**Total cholesterol and HDL cholesterol are different tests.** They share most
of their words. Matching on word overlap merges them, and nothing looks broken
afterwards. The matcher keeps a list of words that make two tests different,
such as HDL, total, free and fasting, and refuses any match where one side has
such a word and the other does not.

**uIU/mL and mIU/L are the same number.** Different strings, identical scale. A
converter that assumes different unit strings mean different scales will helpfully
change a TSH result that was already correct.

**Conversion factors belong to the test, not the unit pair.** There is no general
mg/dL to mmol/L conversion. It depends on the molar mass of whatever was
measured, so glucose and cholesterol convert differently from the same pair of
units.

**A value that cannot be mapped is not silently dropped.** It comes back with a
reason, so a human can look at it. Results are also checked against a plausible
range, which catches a conversion that ran the wrong way.

## What it supports

| Test | LOINC | Canonical unit | Also accepts |
| --- | --- | --- | --- |
| Haemoglobin | 718-7 | g/L | g/dL, g% |
| Fasting glucose | 1558-6 | mmol/L | mg/dL |
| HbA1c | 4548-4 | mmol/mol | % |
| Total cholesterol | 2093-3 | mmol/L | mg/dL |
| HDL cholesterol | 2085-9 | mmol/L | mg/dL |
| Triglycerides | 2571-8 | mmol/L | mg/dL |
| Creatinine | 2160-0 | umol/L | mg/dL, mmol/L |
| TSH | 3016-3 | mIU/L | uIU/mL, mU/L |
| Vitamin D | 1989-3 | nmol/L | ng/mL |
| Vitamin B12 | 2132-9 | pmol/L | pg/mL, ng/L |
| ALT | 1742-6 | U/L | IU/L |

Each test also matches several printed names. ALT picks up SGPT, ALT (SGPT) and
Alanine Aminotransferase. Haemoglobin picks up Hemoglobin, Hb and HGB.

Adding a test means adding one entry to `src/registry.ts`.

## Also exported

```ts
import { matchAnalyte, convert, canonicalUnit, REGISTRY } from "longitude-loinc-normalize";

matchAnalyte("SGPT");        // { matched: true, analyte: {...}, confidence: 1 }
canonicalUnit("MG/DL");      // "mg/dL"
canonicalUnit("µmol/L");     // "umol/L"
canonicalUnit("bananas");    // null, it will not guess
```

## Tests

```bash
npm install
npm test
```

40 tests. They cover the four cases above directly, because those are the ones
that break quietly rather than loudly.

## Install

Not on npm yet. That is the plan. For now:

```bash
npm install github:dorje75/longitude-loinc-normalize
```

## A caution

This converts numbers and maps codes. It does not interpret results and it is
not medical advice. Reference ranges come from whatever the report printed, not
from any clinical authority.

## Licence

MIT. See [LICENSE](LICENSE).

LOINC codes are used under licence from Regenstrief Institute, Inc. See
[NOTICE.md](NOTICE.md).
