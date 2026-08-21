import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REVIEW_THRESHOLD,
  normalizeObservation,
  type RawObservation,
} from "../src";

function raw(overrides: Partial<RawObservation> = {}): RawObservation {
  return {
    analyteRaw: "Haemoglobin",
    valueRaw: 13.8,
    unitRaw: "g/dL",
    refLowRaw: 13.0,
    refHighRaw: 17.0,
    extractionConfidence: 1,
    ...overrides,
  };
}

const close = (actual: number, expected: number, tolerance = 0.05) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual}`,
  );

describe("normalizeObservation", () => {
  it("normalises a straightforward row", () => {
    const result = normalizeObservation(raw());
    assert.ok(result.ok);
    assert.equal(result.observation.loincCode, "718-7");
    close(result.observation.canonicalValue, 138);
    assert.equal(result.observation.canonicalUnit, "g/L");
    assert.equal(result.observation.needsReview, false);
  });

  it("converts the reference bounds with the value, not separately", () => {
    const result = normalizeObservation(raw());
    assert.ok(result.ok);
    close(result.observation.refLowCanonical!, 130);
    close(result.observation.refHighCanonical!, 170);
    // The value must still sit inside its own band after conversion. If bounds
    // were converted differently, a healthy result would look abnormal.
    assert.ok(result.observation.canonicalValue > result.observation.refLowCanonical!);
    assert.ok(result.observation.canonicalValue < result.observation.refHighCanonical!);
  });

  it("puts two labs' versions of one test onto the same scale", () => {
    // This is the entire premise of the project in one test. Ladakh prints
    // mg/dL, Himalaya prints mmol/L, and both describe the same person.
    const conventional = normalizeObservation(
      raw({ analyteRaw: "Glucose, Fasting", valueRaw: 92, unitRaw: "mg/dL", refLowRaw: 70, refHighRaw: 100 }),
    );
    const si = normalizeObservation(
      raw({ analyteRaw: "Blood Sugar (Fasting)", valueRaw: 5.11, unitRaw: "mmol/L", refLowRaw: 3.9, refHighRaw: 5.6 }),
    );

    assert.ok(conventional.ok && si.ok);
    assert.equal(conventional.observation.loincCode, si.observation.loincCode);
    assert.equal(conventional.observation.canonicalUnit, si.observation.canonicalUnit);
    // Same measurement, so the two canonical values must be within rounding.
    close(conventional.observation.canonicalValue, si.observation.canonicalValue, 0.02);
  });

  it("handles a one sided reference range", () => {
    const result = normalizeObservation(
      raw({ analyteRaw: "Cholesterol, Total", valueRaw: 177, unitRaw: "mg/dL", refLowRaw: null, refHighRaw: 200 }),
    );
    assert.ok(result.ok);
    assert.equal(result.observation.refLowCanonical, null);
    close(result.observation.refHighCanonical!, 5.17, 0.02);
  });

  it("sends a row for review when the model was unsure", () => {
    const result = normalizeObservation(raw({ extractionConfidence: 0.5 }));
    assert.ok(result.ok);
    assert.equal(result.observation.needsReview, true);
    assert.ok(result.observation.confidence < REVIEW_THRESHOLD);
  });

  it("sends a row for review when the name only matched fuzzily", () => {
    const result = normalizeObservation(
      raw({ analyteRaw: "TSH Ultrasensitive Assay", valueRaw: 2.1, unitRaw: "mIU/L", refLowRaw: null, refHighRaw: null }),
    );
    assert.ok(result.ok);
    assert.equal(result.observation.needsReview, true);
    assert.ok(result.observation.notes.some((n) => n.includes("matched")));
  });

  it("refuses a test it does not recognise", () => {
    const result = normalizeObservation(raw({ analyteRaw: "Dengue NS1 Antigen" }));
    assert.equal(result.ok, false);
  });

  it("refuses a unit that makes no sense for the test", () => {
    const result = normalizeObservation(raw({ unitRaw: "mIU/L" }));
    assert.equal(result.ok, false);
  });

  it("catches an implausible result rather than charting it", () => {
    // 138 wrongly printed as g/dL would convert to 1380 g/L.
    const result = normalizeObservation(raw({ valueRaw: 138, unitRaw: "g/dL" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /plausible/);
  });

  it("records that a conversion happened", () => {
    const result = normalizeObservation(raw());
    assert.ok(result.ok);
    assert.ok(result.observation.notes.some((n) => n.includes("Converted")));
  });

  it("adds no conversion note when none was needed", () => {
    const result = normalizeObservation(
      raw({ analyteRaw: "Hemoglobin", valueRaw: 138, unitRaw: "g/L", refLowRaw: 130, refHighRaw: 170 }),
    );
    assert.ok(result.ok);
    assert.ok(!result.observation.notes.some((n) => n.includes("Converted")));
  });

  it("is deterministic", () => {
    const a = normalizeObservation(raw());
    const b = normalizeObservation(raw());
    assert.deepEqual(a, b);
  });
});
