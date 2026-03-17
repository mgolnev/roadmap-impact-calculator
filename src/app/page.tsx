"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { AnnualFunnelTable } from "@/components/AnnualFunnelTable";
import { BaselineTable } from "@/components/BaselineTable";
import { ImpactHighlights } from "@/components/ImpactHighlights";
import { MonthlyModelTable } from "@/components/MonthlyModelTable";
import { TasksTable } from "@/components/TasksTable";
import { getText } from "@/lib/i18n";
import { buildRoadmapImpactWorkbook } from "@/lib/export";
import { buildTaskImportWorkbook, parseTaskImportWorkbook } from "@/lib/task-template";
import {
  getFullyImplementedRates,
  getTaskValueMetrics,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { AdjustableStage } from "@/lib/types";
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
    setTasks,
    setAllTasksActive,
    addTask,
    removeTask,
    duplicateTask,
  } = useCalculatorStore();
  const text = getText(locale);
  const [importState, setImportState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedStageFilter, setSelectedStageFilter] = useState<AdjustableStage | "">("");

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
  const fullyImplementedSimulation = useMemo(
    () =>
      simulateScenario(
        baseline,
        tasks.map((task) => ({
          ...task,
          releaseMonth: 1,
        })),
        getTrafficMultiplier(trafficChangePercent),
      ),
    [baseline, tasks, trafficChangePercent],
  );
  const topTasks = useMemo(
    () =>
      Array.from(
        tasks
          .filter((task) => task.active)
          .reduce((acc, task) => {
            const key = task.project.trim() || (locale === "ru" ? "Без проекта" : "No project");
            const current = acc.get(key) ?? { projectName: key, value: 0, taskCount: 0 };
            current.value += taskMetrics[task.id]?.incrementalCurrent ?? 0;
            current.taskCount += 1;
            acc.set(key, current);
            return acc;
          }, new Map<string, { projectName: string; value: number; taskCount: number }>())
          .values(),
      )
        .sort((a, b) => b.value - a.value)
    ,
    [locale, taskMetrics, tasks],
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

  const exportTaskTemplate = () => {
    const workbook = buildTaskImportWorkbook({ locale, tasks });
    XLSX.writeFile(workbook, locale === "ru" ? "шаблон-импорта-roadmap.xlsx" : "roadmap-task-import-template.xlsx");
    setImportState(null);
  };

  const importTasksFromWorkbook = async (file: File) => {
    setIsImporting(true);
    setImportState(null);

    try {
      const buffer = await file.arrayBuffer();
      const imported = parseTaskImportWorkbook(buffer, locale);
      setTasks(imported.tasks);
      setImportState({
        type: "success",
        message:
          locale === "ru"
            ? `${text.importSuccess} Импортировано задач: ${imported.tasks.length}.`
            : `${text.importSuccess} Imported tasks: ${imported.tasks.length}.`,
      });
    } catch (error) {
      setImportState({
        type: "error",
        message:
          error instanceof Error
            ? `${text.importError}\n${error.message}`
            : text.importError,
      });
    } finally {
      setIsImporting(false);
    }
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
        tasks={tasks}
        selectedStageFilter={selectedStageFilter}
        onSelectStageFilter={(stage) =>
          setSelectedStageFilter((current) => (current === stage ? "" : stage))
        }
        trafficChangePercent={trafficChangePercent}
        baselineGross={baselineSimulation.annual.grossRevenue}
        projectedGross={projectedSimulation.annual.grossRevenue}
        baselineNet={baselineSimulation.annual.netRevenue}
        projectedNet={projectedSimulation.annual.netRevenue}
        baselineOrders={baselineSimulation.annual.orders}
        projectedOrders={projectedSimulation.annual.orders}
        baselineAnnual={baselineSimulation.annual}
        projectedAnnual={projectedSimulation.annual}
        fullyImplementedAnnual={fullyImplementedSimulation.annual}
        fullyImplementedRates={fullyImplementedRates.rates}
        topTasks={topTasks}
      />

      <TasksTable
        locale={locale}
        tasks={tasks}
        taskMetrics={taskMetrics}
        importState={importState}
        isImporting={isImporting}
        stageFilter={selectedStageFilter}
        onUpdate={updateTask}
        onStageFilterChange={setSelectedStageFilter}
        onSetAllActive={setAllTasksActive}
        onAdd={addTask}
        onDownloadTemplate={exportTaskTemplate}
        onImportFile={importTasksFromWorkbook}
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
