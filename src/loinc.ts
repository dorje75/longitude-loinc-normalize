import { REGISTRY, type AnalyteDefinition } from "./registry";

/**
 * Mapping a printed test name to a LOINC code.
 *
 * The trap this has to avoid: "Cholesterol", "Total Cholesterol" and
 * "HDL Cholesterol" are three strings that share most of their words but are
 * two different analytes with different LOINC codes. Any matching that works
 * purely on word overlap will happily map HDL onto total cholesterol, and the
 * resulting chart will look completely reasonable while being wrong.
 *
 * So exact alias matching comes first, and the fuzzy fallback is required to
 * be discriminating rather than merely close.
 */

/** Words that carry no meaning in a test name and appear everywhere. */
const NOISE = new Set([
  "serum",
  "plasma",
  "blood",
  "level",
  "levels",
  "test",
  "estimation",
  "quantitative",
  "measurement",
  "in",
  "of",
  "the",
  "by",
  "method",
  "s",
]);

/**
 * Words that must not be dropped or ignored, because they are the entire
 * difference between two analytes.
 */
const DISCRIMINATING = new Set([
  "hdl",
  "ldl",
  "vldl",
  "total",
  "direct",
  "indirect",
  "free",
  "fasting",
  "random",
  "postprandial",
  "pp",
  "a1c",
]);

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((word) => word.length > 0 && !NOISE.has(word));
}

const ALIAS_INDEX = new Map<string, AnalyteDefinition>();
for (const analyte of REGISTRY) {
  for (const alias of analyte.aliases) {
    ALIAS_INDEX.set(normalizeName(alias), analyte);
  }
}

export type MatchResult =
  | { matched: true; analyte: AnalyteDefinition; confidence: number; how: string }
  | { matched: false; reason: string };

/**
 * Confidence is about how the match was made, not how the model felt about
 * reading the text. Those are combined later.
 */
export function matchAnalyte(rawName: string): MatchResult {
  const normalized = normalizeName(rawName);
  if (normalized.length === 0) {
    return { matched: false, reason: "Empty test name." };
  }

  const exact = ALIAS_INDEX.get(normalized);
  if (exact) {
    return { matched: true, analyte: exact, confidence: 1, how: "exact alias" };
  }

  // Same words, noise removed. "Serum Creatinine Level" against "creatinine".
  const wanted = tokens(rawName);
  const wantedKey = wanted.join(" ");
  for (const analyte of REGISTRY) {
    for (const alias of analyte.aliases) {
      if (tokens(alias).join(" ") === wantedKey) {
        return {
          matched: true,
          analyte,
          confidence: 0.95,
          how: "alias after removing filler words",
        };
      }
    }
  }

  const wantedSet = new Set(wanted);
  let best: { analyte: AnalyteDefinition; score: number; alias: string } | null = null;

  for (const analyte of REGISTRY) {
    for (const alias of analyte.aliases) {
      const aliasTokens = tokens(alias);
      if (aliasTokens.length === 0) continue;

      const aliasSet = new Set(aliasTokens);
      const shared = aliasTokens.filter((token) => wantedSet.has(token)).length;
      if (shared === 0) continue;

      // A discriminating word present on one side but not the other means
      // these are different tests, however similar they look.
      const conflict = [...new Set([...wantedSet, ...aliasSet])].some(
        (token) =>
          DISCRIMINATING.has(token) && wantedSet.has(token) !== aliasSet.has(token),
      );
      if (conflict) continue;

      // Jaccard, so a long alias sharing one word does not beat a short exact one.
      const union = new Set([...wantedSet, ...aliasSet]).size;
      const score = shared / union;
      if (!best || score > best.score) best = { analyte, score, alias };
    }
  }

  if (best && best.score >= 0.6) {
    return {
      matched: true,
      analyte: best.analyte,
      // Scaled down, so a fuzzy match always ranks below an exact one and
      // tends to land in the review queue rather than straight on a chart.
      confidence: 0.5 + best.score * 0.35,
      how: `similar to "${best.alias}"`,
    };
  }

  return {
    matched: false,
    reason: `"${rawName}" is not a test Longitude recognises yet.`,
  };
}
