"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { AnnualFunnelTable } from "@/components/AnnualFunnelTable";
import { BaselineTable } from "@/components/BaselineTable";
import { ImpactHighlights } from "@/components/ImpactHighlights";
import { MonthlyModelTable } from "@/components/MonthlyModelTable";
import { ProjectTracker } from "@/components/ProjectTracker";
import { TasksTable } from "@/components/TasksTable";
import { getText } from "@/lib/i18n";
import { buildRoadmapImpactWorkbook } from "@/lib/export";
import { buildScenarioBackupWorkbook, parseScenarioBackupWorkbook } from "@/lib/scenario-backup";
import { buildTaskImportWorkbook, parseTaskImportWorkbook } from "@/lib/task-template";
import {
  getFullyImplementedRates,
  getTaskValueMetrics,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { AdjustableStage, SharedRoadmapPayload } from "@/lib/types";
import { getSupabaseClientAsync } from "@/lib/supabase";
import { useCalculatorStore } from "@/store/calculator-store";
import { usePMStore } from "@/store/pm-store";

export default function HomePage() {
  const {
    baseline,
    tasks,
    trafficChangePercent,
    locale,
    setBaseline,
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
  const { pmData, setPMData } = usePMStore();
  const text = getText(locale);
  const [importState, setImportState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeImport, setActiveImport] = useState<"tasks" | "scenario" | null>(null);
  const [selectedStageFilter, setSelectedStageFilter] = useState<AdjustableStage | "">("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"business" | "pm">("business");
  const [sharedStatus, setSharedStatus] = useState<string | null>(null);
  const tasksSectionRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (selectedProjectFilter || selectedStageFilter) {
      tasksSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedProjectFilter, selectedStageFilter]);

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

  const exportScenarioBackup = () => {
    const workbook = buildScenarioBackupWorkbook({
      locale,
      baseline,
      tasks,
      trafficChangePercent,
    });

    XLSX.writeFile(
      workbook,
      locale === "ru" ? "backup-scenario-roadmap.xlsx" : "roadmap-scenario-backup.xlsx",
    );
    setImportState(null);
  };

  const importTasksFromWorkbook = async (file: File) => {
    setActiveImport("tasks");
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
      setActiveImport(null);
    }
  };

  const importScenarioFromWorkbook = async (file: File) => {
    setActiveImport("scenario");
    setImportState(null);

    try {
      const buffer = await file.arrayBuffer();
      const imported = parseScenarioBackupWorkbook(buffer, locale);
      const importedText = getText(imported.locale);

      setLocale(imported.locale);
      setBaseline(imported.baseline);
      setTasks(imported.tasks);
      setTrafficChangePercent(imported.trafficChangePercent);
      setSelectedStageFilter("");

      setImportState({
        type: "success",
        message:
          imported.locale === "ru"
            ? `${importedText.scenarioImportSuccess} Импортировано задач: ${imported.tasks.length}.`
            : `${importedText.scenarioImportSuccess} Imported tasks: ${imported.tasks.length}.`,
      });
    } catch (error) {
      setImportState({
        type: "error",
        message:
          error instanceof Error
            ? `${text.scenarioImportError}\n${error.message}`
            : text.scenarioImportError,
      });
    } finally {
      setActiveImport(null);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const applyPayloadAndStatus = (
      data: { payload: Partial<SharedRoadmapPayload>; updated_at?: string | null },
      loc: "ru" | "en",
    ) => {
      const p = data.payload;
      if (p?.locale) setLocale(p.locale);
      if (p?.baseline) setBaseline(p.baseline);
      if (Array.isArray(p?.tasks)) setTasks(p.tasks);
      if (typeof p?.trafficChangePercent === "number") setTrafficChangePercent(p.trafficChangePercent);
      if (p?.pmData && typeof p.pmData === "object") setPMData(p.pmData);

      const timeStr = data.updated_at
        ? new Date(data.updated_at).toLocaleTimeString(loc === "ru" ? "ru-RU" : "en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        : "";
      setSharedStatus(
        timeStr
          ? loc === "ru"
            ? `Роадмап сохранён в ${timeStr}`
            : `Roadmap saved at ${timeStr}`
          : loc === "ru"
            ? "Загружен общий roadmap"
            : "Loaded shared roadmap",
      );
    };

    const loadSharedRoadmap = async () => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("roadmap_state")
        .select("payload, updated_at")
        .eq("id", 1)
        .maybeSingle();

      if (error || !data?.payload) return;

      const payload = data.payload as Partial<SharedRoadmapPayload>;
      const loc = (payload.locale as "ru" | "en") || locale;
      applyPayloadAndStatus(data, loc);

      const ch = supabase
        .channel("roadmap_state_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "roadmap_state",
            filter: "id=eq.1",
          },
          (ev) => {
            const row = ev.new as { payload?: Partial<SharedRoadmapPayload>; updated_at?: string } | null;
            if (!row?.payload) return;
            const ploc = (row.payload.locale as "ru" | "en") || "ru";
            applyPayloadAndStatus(
              { payload: row.payload, updated_at: row.updated_at ?? null },
              ploc,
            );
          },
        )
        .subscribe();
      unsubscribe = () => supabase.removeChannel(ch);
    };

    void loadSharedRoadmap();

    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSharedRoadmap = async () => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) {
      setSharedStatus(locale === "ru" ? "Supabase не настроен" : "Supabase is not configured");
      return;
    }

    const payload: SharedRoadmapPayload = {
      baseline,
      tasks,
      trafficChangePercent,
      locale,
      pmData,
    };

    setSharedStatus(locale === "ru" ? "Сохранение..." : "Saving...");

    const updated = { payload, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase
      .from("roadmap_state")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("roadmap_state").update(updated).eq("id", 1)
      : await supabase.from("roadmap_state").insert(updated);

    if (error) {
      setSharedStatus(
        (locale === "ru" ? "Ошибка сохранения: " : "Failed to save: ") + error.message,
      );
      return;
    }

    const timeStr = new Date().toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    setSharedStatus(
      locale === "ru" ? `Роадмап сохранён в ${timeStr}` : `Roadmap saved at ${timeStr}`,
    );
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{text.heroEyebrow}</p>
          <h1>{text.heroTitle}</h1>
          <p className="hero-text">{text.heroDescription}</p>
        </div>
      </section>

      <div className="action-bar-sticky">
        <div className="action-bar toolbar">
          <div className="toolbar-group">
            <label className="traffic-control">
              <span>{text.language}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as "ru" | "en")}>
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
            </label>
            <button className="ghost-button action-bar-export" onClick={exportWorkbook} type="button">
              {text.export}
            </button>
          </div>
          <div className="toolbar-group toolbar-group-gap">
            {sharedStatus ? <span className="toolbar-status-inline">{sharedStatus}</span> : null}
            <button className="primary-button save-roadmap-button" onClick={saveSharedRoadmap} type="button">
              {locale === "ru" ? "Сохранить общий roadmap" : "Save shared roadmap"}
            </button>
          </div>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === "business" ? "tab-active" : ""}`}
          type="button"
          onClick={() => setActiveTab("business")}
        >
          {text.tabBusiness}
        </button>
        <button
          className={`tab-button ${activeTab === "pm" ? "tab-active" : ""}`}
          type="button"
          onClick={() => setActiveTab("pm")}
        >
          {text.tabPM}
        </button>
      </div>

      {activeTab === "business" ? (
        <>
          <BaselineTable locale={locale} baseline={baseline} onChange={updateBaseline} onReset={resetBaseline} />

          <ImpactHighlights
            locale={locale}
            tasks={tasks}
            selectedStageFilter={selectedStageFilter}
            onSelectStageFilter={(stage) =>
              setSelectedStageFilter((current) => (current === stage ? "" : stage))
            }
            selectedProjectFilter={selectedProjectFilter}
            onSelectProjectFilter={(project) =>
              setSelectedProjectFilter((current) => (current === project ? "" : project))
            }
            trafficChangePercent={trafficChangePercent}
            onTrafficChangePercent={setTrafficChangePercent}
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

          <div ref={tasksSectionRef}>
          <TasksTable
            locale={locale}
            tasks={tasks}
            taskMetrics={taskMetrics}
            importState={importState}
            activeImport={activeImport}
            stageFilter={selectedStageFilter}
            onStageFilterChange={setSelectedStageFilter}
            projectFilter={selectedProjectFilter}
            onProjectFilterChange={setSelectedProjectFilter}
            onUpdate={updateTask}
            onSetAllActive={setAllTasksActive}
            onAdd={addTask}
            onDownloadScenario={exportScenarioBackup}
            onImportScenario={importScenarioFromWorkbook}
            onDownloadTemplate={exportTaskTemplate}
            onImportFile={importTasksFromWorkbook}
            onRemove={removeTask}
            onDuplicate={duplicateTask}
          />
          </div>

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
        </>
      ) : (
        <ProjectTracker locale={locale} tasks={tasks} />
      )}
    </main>
  );
}
