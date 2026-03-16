import { MONTH_LABELS, TRAFFIC_SCENARIOS } from "@/lib/constants";
import {
  AdjustableStage,
  AnnualFunnel,
  BaselineDerived,
  BaselineInput,
  FunnelRates,
  ImpactType,
  MonthlyRow,
  SimulationResult,
  Task,
  TaskValueMetrics,
  TrafficScenarioKey,
} from "@/lib/types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const safeDivide = (value: number, base: number) => (base > 0 ? value / base : 0);

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

type ImpactAccumulator = {
  relativeMultiplier: number;
  additiveValue: number;
};

const getTaskImpact = (
  task: Task,
  stage: AdjustableStage,
): Array<{ type: ImpactType; value: number }> => {
  const impacts: Array<{ type: ImpactType; value: number }> = [];

  if (task.stage1 === stage && task.impact1Type) {
    impacts.push({ type: task.impact1Type, value: task.impact1Value });
  }

  if (task.stage2 === stage && task.impact2Type) {
    impacts.push({ type: task.impact2Type, value: task.impact2Value });
  }

  return impacts;
};

const accumulateImpacts = (taskImpacts: Array<{ type: ImpactType; value: number }>) =>
  taskImpacts.reduce<ImpactAccumulator>(
    (acc, impact) => {
      if (impact.type === "relative_percent") {
        acc.relativeMultiplier *= 1 + impact.value;
      } else {
        acc.additiveValue += impact.value;
      }

      return acc;
    },
    { relativeMultiplier: 1, additiveValue: 0 },
  );

const applyImpacts = (
  base: number,
  impacts: Array<{ type: ImpactType; value: number }>,
  mode: "rate" | "unbounded",
) => {
  const aggregated = accumulateImpacts(impacts);
  const raw = base * aggregated.relativeMultiplier + aggregated.additiveValue;

  if (mode === "rate") {
    return clamp(raw, 0, 1);
  }

  return Math.max(0, raw);
};

export const deriveBaseline = (baseline: BaselineInput): BaselineDerived => {
  const grossRevenue = baseline.orders * baseline.atv;
  const orderUnits = baseline.orders * baseline.upt;
  const asp = orderUnits > 0 ? grossRevenue / orderUnits : 0;
  const netRevenue = grossRevenue * baseline.buyoutRate;

  return {
    grossRevenue,
    netRevenue,
    orderUnits,
    asp,
  };
};

export const getBaseRates = (baseline: BaselineInput): FunnelRates => ({
  catalogCr: safeDivide(baseline.catalog, baseline.sessions),
  pdpCr: safeDivide(baseline.pdp, baseline.catalog),
  atcCr: safeDivide(baseline.atc, baseline.pdp),
  checkoutCr: safeDivide(baseline.checkout, baseline.atc),
  orderCr: safeDivide(baseline.orders, baseline.checkout),
});

const getToSessionRates = (annual: Omit<AnnualFunnel, "rates" | "toSessionsRates">): FunnelRates => ({
  catalogCr: safeDivide(annual.catalog, annual.sessions),
  pdpCr: safeDivide(annual.pdp, annual.sessions),
  atcCr: safeDivide(annual.atc, annual.sessions),
  checkoutCr: safeDivide(annual.checkout, annual.sessions),
  orderCr: safeDivide(annual.orders, annual.sessions),
});

const toAnnualFunnel = (months: MonthlyRow[]): AnnualFunnel => {
  const annualBase = {
    sessions: sum(months.map((row) => row.sessions)),
    catalog: sum(months.map((row) => row.catalog)),
    pdp: sum(months.map((row) => row.pdp)),
    atc: sum(months.map((row) => row.atc)),
    checkout: sum(months.map((row) => row.checkout)),
    orders: sum(months.map((row) => row.orders)),
    grossRevenue: sum(months.map((row) => row.grossRevenue)),
    netRevenue: sum(months.map((row) => row.netRevenue)),
    orderUnits: sum(months.map((row) => row.orderUnits)),
    buyoutRate: 0,
    atv: 0,
    upt: 0,
    asp: 0,
  };

  const rates: FunnelRates = {
    catalogCr: safeDivide(annualBase.catalog, annualBase.sessions),
    pdpCr: safeDivide(annualBase.pdp, annualBase.catalog),
    atcCr: safeDivide(annualBase.atc, annualBase.pdp),
    checkoutCr: safeDivide(annualBase.checkout, annualBase.atc),
    orderCr: safeDivide(annualBase.orders, annualBase.checkout),
  };

  const annual: AnnualFunnel = {
    ...annualBase,
    buyoutRate: safeDivide(annualBase.netRevenue, annualBase.grossRevenue),
    atv: safeDivide(annualBase.grossRevenue, annualBase.orders),
    upt: safeDivide(annualBase.orderUnits, annualBase.orders),
    asp: safeDivide(annualBase.grossRevenue, annualBase.orderUnits),
    rates,
    toSessionsRates: getToSessionRates(annualBase),
  };

  return annual;
};

const getMonthlyBase = (baseline: BaselineInput) => ({
  sessions: baseline.sessions / 12,
  atv: baseline.atv,
  buyoutRate: baseline.buyoutRate,
  upt: baseline.upt,
});

