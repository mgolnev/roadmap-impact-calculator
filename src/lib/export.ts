import * as XLSX from "xlsx";

import {
  deriveBaseline,
  getBaseRates,
  getFullyImplementedRates,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { getImpactTypeLabels, getMonthLabel, getPriorityLabels, getStageLabels, getText } from "@/lib/i18n";
import { BaselineInput, Locale, Task, TaskValueMetrics } from "@/lib/types";

type ExportWorkbookParams = {
  locale: Locale;
  baseline: BaselineInput;
  tasks: Task[];
  trafficChangePercent: number;
  taskMetrics: Record<string, TaskValueMetrics>;
};

const conversionRows = (
  locale: Locale,
  baselineAnnual: ReturnType<typeof simulateScenario>["annual"],
  projectedAnnual: ReturnType<typeof simulateScenario>["annual"],
  fullyImplementedRates: ReturnType<typeof getFullyImplementedRates>,
) => [
  {
    stage: locale === "ru" ? "Сессии -> Каталог" : "Sessions -> Catalog",
    base: baselineAnnual.rates.catalogCr,
    fullyImplemented: fullyImplementedRates.rates.catalogCr,
    annualAverage: projectedAnnual.rates.catalogCr,
    stepDelta: fullyImplementedRates.rates.catalogCr - baselineAnnual.rates.catalogCr,
    annualDelta: projectedAnnual.rates.catalogCr - baselineAnnual.rates.catalogCr,
  },
  {
    stage: locale === "ru" ? "Каталог -> PDP" : "Catalog -> PDP",
    base: baselineAnnual.rates.pdpCr,
    fullyImplemented: fullyImplementedRates.rates.pdpCr,
    annualAverage: projectedAnnual.rates.pdpCr,
    stepDelta: fullyImplementedRates.rates.pdpCr - baselineAnnual.rates.pdpCr,
    annualDelta: projectedAnnual.rates.pdpCr - baselineAnnual.rates.pdpCr,
  },
  {
    stage: locale === "ru" ? "PDP -> Добавление в корзину" : "PDP -> Add to cart",
    base: baselineAnnual.rates.atcCr,
    fullyImplemented: fullyImplementedRates.rates.atcCr,
    annualAverage: projectedAnnual.rates.atcCr,
    stepDelta: fullyImplementedRates.rates.atcCr - baselineAnnual.rates.atcCr,
    annualDelta: projectedAnnual.rates.atcCr - baselineAnnual.rates.atcCr,
  },
  {
    stage: locale === "ru" ? "Добавление в корзину -> Checkout" : "Add to cart -> Checkout",
    base: baselineAnnual.rates.checkoutCr,
    fullyImplemented: fullyImplementedRates.rates.checkoutCr,
    annualAverage: projectedAnnual.rates.checkoutCr,
    stepDelta: fullyImplementedRates.rates.checkoutCr - baselineAnnual.rates.checkoutCr,
    annualDelta: projectedAnnual.rates.checkoutCr - baselineAnnual.rates.checkoutCr,
  },
  {
    stage: locale === "ru" ? "Checkout -> Заказ" : "Checkout -> Order",
    base: baselineAnnual.rates.orderCr,
    fullyImplemented: fullyImplementedRates.rates.orderCr,
    annualAverage: projectedAnnual.rates.orderCr,
    stepDelta: fullyImplementedRates.rates.orderCr - baselineAnnual.rates.orderCr,
    annualDelta: projectedAnnual.rates.orderCr - baselineAnnual.rates.orderCr,
  },
  {
    stage: locale === "ru" ? "Заказ / Сессии" : "Order / Sessions",
    base: baselineAnnual.toSessionsRates.orderCr,
    fullyImplemented: fullyImplementedRates.orderToSessions,
    annualAverage: projectedAnnual.toSessionsRates.orderCr,
    stepDelta: fullyImplementedRates.orderToSessions - baselineAnnual.toSessionsRates.orderCr,
    annualDelta: projectedAnnual.toSessionsRates.orderCr - baselineAnnual.toSessionsRates.orderCr,
  },
];

const annualExportRows = (
  label: string,
  annual: ReturnType<typeof simulateScenario>["annual"],
) => [
  {
    scenario: label,
    sessions: annual.sessions,
    catalog: annual.catalog,
    pdp: annual.pdp,
    atc: annual.atc,
    checkout: annual.checkout,
    orders: annual.orders,
    grossRevenue: annual.grossRevenue,
    netRevenue: annual.netRevenue,
    catalogCr: annual.rates.catalogCr,
    pdpCr: annual.rates.pdpCr,
    atcCr: annual.rates.atcCr,
    checkoutCr: annual.rates.checkoutCr,
    orderCr: annual.rates.orderCr,
    orderToSessions: annual.toSessionsRates.orderCr,
  },
];

export const buildRoadmapImpactWorkbook = ({
  locale,
  baseline,
  tasks,
  trafficChangePercent,
  taskMetrics,
}: ExportWorkbookParams) => {
  const workbook = XLSX.utils.book_new();
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);
  const impactTypeLabels = getImpactTypeLabels(locale);
  const priorityLabels = getPriorityLabels(locale);
  const trafficMultiplier = getTrafficMultiplier(trafficChangePercent);
  const baselineSimulation = simulateScenario(baseline, [], trafficMultiplier);
  const projectedSimulation = simulateScenario(baseline, tasks, trafficMultiplier);
  const fullyImplemented = getFullyImplementedRates(baseline, tasks);
  const derivedBaseline = deriveBaseline(baseline);
  const baseRates = getBaseRates(baseline);
  const topTasks = tasks
    .filter((task) => task.active)
    .map((task) => ({
      taskName: task.taskName,
      project: task.project,
      contribution: taskMetrics[task.id]?.incrementalCurrent ?? 0,
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 10);

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      trafficChangePercent,
      netRevenueAfterTasks: projectedSimulation.annual.netRevenue,
      deltaNetRevenue:
        projectedSimulation.annual.netRevenue - baselineSimulation.annual.netRevenue,
      grossRevenueAfterTasks: projectedSimulation.annual.grossRevenue,
      deltaGrossRevenue:
        projectedSimulation.annual.grossRevenue - baselineSimulation.annual.grossRevenue,
      ordersAfterTasks: projectedSimulation.annual.orders,
      deltaOrders: projectedSimulation.annual.orders - baselineSimulation.annual.orders,
    },
  ]);

  const baselineSheet = XLSX.utils.json_to_sheet([
    {
      metric: text.sessions,
      inputValue: baseline.sessions,
      funnelValue: derivedBaseline.absolute.sessions,
      conversionToPreviousStep: 1,
      conversionToSessions: 1,
    },
    {
      metric: stageLabels.catalog,
      inputValue: baseline.catalogCr,
      funnelValue: derivedBaseline.absolute.catalog,
      conversionToPreviousStep: baseRates.catalogCr,
      conversionToSessions: baseRates.catalogCr,
    },
    {
      metric: stageLabels.pdp,
      inputValue: baseline.pdpCr,
      funnelValue: derivedBaseline.absolute.pdp,
      conversionToPreviousStep: baseRates.pdpCr,
      conversionToSessions: derivedBaseline.absolute.pdp / baseline.sessions,
    },
    {
      metric: stageLabels.atc,
      inputValue: baseline.atcCr,
      funnelValue: derivedBaseline.absolute.atc,
      conversionToPreviousStep: baseRates.atcCr,
      conversionToSessions: derivedBaseline.absolute.atc / baseline.sessions,
    },
    {
      metric: stageLabels.checkout,
      inputValue: baseline.checkoutCr,
      funnelValue: derivedBaseline.absolute.checkout,
      conversionToPreviousStep: baseRates.checkoutCr,
      conversionToSessions: derivedBaseline.absolute.checkout / baseline.sessions,
    },
    {
      metric: stageLabels.order,
      inputValue: baseline.orderCr,
      funnelValue: derivedBaseline.absolute.orders,
      conversionToPreviousStep: baseRates.orderCr,
      conversionToSessions: derivedBaseline.absolute.orders / baseline.sessions,
    },
    {
      metric: text.buyout,
      inputValue: baseline.buyoutRate,
    },
    {
      metric: text.atv,
      inputValue: baseline.atv,
    },
    {
      metric: text.upt,
      inputValue: baseline.upt,
    },
    {
      metric: text.grossRevenue,
      funnelValue: derivedBaseline.grossRevenue,
    },
    {
      metric: text.netRevenue,
      funnelValue: derivedBaseline.netRevenue,
    },
    {
      metric: text.ordersUnits,
      funnelValue: derivedBaseline.orderUnits,
    },
    {
      metric: text.asp,
      funnelValue: derivedBaseline.asp,
    },
  ]);

  const impactSheet = XLSX.utils.json_to_sheet(
    conversionRows(locale, baselineSimulation.annual, projectedSimulation.annual, fullyImplemented),
  );

  const topTasksSheet = XLSX.utils.json_to_sheet(topTasks);

  const tasksSheet = XLSX.utils.json_to_sheet(
    tasks.map((task) => ({
      active: task.active,
      project: task.project,
      taskName: task.taskName,
      priority: priorityLabels[task.priority],
      stage1: task.stage1 ? stageLabels[task.stage1] : "",
      impact1Type: task.impact1Type ? impactTypeLabels[task.impact1Type] : "",
      impact1Value: task.impact1Value,
      stage2: task.stage2 ? stageLabels[task.stage2] : "",
      impact2Type: task.impact2Type ? impactTypeLabels[task.impact2Type] : "",
      impact2Value: task.impact2Value,
      releaseMonth: getMonthLabel(locale, task.releaseMonth),
      monthsActive: taskMetrics[task.id]?.monthsActive ?? 0,
      standaloneBase: taskMetrics[task.id]?.standaloneBase ?? 0,
      incrementalCurrent: taskMetrics[task.id]?.incrementalCurrent ?? 0,
      valuePerMonth: taskMetrics[task.id]?.valuePerMonth ?? 0,
      comment: task.comment,
    })),
  );

  const annualSheet = XLSX.utils.json_to_sheet([
    ...annualExportRows(text.base, baselineSimulation.annual),
    ...annualExportRows(text.afterTasks, projectedSimulation.annual),
  ]);

  const monthlySheet = XLSX.utils.json_to_sheet(
    projectedSimulation.months.map((row) => ({
      month: getMonthLabel(locale, row.month),
      sessions: row.sessions,
      catalog: row.catalog,
      pdp: row.pdp,
      atc: row.atc,
      checkout: row.checkout,
      orders: row.orders,
      atv: row.atv,
      buyoutRate: row.buyoutRate,
      grossRevenue: row.grossRevenue,
      netRevenue: row.netRevenue,
      activeTasks: row.activeTaskIds.length,
    })),
  );

  XLSX.utils.book_append_sheet(workbook, summarySheet, locale === "ru" ? "Сводка" : "Summary");
  XLSX.utils.book_append_sheet(workbook, baselineSheet, locale === "ru" ? "База" : "Baseline");
  XLSX.utils.book_append_sheet(workbook, impactSheet, locale === "ru" ? "Воронка эффекта" : "Impact funnel");
  XLSX.utils.book_append_sheet(workbook, topTasksSheet, locale === "ru" ? "Топ задач" : "Top tasks");
  XLSX.utils.book_append_sheet(workbook, tasksSheet, locale === "ru" ? "Задачи" : "Tasks");
  XLSX.utils.book_append_sheet(workbook, annualSheet, locale === "ru" ? "Годовая воронка" : "Annual funnel");
  XLSX.utils.book_append_sheet(workbook, monthlySheet, locale === "ru" ? "Помесячная модель" : "Monthly model");

  return workbook;
};
