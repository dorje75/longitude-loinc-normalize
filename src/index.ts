import { matchAnalyte } from "./loinc";
import type { AnalyteDefinition } from "./registry";
import { convert, isPlausible } from "./ucum";

/**
 * The normalisation layer.
 *
 * Everything upstream of this is a model reading a page. Everything here is
 * deterministic: same input, same output, every time, and testable without a
 * network call. That split is the whole design.
 */

export type RawObservation = {
  analyteRaw: string;
  valueRaw: number;
  unitRaw: string | null;
  refLowRaw: number | null;
  refHighRaw: number | null;
  /** How sure the model was that it read this row correctly. */
  extractionConfidence: number;
};

export type NormalizedObservation = {
  loincCode: string;
  loincName: string;
  analyteKey: string;
  canonicalValue: number;
  canonicalUnit: string;
  refLowCanonical: number | null;
  refHighCanonical: number | null;
  /** Extraction confidence combined with how the name was matched. */
  confidence: number;
  needsReview: boolean;
  notes: string[];
};

export type NormalizeResult =
  | { ok: true; observation: NormalizedObservation }
  | { ok: false; reason: string; needsReview: true };

/**
 * Below this a row goes to a human instead of onto a chart. Set where a fuzzy
 * name match lands, because a guessed analyte is the failure that produces a
 * plausible looking but wrong trend line.
 */
export const REVIEW_THRESHOLD = 0.85;

export function normalizeObservation(raw: RawObservation): NormalizeResult {
  const notes: string[] = [];

  const match = matchAnalyte(raw.analyteRaw);
  if (!match.matched) {
    return { ok: false, reason: match.reason, needsReview: true };
  }

  const analyte: AnalyteDefinition = match.analyte;
  if (match.confidence < 1) notes.push(`Name matched by ${match.how}.`);

  const value = convert(analyte, raw.valueRaw, raw.unitRaw);
  if (!value.ok) {
    return { ok: false, reason: value.reason, needsReview: true };
  }
  if (value.converted) {
    notes.push(`Converted from ${raw.unitRaw} to ${analyte.canonicalUnit}.`);
  }

  if (!isPlausible(analyte, value.value)) {
    return {
      ok: false,
      reason: `${value.value.toFixed(2)} ${analyte.canonicalUnit} is outside the plausible range for this test.`,
      needsReview: true,
    };
  }

  // Reference bounds go through the same conversion as the value. Converting
  // one and not the other would put the band in the wrong place, which looks
  // like the patient is ill rather than like a bug.
  const refLow = convertBound(analyte, raw.refLowRaw, raw.unitRaw);
  const refHigh = convertBound(analyte, raw.refHighRaw, raw.unitRaw);

  if (raw.refLowRaw !== null && refLow === null) {
    notes.push("The lower reference bound could not be converted.");
  }
  if (raw.refHighRaw !== null && refHigh === null) {
    notes.push("The upper reference bound could not be converted.");
  }
  if (refLow !== null && refHigh !== null && refLow > refHigh) {
    notes.push("The reference range looks reversed.");
  }

  const confidence = raw.extractionConfidence * match.confidence;

  return {
    ok: true,
    observation: {
      loincCode: analyte.loinc,
      loincName: analyte.loincName,
      analyteKey: analyte.key,
      canonicalValue: value.value,
      canonicalUnit: analyte.canonicalUnit,
      refLowCanonical: refLow,
      refHighCanonical: refHigh,
      confidence,
      needsReview: confidence < REVIEW_THRESHOLD,
      notes,
    },
  };
}

function convertBound(
  analyte: AnalyteDefinition,
  bound: number | null,
  unitRaw: string | null,
): number | null {
  if (bound === null) return null;
  const result = convert(analyte, bound, unitRaw);
  return result.ok ? result.value : null;
}

export { matchAnalyte, normalizeName } from "./loinc";
export { canonicalUnit, convert, isPlausible } from "./ucum";
export { REGISTRY, BY_LOINC, BY_KEY } from "./registry";
export type { AnalyteDefinition } from "./registry";
