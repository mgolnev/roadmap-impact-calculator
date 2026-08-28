import { getTrafficMultiplier, simulateScenario } from "@/lib/calculations";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import {
  BaselineInput,
  ChannelMonthlyMetrics,
  ForecastMonthRow,
  ForecastPlan,
  ForecastScenarioId,
  ForecastScenarioResult,
  MARKETING_CHANNEL_IDS,
  MarketingChannelId,
  MarketingChannelPlan,
  MonthlyFactEntry,
  MonthlyFactStatus,
  Task,
  TimelineMode,
} from "@/lib/types";

const safeDivide = (value: number, base: number) => (base > 0 ? value / base : 0);

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

export const normalizePartialMonthValue = (
  value: number,
  status: MonthlyFactStatus,
  partialDays?: number,
  daysInMonth?: number,
): number => {
  if (status !== "partial" || !partialDays || !daysInMonth || partialDays <= 0) {
    return value;
  }
  return value * (daysInMonth / partialDays);
};

const getChannelMetrics = (
  channels: Partial<Record<MarketingChannelId, ChannelMonthlyMetrics>>,
  id: MarketingChannelId,
): ChannelMonthlyMetrics => channels[id] ?? { sessions: 0, cr: 0 };

export const ordersFromChannels = (
  channels: Partial<Record<MarketingChannelId, ChannelMonthlyMetrics>>,
): number =>
  MARKETING_CHANNEL_IDS.reduce((total, id) => {
    const ch = getChannelMetrics(channels, id);
    return total + ch.sessions * ch.cr;
  }, 0);

export const sessionsFromChannels = (
  channels: Partial<Record<MarketingChannelId, ChannelMonthlyMetrics>>,
): number =>
  MARKETING_CHANNEL_IDS.reduce((total, id) => total + getChannelMetrics(channels, id).sessions, 0);

export const computeMonthRevenue = (orders: number, atv: number, buyoutRate: number) => {
  const grossRevenue = orders * atv;
  return {
    grossRevenue,
    netRevenue: grossRevenue * buyoutRate,
  };
};

export const monthlyNetPlan = (annualTarget: number, seasonalityWeights: number[]): number[] => {
  const weights = normalizeSeasonalityWeights(seasonalityWeights);
  return weights.map((weight) => annualTarget * weight);
};

type YtdAverages = {
  organicSessions: number;
  channelCr: Record<MarketingChannelId, number>;
  atv: number;
  buyoutRate: number;
};

const computeYtdAverages = (forecast: ForecastPlan): YtdAverages => {
  const organicSessions: number[] = [];
  const channelCrSums: Record<MarketingChannelId, { weighted: number; sessions: number }> =
    Object.fromEntries(
      MARKETING_CHANNEL_IDS.map((id) => [id, { weighted: 0, sessions: 0 }]),
    ) as Record<MarketingChannelId, { weighted: number; sessions: number }>;
  const atvValues: number[] = [];
  const buyoutValues: number[] = [];

  forecast.monthlyFacts.forEach((fact, index) => {
    const month = index + 1;
    if (month > forecast.lastFactMonth || fact.status === "open") return;

    const scale = (value: number) =>
      normalizePartialMonthValue(value, fact.status, fact.partialDays, fact.daysInMonth);

    MARKETING_CHANNEL_IDS.forEach((id) => {
      const ch = getChannelMetrics(fact.channels, id);
      const sessions = scale(ch.sessions);
      const orders = sessions * ch.cr;
      channelCrSums[id].weighted += orders;
      channelCrSums[id].sessions += sessions;
    });

    organicSessions.push(scale(getChannelMetrics(fact.channels, "organic").sessions));
    if (fact.atv > 0) atvValues.push(fact.atv);
    if (fact.buyoutRate > 0) buyoutValues.push(fact.buyoutRate);
  });

  return {
    organicSessions: organicSessions.length > 0 ? sum(organicSessions) / organicSessions.length : 0,
    channelCr: Object.fromEntries(
      MARKETING_CHANNEL_IDS.map((id) => [
        id,
        safeDivide(channelCrSums[id].weighted, channelCrSums[id].sessions),
      ]),
    ) as Record<MarketingChannelId, number>,
    atv: atvValues.length > 0 ? sum(atvValues) / atvValues.length : 0,
    buyoutRate: buyoutValues.length > 0 ? sum(buyoutValues) / buyoutValues.length : 0,
  };
};

