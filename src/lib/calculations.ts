import {
  AdjustableStage,
  AnnualFunnel,
  BaselineAbsolute,
  BaselineDerived,
  BaselineInput,
  FunnelRates,
  ImpactType,
  MonthlyRow,
  SimulationResult,
  Task,
  TaskValueMetrics,
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

export const getBaselineAbsolute = (baseline: BaselineInput): BaselineAbsolute => {
  const catalog = baseline.sessions * baseline.catalogCr;
  const pdp = catalog * baseline.pdpCr;
  const atc = pdp * baseline.atcCr;
  const checkout = atc * baseline.checkoutCr;
  const orders = checkout * baseline.orderCr;

  return {
    sessions: baseline.sessions,
    catalog,
    pdp,
    atc,
    checkout,
    orders,
  };
};

export const deriveBaseline = (baseline: BaselineInput): BaselineDerived => {
  const absolute = getBaselineAbsolute(baseline);
  const grossRevenue = absolute.orders * baseline.atv;
  const orderUnits = absolute.orders * baseline.upt;
  const asp = orderUnits > 0 ? grossRevenue / orderUnits : 0;
  const netRevenue = grossRevenue * baseline.buyoutRate;

  return {
    absolute,
    grossRevenue,
    netRevenue,
    orderUnits,
    asp,
  };
};

export const getBaseRates = (baseline: BaselineInput): FunnelRates => ({
  catalogCr: baseline.catalogCr,
  pdpCr: baseline.pdpCr,
  atcCr: baseline.atcCr,
  checkoutCr: baseline.checkoutCr,
  orderCr: baseline.orderCr,
});

export const getTrafficMultiplier = (trafficChangePercent: number) => 1 + trafficChangePercent / 100;

const getToSessionRates = (annual: Omit<AnnualFunnel, "rates" | "toSessionsRates">): FunnelRates => ({
  catalogCr: safeDivide(annual.catalog, annual.sessions),
  pdpCr: safeDivide(annual.pdp, annual.sessions),
  atcCr: safeDivide(annual.atc, annual.sessions),
  checkoutCr: safeDivide(annual.checkout, annual.sessions),
  orderCr: safeDivide(annual.orders, annual.sessions),
});

export const getFullyImplementedRates = (baseline: BaselineInput, tasks: Task[]) => {
  const activeTasks = tasks.filter((task) => task.active);
  const baseRates = getBaseRates(baseline);

  const catalogCr = applyImpacts(
    baseRates.catalogCr,
    activeTasks.flatMap((task) => getTaskImpact(task, "catalog")),
    "rate",
  );
  const pdpCr = applyImpacts(
    baseRates.pdpCr,
    activeTasks.flatMap((task) => getTaskImpact(task, "pdp")),
    "rate",
  );
  const atcCr = applyImpacts(
    baseRates.atcCr,
    activeTasks.flatMap((task) => getTaskImpact(task, "atc")),
    "rate",
  );
  const checkoutCr = applyImpacts(
    baseRates.checkoutCr,
    activeTasks.flatMap((task) => getTaskImpact(task, "checkout")),
    "rate",
  );
  const orderCr = applyImpacts(
    baseRates.orderCr,
    activeTasks.flatMap((task) => getTaskImpact(task, "order")),
    "rate",
  );

  return {
    rates: {
      catalogCr,
      pdpCr,
      atcCr,
      checkoutCr,
      orderCr,
    },
    orderToSessions: catalogCr * pdpCr * atcCr * checkoutCr * orderCr,
  };
};

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
  trafficMultiplier: number,
): SimulationResult => {
  const baseRates = getBaseRates(baseline);
  const monthlyBase = getMonthlyBase(baseline);

  const months: MonthlyRow[] = Array.from({ length: 12 }, (_, index) => {
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
      monthLabel: String(month),
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
  trafficMultiplier: number,
) =>
  simulateScenario(
    baseline,
    tasks.map((task) => ({
      ...task,
      active: task.id === taskId,
    })),
    trafficMultiplier,
  );

const getPlanContributionByTaskId = (
  baseline: BaselineInput,
  tasks: Task[],
  trafficMultiplier: number,
) => {
  const activeTasksInPlanOrder = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.active)
    .sort((left, right) => {
      if (left.task.releaseMonth !== right.task.releaseMonth) {
        return left.task.releaseMonth - right.task.releaseMonth;
      }

      return left.index - right.index;
    })
    .map(({ task }) => task);

  const contributions = new Map<string, number>();
  let previousNetRevenue = simulateScenario(baseline, [], trafficMultiplier).annual.netRevenue;

  activeTasksInPlanOrder.forEach((task, index) => {
    const scenarioTasks = activeTasksInPlanOrder.slice(0, index + 1);
    const currentNetRevenue = simulateScenario(
      baseline,
      tasks.map((entry) => ({
        ...entry,
        active: scenarioTasks.some((scenarioTask) => scenarioTask.id === entry.id),
      })),
      trafficMultiplier,
    ).annual.netRevenue;

    contributions.set(task.id, currentNetRevenue - previousNetRevenue);
    previousNetRevenue = currentNetRevenue;
  });

  return contributions;
};

export const getTaskValueMetrics = (
  baseline: BaselineInput,
  tasks: Task[],
  currentTrafficChangePercent: number,
): Record<string, TaskValueMetrics> => {
  const baseScenarioNet = simulateScenario(baseline, [], getTrafficMultiplier(0)).annual.netRevenue;
  const plus15BaseNet = simulateScenario(baseline, [], getTrafficMultiplier(15)).annual.netRevenue;
  const plus20BaseNet = simulateScenario(baseline, [], getTrafficMultiplier(20)).annual.netRevenue;
  const plus30BaseNet = simulateScenario(baseline, [], getTrafficMultiplier(30)).annual.netRevenue;
  const currentPlanContributions = getPlanContributionByTaskId(
    baseline,
    tasks,
    getTrafficMultiplier(currentTrafficChangePercent),
  );

  return Object.fromEntries(
    tasks.map((task) => {
      const standaloneBase =
        simulateWithSingleTask(baseline, tasks, task.id, getTrafficMultiplier(0)).annual.netRevenue -
        baseScenarioNet;
      const standalone15 =
        simulateWithSingleTask(baseline, tasks, task.id, getTrafficMultiplier(15)).annual.netRevenue -
        plus15BaseNet;
      const standalone20 =
        simulateWithSingleTask(baseline, tasks, task.id, getTrafficMultiplier(20)).annual.netRevenue -
        plus20BaseNet;
      const standalone30 =
        simulateWithSingleTask(baseline, tasks, task.id, getTrafficMultiplier(30)).annual.netRevenue -
        plus30BaseNet;
      const monthsActive = Math.max(0, 13 - task.releaseMonth);
      const incrementalCurrent = task.active
        ? currentPlanContributions.get(task.id) ?? 0
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
