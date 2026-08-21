/**
 * The analyte registry: what Longitude knows how to normalise.
 *
 * This is written independently of scripts/synthetic. The generator encodes
 * the same real world facts, but from a separate file on purpose. If both
 * sides shared one table, a wrong conversion factor would cancel itself out
 * and the evaluation would report success while every chart was wrong.
 *
 * LOINC codes and long names below were checked against the LOINC 2.82 core
 * table, not recalled from memory.
 */

export type Converter = (value: number) => number;

export type UnitRule = {
  /** UCUM spelling this rule accepts, after the unit string is tidied up. */
  unit: string;
  /** Into the analyte's canonical unit. Identity when already canonical. */
  toCanonical: Converter;
};

export type AnalyteDefinition = {
  loinc: string;
  /** LOINC long common name, for display and for the docs. */
  loincName: string;
  key: string;
  /** What Longitude calls this test, regardless of what the lab printed. */
  display: string;
  canonicalUnit: string;
  /**
   * Names labs actually print. Deliberately wider than anything the generator
   * produces, so mapping is tested against more than it was built from.
   */
  aliases: string[];
  units: UnitRule[];
  /** Sanity bounds in canonical units. Outside these, something went wrong. */
  plausible: { min: number; max: number };
};

const identity: Converter = (v) => v;
const by = (factor: number): Converter => (v) => v * factor;

