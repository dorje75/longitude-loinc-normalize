import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchAnalyte, normalizeName } from "../src/loinc";

function loincFor(name: string): string | null {
  const result = matchAnalyte(name);
  return result.matched ? result.analyte.loinc : null;
}

describe("normalizeName", () => {
  it("strips punctuation and collapses whitespace", () => {
    assert.equal(normalizeName("Cholesterol, Total"), "cholesterol total");
    assert.equal(normalizeName("ALT (SGPT)"), "alt sgpt");
    assert.equal(normalizeName("  Vitamin  B-12 "), "vitamin b 12");
  });
});

describe("matchAnalyte", () => {
  it("maps every spelling of haemoglobin to one code", () => {
    for (const name of ["Haemoglobin", "Hemoglobin", "Hb", "HGB", "Haemoglobin (Hb)"]) {
      assert.equal(loincFor(name), "718-7", `failed on ${name}`);
    }
  });

  it("maps SGPT and ALT to the same code", () => {
    assert.equal(loincFor("SGPT"), "1742-6");
    assert.equal(loincFor("ALT"), "1742-6");
    assert.equal(loincFor("ALT (SGPT)"), "1742-6");
    assert.equal(loincFor("Alanine Aminotransferase"), "1742-6");
  });

  it("maps the many names for HbA1c", () => {
    for (const name of [
      "HbA1c",
      "Glycated Haemoglobin",
      "Glycosylated Hb (HbA1c)",
      "Haemoglobin A1c",
    ]) {
      assert.equal(loincFor(name), "4548-4", `failed on ${name}`);
    }
  });

  it("maps fasting glucose under its many local names", () => {
    for (const name of [
      "Glucose, Fasting",
      "Fasting Blood Sugar",
      "FBS",
      "Blood Sugar (Fasting)",
    ]) {
      assert.equal(loincFor(name), "1558-6", `failed on ${name}`);
    }
  });

  it("does not confuse HDL cholesterol with total cholesterol", () => {
    // The single most dangerous mistake this layer could make. Both names
    // contain "cholesterol" and word overlap alone would merge them.
    assert.equal(loincFor("Cholesterol, Total"), "2093-3");
    assert.equal(loincFor("Total Cholesterol"), "2093-3");
    assert.equal(loincFor("Cholesterol"), "2093-3");

    assert.equal(loincFor("HDL Cholesterol"), "2085-9");
    assert.equal(loincFor("Cholesterol, HDL"), "2085-9");
    assert.equal(loincFor("HDL"), "2085-9");

    assert.notEqual(loincFor("HDL Cholesterol"), loincFor("Total Cholesterol"));
  });

  it("ignores filler words labs add", () => {
    assert.equal(loincFor("Serum Creatinine"), "2160-0");
    assert.equal(loincFor("Creatinine, Serum"), "2160-0");
    assert.equal(loincFor("Creatinine Level"), "2160-0");
    assert.equal(loincFor("Serum Triglycerides"), "2571-8");
  });

  it("handles the micro and hyphen variants of vitamin names", () => {
    for (const name of [
      "Vitamin B12",
      "Vitamin B-12",
      "Vit B12",
      "Cobalamin",
    ]) {
      assert.equal(loincFor(name), "2132-9", `failed on ${name}`);
    }
    for (const name of [
      "Vitamin D, 25-Hydroxy",
      "25-OH Vitamin D",
      "25 Hydroxy Vitamin D",
      "Vitamin D (25-OH)",
    ]) {
      assert.equal(loincFor(name), "1989-3", `failed on ${name}`);
    }
  });

  it("scores an exact alias higher than a fuzzy one", () => {
    const exact = matchAnalyte("TSH");
    const fuzzy = matchAnalyte("TSH Ultrasensitive Assay");
    assert.ok(exact.matched && fuzzy.matched);
    assert.equal(exact.confidence, 1);
    assert.ok(fuzzy.confidence < exact.confidence);
  });

  it("refuses to guess at tests it does not know", () => {
    for (const name of ["Widal Test", "Dengue NS1 Antigen", "", "xyz"]) {
      const result = matchAnalyte(name);
      assert.equal(result.matched, false, `should not have matched ${name}`);
    }
  });

  it("never maps a fasting test onto a non fasting one", () => {
    // "Glucose, Fasting" and a hypothetical random glucose share every word
    // except the discriminating one, which must be enough to keep them apart.
    const fasting = matchAnalyte("Glucose Fasting");
    const random = matchAnalyte("Glucose Random");
    assert.ok(fasting.matched);
    assert.equal(random.matched, false);
  });
});
