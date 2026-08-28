import {
  ForecastPlan,
  MarketingChannelId,
  MarketingChannelPlan,
  MonthlyFactEntry,
} from "@/lib/types";

export const DEFAULT_ANNUAL_NET_TARGET = 2_000_000_000;

const emptyChannelMetrics = () => ({ sessions: 0, cr: 0 });

const emptyMonthlyFact = (): MonthlyFactEntry => ({
  status: "open",
  channels: {},
  atv: 0,
  buyoutRate: 0,
});

const defaultChannelPlan = (
  id: MarketingChannelId,
  activeFromMonth: number,
  includeInMediaScenario: boolean,
): MarketingChannelPlan => ({
  id,
  activeFromMonth,
  includeInMediaScenario,
  planSessions: Array.from({ length: 12 }, () => 0),
  planCr: Array.from({ length: 12 }, () => 0),
});

export const createDefaultForecastPlan = (): ForecastPlan => {
  const monthlyFacts = Array.from({ length: 12 }, (_, index) => {
    const fact = emptyMonthlyFact();
    if (index < 4) {
      fact.status = "closed";
    } else if (index === 4) {
      fact.status = "partial";
      fact.partialDays = 20;
      fact.daysInMonth = 31;
    }
    return fact;
  });

  return {
    annualNetTarget: DEFAULT_ANNUAL_NET_TARGET,
    lastFactMonth: 5,
    channels: [
      defaultChannelPlan("organic", 1, false),
      defaultChannelPlan("paid", 6, true),
      defaultChannelPlan("crm", 6, true),
      defaultChannelPlan("media", 6, true),
    ],
    monthlyFacts,
  };
};

export const emptyChannelMetricsExport = emptyChannelMetrics;
