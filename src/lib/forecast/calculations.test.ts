import { describe, expect, it } from "vitest";

import { createDefaultForecastPlan } from "@/lib/forecast/constants";
import {
  buildAllForecastScenarios,
  computeFactYtdNet,
  monthlyNetPlan,
  normalizePartialMonthValue,
  ordersFromChannels,
} from "@/lib/forecast/calculations";
import { uniformSeasonalityWeights } from "@/lib/seasonality";

describe("normalizePartialMonthValue", () => {
  it("scales partial month to full month", () => {
    expect(normalizePartialMonthValue(100, "partial", 20, 31)).toBeCloseTo(155, 0);
  });

  it("returns value unchanged for closed month", () => {
    expect(normalizePartialMonthValue(100, "closed", 20, 31)).toBe(100);
  });
});

describe("monthlyNetPlan", () => {
  it("sums to annual target with seasonality", () => {
    const weights = uniformSeasonalityWeights();
    const plan = monthlyNetPlan(2_000_000_000, weights);
    expect(plan.reduce((a, b) => a + b, 0)).toBeCloseTo(2_000_000_000, 0);
  });
});

describe("buildAllForecastScenarios", () => {
  it("returns three scenarios with media above do nothing when plan has sessions", () => {
    const forecast = createDefaultForecastPlan();
    forecast.monthlyFacts[0] = {
      status: "closed",
      channels: {
        organic: { sessions: 1_000_000, cr: 0.02 },
      },
      atv: 2000,
      buyoutRate: 0.6,
    };
    forecast.lastFactMonth = 1;
    forecast.channels = forecast.channels.map((ch) =>
      ch.id === "media"
        ? {
            ...ch,
            includeInMediaScenario: true,
            activeFromMonth: 2,
            planSessions: Array.from({ length: 12 }, (_, i) => (i >= 1 ? 500_000 : 0)),
            planCr: Array.from({ length: 12 }, () => 0.015),
          }
        : ch,
    );

    const scenarios = buildAllForecastScenarios(forecast, uniformSeasonalityWeights());
    const doNothing = scenarios.find((s) => s.id === "do_nothing")!;
    const media = scenarios.find((s) => s.id === "media")!;

    expect(scenarios).toHaveLength(3);
    expect(media.annualNetRevenue).toBeGreaterThan(doNothing.annualNetRevenue);
    expect(computeFactYtdNet(forecast)).toBeGreaterThan(0);
    expect(ordersFromChannels(forecast.monthlyFacts[0].channels)).toBe(20_000);
  });
});
