"use client";

import { useMemo } from "react";
import * as XLSX from "xlsx";

import { AnnualFunnelTable } from "@/components/AnnualFunnelTable";
import { BaselineTable } from "@/components/BaselineTable";
import { CurrentStateOverview } from "@/components/CurrentStateOverview";
import { ImpactHighlights } from "@/components/ImpactHighlights";
import { MonthlyModelTable } from "@/components/MonthlyModelTable";
import { TasksTable } from "@/components/TasksTable";
import { TRAFFIC_SCENARIOS } from "@/lib/constants";
import { getTaskValueMetrics, simulateScenario } from "@/lib/calculations";
import { TrafficScenarioKey } from "@/lib/types";
import { useCalculatorStore } from "@/store/calculator-store";

const annualExportRows = (label: string, annual: ReturnType<typeof simulateScenario>["annual"]) => [
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

export default function HomePage() {
  const {
    baseline,
    tasks,
    scenario,
    setScenario,
    updateBaseline,
    resetBaseline,
    updateTask,
    addTask,
    removeTask,
    duplicateTask,
  } = useCalculatorStore();

  const baselineSimulation = useMemo(
    () => simulateScenario(baseline, [], scenario),
    [baseline, scenario],
  );
  const projectedSimulation = useMemo(
    () => simulateScenario(baseline, tasks, scenario),
    [baseline, scenario, tasks],
  );
  const taskMetrics = useMemo(
    () => getTaskValueMetrics(baseline, tasks, scenario),
    [baseline, scenario, tasks],
  );
  const topTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.active)
        .map((task) => ({
          taskName: task.taskName,
          value: taskMetrics[task.id]?.incrementalCurrent ?? 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [taskMetrics, tasks],
  );

  const exportWorkbook = () => {
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        scenario: TRAFFIC_SCENARIOS[scenario].label,
        baselineNetRevenue: baselineSimulation.annual.netRevenue,
        projectedNetRevenue: projectedSimulation.annual.netRevenue,
        deltaNetRevenue:
          projectedSimulation.annual.netRevenue - baselineSimulation.annual.netRevenue,
        baselineGrossRevenue: baselineSimulation.annual.grossRevenue,
        projectedGrossRevenue: projectedSimulation.annual.grossRevenue,
        deltaGrossRevenue:
          projectedSimulation.annual.grossRevenue - baselineSimulation.annual.grossRevenue,
        baselineOrders: baselineSimulation.annual.orders,
        projectedOrders: projectedSimulation.annual.orders,
        deltaOrders: projectedSimulation.annual.orders - baselineSimulation.annual.orders,
      },
    ]);

    const annualSheet = XLSX.utils.json_to_sheet([
      ...annualExportRows("Baseline", baselineSimulation.annual),
      ...annualExportRows("Projected", projectedSimulation.annual),
    ]);

    const monthlySheet = XLSX.utils.json_to_sheet(
      projectedSimulation.months.map((row) => ({
        month: row.monthLabel,
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

    const tasksSheet = XLSX.utils.json_to_sheet(
      tasks.map((task) => ({
        active: task.active,
        stream: task.stream,
        taskName: task.taskName,
        stage1: task.stage1 ?? "",
        impact1Type: task.impact1Type ?? "",
        impact1Value: task.impact1Value,
        stage2: task.stage2 ?? "",
        impact2Type: task.impact2Type ?? "",
        impact2Value: task.impact2Value,
        releaseMonth: task.releaseMonth,
        monthsActive: taskMetrics[task.id]?.monthsActive ?? 0,
        standaloneBase: taskMetrics[task.id]?.standaloneBase ?? 0,
        incrementalCurrent: taskMetrics[task.id]?.incrementalCurrent ?? 0,
        standalone15: taskMetrics[task.id]?.standalone15 ?? 0,
        standalone20: taskMetrics[task.id]?.standalone20 ?? 0,
        standalone30: taskMetrics[task.id]?.standalone30 ?? 0,
        comment: task.comment,
      })),
    );

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, annualSheet, "Annual funnel");
    XLSX.utils.book_append_sheet(workbook, monthlySheet, "Monthly model");
    XLSX.utils.book_append_sheet(workbook, tasksSheet, "Tasks");

    XLSX.writeFile(workbook, "roadmap-impact-calculator-2026.xlsx");
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Roadmap Impact Calculator 2026</p>
          <h1>Калькулятор влияния задач на воронку и выручку</h1>
          <p className="hero-text">
            Базовый режим MVP делит годовую базу на 12 равных месяцев и считает эффект только с
            месяца релиза задачи. Все значения редактируются вручную.
          </p>
        </div>

        <div className="toolbar">
          <div className="scenario-switcher">
            {(Object.entries(TRAFFIC_SCENARIOS) as Array<
              [TrafficScenarioKey, { label: string; multiplier: number }]
            >).map(([key, option]) => (
              <button
                key={key}
                className={`scenario-button ${scenario === key ? "active" : ""}`}
                onClick={() => setScenario(key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <button className="primary-button" onClick={exportWorkbook} type="button">
            Export to XLSX
          </button>
        </div>
      </section>

      <CurrentStateOverview annual={baselineSimulation.annual} baseline={baseline} />

      <BaselineTable baseline={baseline} onChange={updateBaseline} onReset={resetBaseline} />

      <ImpactHighlights
        scenario={scenario}
        baselineGross={baselineSimulation.annual.grossRevenue}
        projectedGross={projectedSimulation.annual.grossRevenue}
        baselineNet={baselineSimulation.annual.netRevenue}
        projectedNet={projectedSimulation.annual.netRevenue}
        baselineOrders={baselineSimulation.annual.orders}
        projectedOrders={projectedSimulation.annual.orders}
        topTasks={topTasks}
      />

      <TasksTable
        tasks={tasks}
        taskMetrics={taskMetrics}
        onUpdate={updateTask}
        onAdd={addTask}
        onRemove={removeTask}
        onDuplicate={duplicateTask}
      />

      <details className="section-card details-card">
        <summary>Подробная среднегодовая воронка</summary>
        <AnnualFunnelTable
          baseline={baselineSimulation.annual}
          projected={projectedSimulation.annual}
        />
      </details>

      <details className="section-card details-card">
        <summary>Помесячная модель 2026</summary>
        <MonthlyModelTable rows={projectedSimulation.months} />
      </details>
    </main>
  );
}