export const simulateScenario = (
  baseline: BaselineInput,
  tasks: Task[],
  scenario: TrafficScenarioKey,
): SimulationResult => {
  const baseRates = getBaseRates(baseline);
  const monthlyBase = getMonthlyBase(baseline);
  const trafficMultiplier = TRAFFIC_SCENARIOS[scenario].multiplier;

  const months: MonthlyRow[] = MONTH_LABELS.map((monthLabel, index) => {
    const month = index + 1;
    const activeTasks = tasks.filter((task) => task.active && task.releaseMonth <= month);

    const trafficImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "traffic"));
    const catalogImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "catalog"));
    const pdpImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "pdp"));
    const atcImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "atc"));
    const checkoutImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "checkout"));
    const orderImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "order"));
    const atvImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "atv"));
    const buyoutImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "buyout"));
    const uptImpacts = activeTasks.flatMap((task) => getTaskImpact(task, "upt"));

    const sessions = applyImpacts(
      monthlyBase.sessions * trafficMultiplier,
      trafficImpacts,
      "unbounded",
    );
    const catalogCr = applyImpacts(baseRates.catalogCr, catalogImpacts, "rate");
    const pdpCr = applyImpacts(baseRates.pdpCr, pdpImpacts, "rate");
    const atcCr = applyImpacts(baseRates.atcCr, atcImpacts, "rate");
    const checkoutCr = applyImpacts(baseRates.checkoutCr, checkoutImpacts, "rate");
    const orderCr = applyImpacts(baseRates.orderCr, orderImpacts, "rate");

    const atv = applyImpacts(monthlyBase.atv, atvImpacts, "unbounded");
    const buyoutRate = applyImpacts(monthlyBase.buyoutRate, buyoutImpacts, "rate");
    const upt = applyImpacts(monthlyBase.upt, uptImpacts, "unbounded");

    const catalog = sessions * catalogCr;
    const pdp = catalog * pdpCr;
    const atc = pdp * atcCr;
    const checkout = atc * checkoutCr;
    const orders = checkout * orderCr;
    const grossRevenue = orders * atv;
    const netRevenue = grossRevenue * buyoutRate;
    const orderUnits = orders * upt;
    const asp = safeDivide(grossRevenue, orderUnits);

    return {
      month,
      monthLabel,
      sessions,
      catalog,
      pdp,
      atc,
      checkout,
      orders,
      grossRevenue,
      netRevenue,
      buyoutRate,
      atv,
      upt,
      orderUnits,
      asp,
      activeTaskIds: activeTasks.map((task) => task.id),
    };
  });

  return {
    months,
    annual: toAnnualFunnel(months),
  };
};

const simulateWithSingleTask = (
  baseline: BaselineInput,
  tasks: Task[],
  taskId: string,
  scenario: TrafficScenarioKey,
) =>
  simulateScenario(
    baseline,
    tasks.map((task) => ({
      ...task,
      active: task.id === taskId,
    })),
    scenario,
  );

const simulateWithoutTask = (
  baseline: BaselineInput,
  tasks: Task[],
  taskId: string,
  scenario: TrafficScenarioKey,
) =>
  simulateScenario(
    baseline,
    tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            active: false,
          }
        : task,
    ),
    scenario,
  );

export const getTaskValueMetrics = (
  baseline: BaselineInput,
  tasks: Task[],
  currentScenario: TrafficScenarioKey,
): Record<string, TaskValueMetrics> => {
  const baseScenarioNet = simulateScenario(baseline, [], "base").annual.netRevenue;
  const plus15BaseNet = simulateScenario(baseline, [], "plus15").annual.netRevenue;
  const plus20BaseNet = simulateScenario(baseline, [], "plus20").annual.netRevenue;
  const plus30BaseNet = simulateScenario(baseline, [], "plus30").annual.netRevenue;
  const currentAllTasksNet = simulateScenario(baseline, tasks, currentScenario).annual.netRevenue;

  return Object.fromEntries(
    tasks.map((task) => {
      const standaloneBase =
        simulateWithSingleTask(baseline, tasks, task.id, "base").annual.netRevenue - baseScenarioNet;
      const standalone15 =
        simulateWithSingleTask(baseline, tasks, task.id, "plus15").annual.netRevenue - plus15BaseNet;
      const standalone20 =
        simulateWithSingleTask(baseline, tasks, task.id, "plus20").annual.netRevenue - plus20BaseNet;
      const standalone30 =
        simulateWithSingleTask(baseline, tasks, task.id, "plus30").annual.netRevenue - plus30BaseNet;
      const monthsActive = Math.max(0, 13 - task.releaseMonth);
      const incrementalCurrent = task.active
        ? currentAllTasksNet -
          simulateWithoutTask(baseline, tasks, task.id, currentScenario).annual.netRevenue
        : 0;

      return [
        task.id,
        {
          monthsActive,
          standaloneBase,
          standalone15,
          standalone20,
          standalone30,
          incrementalCurrent,
          valuePerMonth: monthsActive > 0 ? standaloneBase / monthsActive : 0,
        },
      ];
    }),
  );
};