const channelActiveInScenario = (
  channel: MarketingChannelPlan,
  month: number,
  scenario: ForecastScenarioId,
): boolean => {
  if (month < channel.activeFromMonth) return false;
  if (channel.id === "organic") return true;
  if (scenario === "do_nothing") return false;
  return channel.includeInMediaScenario;
};

const resolveChannelSessions = (
  channel: MarketingChannelPlan,
  monthIndex: number,
  scenario: ForecastScenarioId,
  ytd: YtdAverages,
  seasonalityWeights: number[],
): number => {
  const month = monthIndex + 1;
  if (!channelActiveInScenario(channel, month, scenario)) return 0;

  const planValue = channel.planSessions[monthIndex] ?? 0;
  if (planValue > 0) return planValue;

  if (channel.id === "organic" && ytd.organicSessions > 0) {
    const weights = normalizeSeasonalityWeights(seasonalityWeights);
    const avgWeight = sum(weights) / 12;
    const monthWeight = weights[monthIndex] ?? avgWeight;
    return ytd.organicSessions * safeDivide(monthWeight, avgWeight);
  }

  return 0;
};

const resolveChannelCr = (
  channel: MarketingChannelPlan,
  monthIndex: number,
  ytd: YtdAverages,
): number => {
  const planCr = channel.planCr[monthIndex] ?? 0;
  if (planCr > 0) return planCr;
  return ytd.channelCr[channel.id] ?? 0;
};

const buildForecastMonth = (
  monthIndex: number,
  forecast: ForecastPlan,
  scenario: ForecastScenarioId,
  ytd: YtdAverages,
  seasonalityWeights: number[],
  planNetByMonth: number[],
  roadmapOrderMultiplier: number,
): ForecastMonthRow => {
  const month = monthIndex + 1;
  const fact = forecast.monthlyFacts[monthIndex];
  const isFactMonth = month <= forecast.lastFactMonth && fact.status !== "open";

  if (isFactMonth) {
    const scale = (value: number) =>
      normalizePartialMonthValue(value, fact.status, fact.partialDays, fact.daysInMonth);

    const channelSessions = Object.fromEntries(
      MARKETING_CHANNEL_IDS.map((id) => [
        id,
        scale(getChannelMetrics(fact.channels, id).sessions),
      ]),
    ) as Record<MarketingChannelId, number>;

    const normalizedChannels = Object.fromEntries(
      MARKETING_CHANNEL_IDS.map((id) => {
        const ch = getChannelMetrics(fact.channels, id);
        return [
          id,
          {
            sessions: scale(ch.sessions),
            cr: ch.cr,
          },
        ];
      }),
    ) as Partial<Record<MarketingChannelId, ChannelMonthlyMetrics>>;

    const orders = ordersFromChannels(normalizedChannels);
    const atv = fact.atv;
    const buyoutRate = fact.buyoutRate;
    const { grossRevenue, netRevenue } = computeMonthRevenue(orders, atv, buyoutRate);

    return {
      month,
      monthLabel: String(month),
      source: "fact",
      sessions: sessionsFromChannels(normalizedChannels),
      orders,
      atv,
      buyoutRate,
      grossRevenue,
      netRevenue,
      planNetRevenue: planNetByMonth[monthIndex] ?? 0,
      channelSessions,
    };
  }

  const channelSessions = Object.fromEntries(
    forecast.channels.map((channel) => [
      channel.id,
      resolveChannelSessions(channel, monthIndex, scenario, ytd, seasonalityWeights),
    ]),
  ) as Record<MarketingChannelId, number>;

  const ordersRaw = forecast.channels.reduce((total, channel) => {
    const sessions = channelSessions[channel.id] ?? 0;
    const cr = resolveChannelCr(channel, monthIndex, ytd);
    return total + sessions * cr;
  }, 0);

  const orders = ordersRaw * roadmapOrderMultiplier;
  const atv = ytd.atv;
  const buyoutRate = ytd.buyoutRate;
  const { grossRevenue, netRevenue } = computeMonthRevenue(orders, atv, buyoutRate);

  return {
    month,
    monthLabel: String(month),
    source: "forecast",
    sessions: sum(Object.values(channelSessions)),
    orders,
    atv,
    buyoutRate,
    grossRevenue,
    netRevenue,
    planNetRevenue: planNetByMonth[monthIndex] ?? 0,
    channelSessions,
  };
};