export const REGISTRY: AnalyteDefinition[] = [
  {
    loinc: "718-7",
    loincName: "Hemoglobin [Mass/volume] in Blood",
    key: "haemoglobin",
    display: "Haemoglobin",
    canonicalUnit: "g/L",
    aliases: [
      "haemoglobin",
      "hemoglobin",
      "hb",
      "hgb",
      "haemoglobin hb",
      "hemoglobin hb",
      "blood haemoglobin",
      "haemoglobin estimation",
    ],
    units: [
      { unit: "g/dL", toCanonical: by(10) },
      { unit: "g/L", toCanonical: identity },
      { unit: "g%", toCanonical: by(10) },
    ],
    plausible: { min: 20, max: 250 },
  },
  {
    loinc: "1558-6",
    loincName: "Fasting glucose [Mass/volume] in Serum or Plasma",
    key: "glucose_fasting",
    display: "Fasting glucose",
    canonicalUnit: "mmol/L",
    aliases: [
      "glucose fasting",
      "fasting glucose",
      "fasting blood sugar",
      "fbs",
      "blood sugar fasting",
      "fasting blood glucose",
      "glucose fasting plasma",
      "sugar fasting",
      "plasma glucose fasting",
    ],
    units: [
      { unit: "mg/dL", toCanonical: by(0.0555) },
      { unit: "mmol/L", toCanonical: identity },
    ],
    plausible: { min: 1, max: 60 },
  },
  {
    loinc: "4548-4",
    loincName: "Hemoglobin A1c/Hemoglobin.total in Blood",
    key: "hba1c",
    display: "HbA1c",
    canonicalUnit: "mmol/mol",
    aliases: [
      "hba1c",
      "hb a1c",
      "haemoglobin a1c",
      "hemoglobin a1c",
      "glycated haemoglobin",
      "glycated hemoglobin",
      "glycosylated haemoglobin",
      "glycosylated hb hba1c",
      "glycated haemoglobin hba1c",
      "a1c",
    ],
    units: [
      // NGSP percent to IFCC mmol/mol. Affine, not a factor. A conversion
      // table of multipliers would get this silently wrong.
      { unit: "%", toCanonical: (v) => (v - 2.15) * 10.929 },
      { unit: "mmol/mol", toCanonical: identity },
    ],
    plausible: { min: 5, max: 200 },
  },
  {
    loinc: "2093-3",
    loincName: "Cholesterol [Mass/volume] in Serum or Plasma",
    key: "cholesterol_total",
    display: "Total cholesterol",
    canonicalUnit: "mmol/L",
    aliases: [
      "cholesterol total",
      "total cholesterol",
      "cholesterol",
      "serum cholesterol",
      "cholesterol serum total",
      "s cholesterol",
    ],
    units: [
      { unit: "mg/dL", toCanonical: by(0.02586) },
      { unit: "mmol/L", toCanonical: identity },
    ],
    plausible: { min: 0.5, max: 25 },
  },
  {
    loinc: "2085-9",
    loincName: "Cholesterol in HDL [Mass/volume] in Serum or Plasma",
    key: "hdl",
    display: "HDL cholesterol",
    canonicalUnit: "mmol/L",
    aliases: [
      "hdl cholesterol",
      "cholesterol hdl",
      "hdl",
      "hdl c",
      "high density lipoprotein",
      "high density lipoprotein cholesterol",
      "cholesterol in hdl",
    ],
    units: [
      { unit: "mg/dL", toCanonical: by(0.02586) },
      { unit: "mmol/L", toCanonical: identity },
    ],
    plausible: { min: 0.1, max: 6 },
  },
  {
    loinc: "2571-8",
    loincName: "Triglyceride [Mass/volume] in Serum or Plasma",
    key: "triglycerides",
    display: "Triglycerides",
    canonicalUnit: "mmol/L",
    aliases: [
      "triglycerides",
      "triglyceride",
      "serum triglycerides",
      "tg",
      "trigly",
      "triglycerides serum",
    ],
    units: [
      { unit: "mg/dL", toCanonical: by(0.01129) },
      { unit: "mmol/L", toCanonical: identity },
    ],
    plausible: { min: 0.1, max: 30 },
  },
  {
    loinc: "2160-0",
    loincName: "Creatinine [Mass/volume] in Serum or Plasma",
    key: "creatinine",
    display: "Creatinine",
    canonicalUnit: "umol/L",
    aliases: [
      "creatinine",
      "serum creatinine",
      "creatinine serum",
      "s creatinine",
      "creat",
    ],
    units: [
      { unit: "mg/dL", toCanonical: by(88.4) },
      { unit: "umol/L", toCanonical: identity },
      { unit: "mmol/L", toCanonical: by(1000) },
    ],
    plausible: { min: 10, max: 2000 },
  },
  {
    loinc: "3016-3",
    loincName: "Thyrotropin [Units/volume] in Serum or Plasma",
    key: "tsh",
    display: "TSH",
    canonicalUnit: "mIU/L",
    aliases: [
      "tsh",
      "thyroid stimulating hormone",
      "thyrotropin",
      "tsh ultrasensitive",
      "tsh ultra sensitive",
      "s tsh",
      "thyroid stimulating hormone tsh",
    ],
    units: [
      // These three are the same quantity written three ways. The number must
      // not change, which is easy to get wrong when a conversion layer assumes
      // different strings mean different scales.
      { unit: "mIU/L", toCanonical: identity },
      { unit: "uIU/mL", toCanonical: identity },
      { unit: "mU/L", toCanonical: identity },
    ],
    plausible: { min: 0.001, max: 500 },
  },
  {
    loinc: "1989-3",
    loincName: "25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma",
    key: "vitamin_d",
    display: "Vitamin D",
    canonicalUnit: "nmol/L",
    aliases: [
      "vitamin d 25 hydroxy",
      "25 oh vitamin d",
      "vitamin d 25 oh",
      "25 hydroxy vitamin d",
      "25 hydroxyvitamin d",
      "vitamin d total",
      "vitamin d",
      "calcidiol",
      "25 ohd",
    ],
    units: [
      { unit: "ng/mL", toCanonical: by(2.496) },
      { unit: "nmol/L", toCanonical: identity },
    ],
    plausible: { min: 1, max: 800 },
  },
  {
    loinc: "2132-9",
    loincName: "Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma",
    key: "vitamin_b12",
    display: "Vitamin B12",
    canonicalUnit: "pmol/L",
    aliases: [
      "vitamin b12",
      "vitamin b 12",
      "vit b12",
      "b12",
      "cobalamin",
      "cobalamins",
      "serum vitamin b12",
      "vitamin b12 cobalamin",
    ],
    units: [
      { unit: "pg/mL", toCanonical: by(0.7378) },
      { unit: "pmol/L", toCanonical: identity },
      { unit: "ng/L", toCanonical: by(0.7378) },
    ],
    plausible: { min: 10, max: 5000 },
  },
  {
    loinc: "1742-6",
    loincName: "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma",
    key: "alt",
    display: "ALT (SGPT)",
    canonicalUnit: "U/L",
    aliases: [
      "alt sgpt",
      "sgpt",
      "alt",
      "alanine aminotransferase",
      "sgpt alt",
      "alanine transaminase",
      "alt sgpt serum",
    ],
    units: [
      { unit: "U/L", toCanonical: identity },
      { unit: "IU/L", toCanonical: identity },
    ],
    plausible: { min: 0, max: 5000 },
  },
];

export const BY_LOINC = new Map(REGISTRY.map((a) => [a.loinc, a]));
export const BY_KEY = new Map(REGISTRY.map((a) => [a.key, a]));
