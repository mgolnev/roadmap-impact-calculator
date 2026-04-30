import * as XLSX from "xlsx";

import {
  deriveBaseline,
  getBaseRates,
  getFullyImplementedRates,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { buildAnnualFunnelComparisonRows } from "@/lib/funnel-comparison";
import {
  getMonthLabel,
  getPriorityLabels,
  getStageLabels,
  getText,
  IMPACT_CATEGORY_LABELS,
  INITIATIVE_CONFIDENCE_LABELS,
  INITIATIVE_EFFORT_LABELS,
  INITIATIVE_STATUS_LABELS,
} from "@/lib/i18n";
import { buildTopProjectRows } from "@/lib/top-projects";
import { BaselineInput, ImpactType, Locale, Task, TaskValueMetrics, TimelineMode } from "@/lib/types";

const shortImpactTypeLabel = (locale: Locale, type: ImpactType | undefined): string => {
  if (!type) return "";
  const map: Record<Locale, Record<ImpactType, string>> = {
    ru: { relative_percent: "%", absolute_pp: "п.п.", absolute_value: "abs" },
    en: { relative_percent: "%", absolute_pp: "p.p.", absolute_value: "abs" },
  };
  return map[locale][type];
};

type ExportWorkbookParams = {
  locale: Locale;
  baseline: BaselineInput;
  tasks: Task[];
  /** Pre-backlog (отдельный лист в XLSX). */
  ideas?: Task[];
  trafficChangePercent: number;
  taskMetrics: Record<string, TaskValueMetrics>;
  timelineMode?: TimelineMode;
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

export const buildRoadmapImpactWorkbook = ({
  locale,
  baseline,
  tasks,
  ideas = [],
  trafficChangePercent,
  taskMetrics,
  timelineMode = "plan",
}: ExportWorkbookParams) => {
  const workbook = XLSX.utils.book_new();
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);
  const priorityLabels = getPriorityLabels(locale);
  const trafficMultiplier = getTrafficMultiplier(trafficChangePercent);
  const baselineSimulation = simulateScenario(baseline, [], trafficMultiplier, { timelineMode });
  const projectedSimulation = simulateScenario(baseline, tasks, trafficMultiplier, { timelineMode });
  const fullyImplemented = getFullyImplementedRates(baseline, tasks);
  const derivedBaseline = deriveBaseline(baseline);
  const baseRates = getBaseRates(baseline);
  const noProjectLabel = locale === "ru" ? "Без проекта" : "No project";
  const topProjects = buildTopProjectRows(
    tasks,
    taskMetrics,
    noProjectLabel,
    (t) => t.active,
    timelineMode,
  );

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
      metric: text.grossOrders,
      funnelValue: derivedBaseline.absolute.orders,
    },
    {
      metric: text.asp,
      funnelValue: derivedBaseline.asp,
    },
  ]);

  const annualFunnelRows = buildAnnualFunnelComparisonRows(
    locale,
    text,
    stageLabels,
    baselineSimulation.annual,
    projectedSimulation.annual,
  );
  const conversionData = conversionRows(
    locale,
    baselineSimulation.annual,
    projectedSimulation.annual,
    fullyImplemented,
  );
  const impactSectionTitle =
    locale === "ru" ? "Среднегодовая воронка (база → после roadmap)" : "Annual funnel (baseline → after roadmap)";
  const conversionSectionTitle =
    locale === "ru"
      ? "Показатели по строкам (база, полное внедрение, среднее за год в плане)"
      : "Metrics by row (baseline, full rollout, annual plan average)";
  const impactAoa: (string | number)[][] = [
    [impactSectionTitle],
    [text.metric, text.base, text.afterTasks, text.delta],
    ...annualFunnelRows.map((r) => [r.metric, r.baseline, r.afterTasks, r.delta]),
    [],
    [conversionSectionTitle],
    [text.stage, text.base, text.fullyImplemented, text.annualAverage, text.stepChange, text.annualChange],
    ...conversionData.map((r) => [
      r.stage,
      r.base,
      r.fullyImplemented,
      r.annualAverage,
      r.stepDelta,
      r.annualDelta,
    ]),
  ];
  const impactSheet = XLSX.utils.aoa_to_sheet(impactAoa);

  const topProjectsHeaders =
    locale === "ru"
      ? {
          project: "Проект",
          netRevenueContribution: "Вклад в Net revenue (план)",
          taskCount: "Задач в проекте",
          latestReleaseMonth: "Поздний релиз (мес.)",
        }
      : {
          project: "Project",
          netRevenueContribution: "Net revenue contribution (plan)",
          taskCount: "Tasks in project",
          latestReleaseMonth: "Latest release (month)",
        };
  const topProjectsSheet = XLSX.utils.json_to_sheet(
    topProjects.length
      ? topProjects.map((r) => ({
          [topProjectsHeaders.project]: r.project,
          [topProjectsHeaders.netRevenueContribution]: r.netRevenueContribution,
          [topProjectsHeaders.taskCount]: r.taskCount,
          [topProjectsHeaders.latestReleaseMonth]: getMonthLabel(locale, r.latestReleaseMonth),
        }))
      : [
          {
            [topProjectsHeaders.project]: locale === "ru" ? "—" : "—",
            [topProjectsHeaders.netRevenueContribution]: 0,
            [topProjectsHeaders.taskCount]: 0,
            [topProjectsHeaders.latestReleaseMonth]: "—",
          },
        ],
  );

  const taskCol =
    locale === "ru"
      ? {
          project: "Проект",
          taskName: "Задача",
          initiativeStatus: "Статус",
          description: "Описание",
          problemStatement: "Проблема",
          impactCategory: "Тип влияния",
          confidence: "Уверенность",
          effort: "Effort",
          priority: "Приоритет",
          stage1: "Этап 1",
          impact1Type: "Тип 1",
          impact1Value: "Значение 1",
          stage2: "Этап 2",
          impact2Type: "Тип 2",
          impact2Value: "Значение 2",
          releaseMonth: "Старт эффекта (план)",
          devCommittedReleaseMonth: "Релиз по коммиту (мес.)",
          monthsActive: "Мес. активности",
          standaloneBase: "Standalone, ₽",
          valuePerMonth: "₽ / мес.",
          valuePerYearIgnoreRelease: "Эффект в год (без учёта релиза), ₽",
          comment: "Комментарий",
        }
      : {
          project: "Project",
          taskName: "Task",
          initiativeStatus: "Status",
          description: "Description",
          problemStatement: "Problem statement",
          impactCategory: "Impact category",
          confidence: "Confidence",
          effort: "Effort",
          priority: "Priority",
          stage1: "Stage 1",
          impact1Type: "Type 1",
          impact1Value: "Value 1",
          stage2: "Stage 2",
          impact2Type: "Type 2",
          impact2Value: "Value 2",
          releaseMonth: "Effect start (plan)",
          devCommittedReleaseMonth: "Dev-committed release (mo.)",
          monthsActive: "Active months",
          standaloneBase: "Standalone",
          valuePerMonth: "Per month",
          valuePerYearIgnoreRelease: "Effect per year (release excluded)",
          comment: "Comment",
        };

  const rowFromTask = (task: Task) => ({
    [taskCol.project]: task.project,
    [taskCol.taskName]: task.taskName,
    [taskCol.initiativeStatus]: INITIATIVE_STATUS_LABELS[locale][task.initiativeStatus],
    [taskCol.description]: task.description,
    [taskCol.problemStatement]: task.problemStatement,
    [taskCol.impactCategory]: IMPACT_CATEGORY_LABELS[locale][task.impactCategory],
    [taskCol.confidence]: INITIATIVE_CONFIDENCE_LABELS[locale][task.confidence],
    [taskCol.effort]: INITIATIVE_EFFORT_LABELS[locale][task.effort],
    [taskCol.priority]: priorityLabels[task.priority],
    [taskCol.stage1]: task.stage1 ? stageLabels[task.stage1] : "",
    [taskCol.impact1Type]: shortImpactTypeLabel(locale, task.impact1Type),
    [taskCol.impact1Value]: task.impact1Value,
    [taskCol.stage2]: task.stage2 ? stageLabels[task.stage2] : "",
    [taskCol.impact2Type]: shortImpactTypeLabel(locale, task.impact2Type),
    [taskCol.impact2Value]: task.impact2Value,
    [taskCol.releaseMonth]: getMonthLabel(locale, task.releaseMonth),
    [taskCol.devCommittedReleaseMonth]: getMonthLabel(locale, task.devCommittedReleaseMonth),
    [taskCol.monthsActive]: taskMetrics[task.id]?.monthsActive ?? 0,
    [taskCol.standaloneBase]: taskMetrics[task.id]?.standaloneBase ?? 0,
    [taskCol.valuePerMonth]: taskMetrics[task.id]?.valuePerMonth ?? 0,
    [taskCol.valuePerYearIgnoreRelease]: taskMetrics[task.id]?.valuePerYearIgnoreRelease ?? 0,
    [taskCol.comment]: task.comment,
  });

  const tasksSheet = XLSX.utils.json_to_sheet(tasks.map(rowFromTask));

  XLSX.utils.book_append_sheet(workbook, summarySheet, locale === "ru" ? "Сводка" : "Summary");
  XLSX.utils.book_append_sheet(workbook, baselineSheet, locale === "ru" ? "База" : "Baseline");
  XLSX.utils.book_append_sheet(workbook, impactSheet, locale === "ru" ? "Воронка эффекта" : "Impact funnel");
  XLSX.utils.book_append_sheet(workbook, topProjectsSheet, locale === "ru" ? "Топ проектов" : "Top projects");
  XLSX.utils.book_append_sheet(workbook, tasksSheet, locale === "ru" ? "Задачи" : "Tasks");

  if (ideas.length > 0) {
    const ideasSheet = XLSX.utils.json_to_sheet(ideas.map(rowFromTask));
    XLSX.utils.book_append_sheet(workbook, ideasSheet, locale === "ru" ? "Идеи (pre-backlog)" : "Ideas (pre-backlog)");
  }

  return workbook;
};
