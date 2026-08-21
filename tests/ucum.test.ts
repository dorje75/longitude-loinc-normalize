import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BY_KEY } from "../src/registry";
import { canonicalUnit, convert, isPlausible } from "../src/ucum";

const glucose = BY_KEY.get("glucose_fasting")!;
const cholesterol = BY_KEY.get("cholesterol_total")!;
const creatinine = BY_KEY.get("creatinine")!;
const hba1c = BY_KEY.get("hba1c")!;
const tsh = BY_KEY.get("tsh")!;
const haemoglobin = BY_KEY.get("haemoglobin")!;

const close = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual}`,
  );

describe("canonicalUnit", () => {
  it("accepts the casing labs actually print", () => {
    assert.equal(canonicalUnit("mg/dL"), "mg/dL");
    assert.equal(canonicalUnit("MG/DL"), "mg/dL");
    assert.equal(canonicalUnit("mg/dl"), "mg/dL");
    assert.equal(canonicalUnit("mg / dL"), "mg/dL");
  });

  it("treats every way of writing micro as the same unit", () => {
    assert.equal(canonicalUnit("µmol/L"), "umol/L");
    assert.equal(canonicalUnit("μmol/L"), "umol/L");
    assert.equal(canonicalUnit("umol/L"), "umol/L");
    assert.equal(canonicalUnit("mcmol/L"), "umol/L");
  });

  it("handles the older percent style units", () => {
    assert.equal(canonicalUnit("gm%"), "g%");
    assert.equal(canonicalUnit("mg%"), "mg/dL");
  });

  it("returns empty string when no unit was printed", () => {
    assert.equal(canonicalUnit(""), "");
  });

  it("refuses to guess at units it does not know", () => {
    assert.equal(canonicalUnit("10^3/uL"), null);
    assert.equal(canonicalUnit("bananas"), null);
  });
});

describe("convert", () => {
  it("converts glucose mg/dL to mmol/L", () => {
    const result = convert(glucose, 90, "mg/dL");
    assert.ok(result.ok);
    close(result.value, 5.0, 0.02);
    assert.equal(result.unit, "mmol/L");
    assert.equal(result.converted, true);
  });

  it("leaves a value alone when it is already canonical", () => {
    const result = convert(glucose, 5.1, "mmol/L");
    assert.ok(result.ok);
    assert.equal(result.value, 5.1);
    assert.equal(result.converted, false);
  });

  it("uses a different factor for cholesterol than for glucose", () => {
    // The point of per analyte factors. Same input, same units, different
    // answers, because the molar masses differ.
    const g = convert(glucose, 100, "mg/dL");
    const c = convert(cholesterol, 100, "mg/dL");
    assert.ok(g.ok && c.ok);
    close(g.value, 5.55, 0.02);
    close(c.value, 2.586, 0.02);
    assert.notEqual(g.value, c.value);
  });

  it("converts HbA1c percent to mmol/mol affinely, not by a factor", () => {
    const a = convert(hba1c, 5.0, "%");
    const b = convert(hba1c, 10.0, "%");
    assert.ok(a.ok && b.ok);
    close(a.value, 31.1, 0.1);
    close(b.value, 85.8, 0.1);

    // With y = (x - 2.15) * 10.929, doubling x overshoots double y by exactly
    // the offset times the slope. A plain multiplier would give a difference
    // of zero, so this is what catches someone "simplifying" the conversion
    // into a lookup table of factors.
    const overshoot = b.value - a.value * 2;
    close(overshoot, 2.15 * 10.929, 0.01);
    assert.ok(overshoot > 0, "conversion is behaving like a plain factor");
  });

  it("keeps the number unchanged across equivalent TSH units", () => {
    const a = convert(tsh, 2.4, "uIU/mL");
    const b = convert(tsh, 2.4, "mIU/L");
    const c = convert(tsh, 2.4, "µIU/mL");
    assert.ok(a.ok && b.ok && c.ok);
    assert.equal(a.value, 2.4);
    assert.equal(b.value, 2.4);
    assert.equal(c.value, 2.4);
  });

  it("round trips creatinine through both directions", () => {
    const result = convert(creatinine, 0.92, "mg/dL");
    assert.ok(result.ok);
    close(result.value, 81.3, 0.2);
  });

  it("rejects a unit the test is never reported in", () => {
    const result = convert(glucose, 90, "U/L");
    assert.ok(!result.ok);
    assert.match(result.reason, /not a unit/);
  });

  it("rejects units it does not recognise at all", () => {
    const result = convert(glucose, 90, "gallons");
    assert.ok(!result.ok);
    assert.match(result.reason, /Unrecognised/);
  });

  it("refuses an unlabelled value when the test has several possible units", () => {
    const result = convert(glucose, 90, "");
    assert.ok(!result.ok);
    assert.match(result.reason, /more than one possible unit/);
  });

  it("rejects values that are not numbers", () => {
    assert.ok(!convert(glucose, Number.NaN, "mg/dL").ok);
    assert.ok(!convert(glucose, Number.POSITIVE_INFINITY, "mg/dL").ok);
  });
});

describe("isPlausible", () => {
  it("accepts ordinary results", () => {
    assert.ok(isPlausible(haemoglobin, 145));
    assert.ok(isPlausible(glucose, 5.2));
  });

  it("catches a value that was converted the wrong way", () => {
    // 14.5 g/dL wrongly treated as already being g/L.
    assert.ok(!isPlausible(haemoglobin, 14.5));
    // Glucose left in mg/dL when it should have been converted.
    assert.ok(!isPlausible(glucose, 90));
  });
});
