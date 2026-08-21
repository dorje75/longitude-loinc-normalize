import type { AnalyteDefinition, UnitRule } from "./registry";

/**
 * Unit handling.
 *
 * Two separate jobs live here, and conflating them is the usual mistake.
 *
 * Tidying a unit string is analyte independent: "MG/DL", "mg/dl" and "mg / dL"
 * are all mg/dL no matter what was measured.
 *
 * Converting between units is not. mg/dL to mmol/L depends on the molar mass
 * of the substance, so glucose divides by 18 and cholesterol by 38.7. There is
 * no such thing as a general mg/dL to mmol/L conversion, which is why the
 * factors live on each analyte in registry.ts rather than in a global table.
 */

/** Micro can be written at least three ways, and labs use all of them. */
const MICRO = /[µμΜ]/g;

/**
 * Canonical spellings, keyed by the unit lowercased with separators removed.
 * Matching is case insensitive because labs print MG/DL, mg/dl and mg/dL, but
 * the value returned keeps proper UCUM casing.
 */
const SPELLINGS: Record<string, string> = {
  "g/dl": "g/dL",
  "gm/dl": "g/dL",
  "gms/dl": "g/dL",
  "g%": "g%",
  "gm%": "g%",
  "g/l": "g/L",
  "mg/dl": "mg/dL",
  "mgs/dl": "mg/dL",
  "mg%": "mg/dL",
  "mg/l": "mg/L",
  "mmol/l": "mmol/L",
  "mmol/mol": "mmol/mol",
  "umol/l": "umol/L",
  "mcmol/l": "umol/L",
  "nmol/l": "nmol/L",
  "pmol/l": "pmol/L",
  "ng/ml": "ng/mL",
  "ng/dl": "ng/dL",
  "ng/l": "ng/L",
  "pg/ml": "pg/mL",
  "mcg/dl": "ug/dL",
  "ug/dl": "ug/dL",
  "mcg/l": "ug/L",
  "ug/l": "ug/L",
  "u/l": "U/L",
  "iu/l": "IU/L",
  "ui/l": "IU/L",
  "miu/l": "mIU/L",
  "uiu/ml": "uIU/mL",
  "mciu/ml": "uIU/mL",
  "mu/l": "mU/L",
  "%": "%",
  "percent": "%",
  "": "",
};

/**
 * Turns whatever the lab printed into a canonical UCUM spelling.
 * Returns null when the unit is not recognised, which is a review case rather
 * than something to guess at.
 */
export function canonicalUnit(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  const cleaned = raw
    .replace(MICRO, "u")
    .replace(/\s+/g, "")
    .replace(/·/g, "")
    .toLowerCase();

  if (cleaned === "") return "";

  const known = SPELLINGS[cleaned];
  if (known !== undefined) return known;

  // "10^3/uL" style counts and anything else unrecognised.
  return null;
}

export type ConversionResult =
  | { ok: true; value: number; unit: string; converted: boolean }
  | { ok: false; reason: string };

function ruleFor(analyte: AnalyteDefinition, unit: string): UnitRule | undefined {
  return analyte.units.find((rule) => rule.unit === unit);
}

/**
 * Converts a value into the analyte's canonical unit.
 *
 * An empty unit is treated as "the lab did not print one", and is accepted
 * only when the analyte has a single possible unit. Guessing which of two
 * scales an unlabelled number is on would be exactly the kind of silent error
 * this layer exists to prevent.
 */
export function convert(
  analyte: AnalyteDefinition,
  value: number,
  rawUnit: string | null | undefined,
): ConversionResult {
  if (!Number.isFinite(value)) {
    return { ok: false, reason: "The value is not a number." };
  }

  const unit = canonicalUnit(rawUnit);
  if (unit === null) {
    return { ok: false, reason: `Unrecognised unit "${rawUnit}".` };
  }

  if (unit === "") {
    if (analyte.units.length !== 1) {
      return {
        ok: false,
        reason: "No unit was printed and this test has more than one possible unit.",
      };
    }
    const only = analyte.units[0];
    return {
      ok: true,
      value: only.toCanonical(value),
      unit: analyte.canonicalUnit,
      converted: only.unit !== analyte.canonicalUnit,
    };
  }

  const rule = ruleFor(analyte, unit);
  if (!rule) {
    return {
      ok: false,
      reason: `${unit} is not a unit this test is reported in.`,
    };
  }

  return {
    ok: true,
    value: rule.toCanonical(value),
    unit: analyte.canonicalUnit,
    converted: unit !== analyte.canonicalUnit,
  };
}

/** Catches conversions that produced something biologically impossible. */
export function isPlausible(analyte: AnalyteDefinition, canonical: number): boolean {
  return canonical >= analyte.plausible.min && canonical <= analyte.plausible.max;
}
