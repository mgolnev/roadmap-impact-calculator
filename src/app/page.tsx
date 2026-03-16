"use client";

import { useMemo } from "react";
import * as XLSX from "xlsx";

import { AnnualFunnelTable } from "@/components/AnnualFunnelTable";
import { BaselineTable } from "@/components/BaselineTable";
import { ImpactHighlights } from "@/components/ImpactHighlights";
import { MonthlyModelTable } from "@/components/MonthlyModelTable";
import { TasksTable } from "@/components/TasksTable";
import { getText } from "@/lib/i18n";
import { buildRoadmapImpactWorkbook } from "@/lib/export";
import {
  getFullyImplementedRates,
  getTaskValueMetrics,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { useCalculatorStore } from "@/store/calculator-store";

export default function HomePage() {
  const {
    baseline,
    tasks,
    trafficChangePercent,
    locale,
    setLocale,
    setTrafficChangePercent,
    updateBaseline,
    resetBaseline,
    updateTask,
    setAllTasksActive,
    addTask,
    removeTask,
    duplicateTask,
  } = useCalculatorStore();
  const text = getText(locale);

  const baselineSimulation = useMemo(
    () => simulateScenario(baseline, [], getTrafficMultiplier(trafficChangePercent)),
    [baseline, trafficChangePercent],
  );
  const projectedSimulation = useMemo(
    () => simulateScenario(baseline, tasks, getTrafficMultiplier(trafficChangePercent)),
    [baseline, trafficChangePercent, tasks],
  );
  const taskMetrics = useMemo(
    () => getTaskValueMetrics(baseline, tasks, trafficChangePercent),
    [baseline, trafficChangePercent, tasks],
  );
  const fullyImplementedRates = useMemo(
    () => getFullyImplementedRates(baseline, tasks),
    [baseline, tasks],
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
    const workbook = buildRoadmapImpactWorkbook({
      locale,
      baseline,
      tasks,
      trafficChangePercent,
      taskMetrics,
    });
    XLSX.writeFile(workbook, "roadmap-impact-calculator-2026.xlsx");
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{text.heroEyebrow}</p>
          <h1>{text.heroTitle}</h1>
          <p className="hero-text">{text.heroDescription}</p>
        </div>

        <div className="toolbar">
          <label className="traffic-control">
            <span>{text.language}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as "ru" | "en")}>
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label className="traffic-control">
            <span>{text.trafficChange}</span>
            <input
              type="number"
              step="0.1"
              value={trafficChangePercent}
              onChange={(event) => setTrafficChangePercent(Number(event.target.value))}
            />
          </label>
          <button className="primary-button" onClick={exportWorkbook} type="button">
            {text.export}
          </button>
        </div>
      </section>

      <BaselineTable locale={locale} baseline={baseline} onChange={updateBaseline} onReset={resetBaseline} />

      <ImpactHighlights
        locale={locale}
        trafficChangePercent={trafficChangePercent}
        baselineGross={baselineSimulation.annual.grossRevenue}
        projectedGross={projectedSimulation.annual.grossRevenue}
        baselineNet={baselineSimulation.annual.netRevenue}
        projectedNet={projectedSimulation.annual.netRevenue}
        baselineOrders={baselineSimulation.annual.orders}
        projectedOrders={projectedSimulation.annual.orders}
        baselineAnnual={baselineSimulation.annual}
        projectedAnnual={projectedSimulation.annual}
        fullyImplementedRates={fullyImplementedRates.rates}
        fullyImplementedOrderToSessions={fullyImplementedRates.orderToSessions}
        topTasks={topTasks}
      />

      <TasksTable
        locale={locale}
        tasks={tasks}
        taskMetrics={taskMetrics}
        onUpdate={updateTask}
        onSetAllActive={setAllTasksActive}
        onAdd={addTask}
        onRemove={removeTask}
        onDuplicate={duplicateTask}
      />

      <details className="section-card details-card">
        <summary>{text.detailedAnnual}</summary>
        <AnnualFunnelTable
          locale={locale}
          baseline={baselineSimulation.annual}
          projected={projectedSimulation.annual}
        />
      </details>

      <details className="section-card details-card">
        <summary>{text.monthlyModel}</summary>
        <MonthlyModelTable locale={locale} rows={projectedSimulation.months} />
      </details>
    </main>
  );
}