export const getRoadmapOrderMultiplier = (
  baseline: BaselineInput,
  tasks: Task[],
  trafficChangePercent: number,
  timelineMode: TimelineMode,
): number => {
  const base = simulateScenario(baseline, [], getTrafficMultiplier(0), { timelineMode }).annual;
  const projected = simulateScenario(
    baseline,
    tasks,
    getTrafficMultiplier(trafficChangePercent),
    { timelineMode },
  ).annual;
  const baseRate = safeDivide(base.orders, base.sessions);
  const projectedRate = safeDivide(projected.orders, projected.sessions);
  if (baseRate <= 0) return 1;
  return projectedRate / baseRate;
};

export const buildForecastScenario = (
  forecast: ForecastPlan,
  scenario: ForecastScenarioId,
  seasonalityWeights: number[],
  options?: {
    baseline?: BaselineInput;
    tasks?: Task[];
    trafficChangePercent?: number;
    timelineMode?: TimelineMode;
  },
): ForecastScenarioResult => {
  const planNetByMonth = monthlyNetPlan(forecast.annualNetTarget, seasonalityWeights);
  const ytd = computeYtdAverages(forecast);
  const roadmapOrderMultiplier =
    scenario === "media_roadmap" && options?.baseline && options.tasks
      ? getRoadmapOrderMultiplier(
          options.baseline,
          options.tasks,
          options.trafficChangePercent ?? 0,
          options.timelineMode ?? "plan",
        )
      : 1;

  const months = Array.from({ length: 12 }, (_, index) =>
    buildForecastMonth(
      index,
      forecast,
      scenario,
      ytd,
      seasonalityWeights,
      planNetByMonth,
      roadmapOrderMultiplier,
    ),
  );

  const annualNetRevenue = sum(months.map((row) => row.netRevenue));
  const annualPlanNetRevenue = sum(planNetByMonth);

  return {
    id: scenario,
    months,
    annualNetRevenue,
    annualPlanNetRevenue,
    deltaToPlan: annualNetRevenue - annualPlanNetRevenue,
    deltaToDoNothing: 0,
  };
};

export const buildAllForecastScenarios = (
  forecast: ForecastPlan,
  seasonalityWeights: number[],
  options?: {
    baseline?: BaselineInput;
    tasks?: Task[];
    trafficChangePercent?: number;
    timelineMode?: TimelineMode;
  },
): ForecastScenarioResult[] => {
  const scenarios: ForecastScenarioId[] = ["do_nothing", "media", "media_roadmap"];
  const results = scenarios.map((id) =>
    buildForecastScenario(forecast, id, seasonalityWeights, options),
  );
  const doNothingNet = results.find((r) => r.id === "do_nothing")?.annualNetRevenue ?? 0;
  return results.map((result) => ({
    ...result,
    deltaToDoNothing: result.annualNetRevenue - doNothingNet,
  }));
};

export const computeFactYtdNet = (forecast: ForecastPlan): number =>
  forecast.monthlyFacts.reduce((total, fact, index) => {
    const month = index + 1;
    if (month > forecast.lastFactMonth || fact.status === "open") return total;

    const scale = (value: number) =>
      normalizePartialMonthValue(value, fact.status, fact.partialDays, fact.daysInMonth);

    const normalizedChannels = Object.fromEntries(
      MARKETING_CHANNEL_IDS.map((id) => {
        const ch = getChannelMetrics(fact.channels, id);
        return [id, { sessions: scale(ch.sessions), cr: ch.cr }];
      }),
    ) as Partial<Record<MarketingChannelId, ChannelMonthlyMetrics>>;

    const orders = ordersFromChannels(normalizedChannels);
    return total + computeMonthRevenue(orders, fact.atv, fact.buyoutRate).netRevenue;
  }, 0);

export const computePlanYtdNet = (
  forecast: ForecastPlan,
  seasonalityWeights: number[],
): number => {
  const plan = monthlyNetPlan(forecast.annualNetTarget, seasonalityWeights);
  return plan
    .slice(0, forecast.lastFactMonth)
    .reduce((total, value) => total + value, 0);
};
