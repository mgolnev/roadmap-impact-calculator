import { describe, expect, it } from "vitest";

import { normalizeSeasonalityWeights, uniformSeasonalityWeights } from "@/lib/seasonality";

describe("normalizeSeasonalityWeights", () => {
  it("returns uniform weights for empty or invalid input", () => {
    const u = uniformSeasonalityWeights();
    expect(u).toHaveLength(12);
    expect(u.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    expect(normalizeSeasonalityWeights(undefined)).toEqual(u);
    expect(normalizeSeasonalityWeights([])).toEqual(u);
    expect(normalizeSeasonalityWeights([0, 0, 0])).toEqual(u);
  });

  it("normalizes positive values to sum 1", () => {
    const w = normalizeSeasonalityWeights([2, 2, ...Array(10).fill(1)]);
    expect(w).toHaveLength(12);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    expect(w[0]).toBeCloseTo(w[1], 8);
    expect(w[0]).toBeGreaterThan(w[2]);
  });
});
