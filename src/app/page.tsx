"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { AnnualFunnelTable } from "@/components/AnnualFunnelTable";
import { BaselineTable } from "@/components/BaselineTable";
import { ImpactHighlights } from "@/components/ImpactHighlights";
import { MonthlyModelTable } from "@/components/MonthlyModelTable";
import { PreBacklogPanel } from "@/components/PreBacklogPanel";
import { ProjectTracker } from "@/components/ProjectTracker";
import { TasksTable } from "@/components/TasksTable";
import { getText } from "@/lib/i18n";
import { buildRoadmapImpactWorkbook } from "@/lib/export";
import { buildTopProjectRows } from "@/lib/top-projects";
import { buildScenarioBackupWorkbook, parseScenarioBackupWorkbook } from "@/lib/scenario-backup";
import { buildTaskImportWorkbook, parseTaskImportWorkbook } from "@/lib/task-template";
import {
  getFullyImplementedRates,
  getTaskValueMetrics,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { withInitiativeDefaults } from "@/lib/initiative";
import { AdjustableStage, SharedRoadmapPayload, Task } from "@/lib/types";
import { persistIdeasOnlyToSupabase } from "@/lib/persist-ideas-supabase";
import { getSupabaseClientAsync } from "@/lib/supabase";
import { useCalculatorStore } from "@/store/calculator-store";
import { usePMStore } from "@/store/pm-store";

export default function HomePage() {
  const {
    baseline,
    tasks,
    ideas,
    trafficChangePercent,
    locale,
    setBaseline,
    setLocale,
    setTrafficChangePercent,
    updateBaseline,
    updateTask,
    updateIdea,
    setTasks,
    setIdeas,
    setAllRoadmapTasksActive,
    addTask,
    addIdea,
    promoteIdeaToRoadmap,
    removeTask,
    removeIdea,
    duplicateTask,
    duplicateIdea,
    reorderTasks,
  } = useCalculatorStore();
  const { pmData, setPMData } = usePMStore();
  const text = getText(locale);
  const [importState, setImportState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeImport, setActiveImport] = useState<"tasks" | "scenario" | null>(null);
  const [selectedStageFilter, setSelectedStageFilter] = useState<AdjustableStage | "">("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"business" | "ideas" | "pm">("business");
  const [sharedStatus, setSharedStatus] = useState<string | null>(null);
  const tasksSectionRef = useRef<HTMLDivElement>(null);

  const allInitiativesForMetrics = useMemo(() => [...ideas, ...tasks], [ideas, tasks]);

  const baselineSimulation = useMemo(
    () => simulateScenario(baseline, [], getTrafficMultiplier(trafficChangePercent)),
    [baseline, trafficChangePercent],
  );
  const projectedSimulation = useMemo(
    () => simulateScenario(baseline, tasks, getTrafficMultiplier(trafficChangePercent)),
    [baseline, trafficChangePercent, tasks],
  );
  const taskMetrics = useMemo(
    () => getTaskValueMetrics(baseline, allInitiativesForMetrics, trafficChangePercent),
    [allInitiativesForMetrics, baseline, trafficChangePercent],
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
  const topTasks = useMemo(() => {
    const noProject = locale === "ru" ? "Без проекта" : "No project";
    return buildTopProjectRows(tasks, taskMetrics, noProject, (t) => t.active).map((r) => ({
      projectName: r.project,
      value: r.netRevenueContribution,
      taskCount: r.taskCount,
      latestReleaseMonth: r.latestReleaseMonth,
    }));
  }, [locale, taskMetrics, tasks]);

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
      ideas,
      trafficChangePercent,
      taskMetrics,
    });
    XLSX.writeFile(workbook, "roadmap-impact-calculator-2026.xlsx");
  };

  const exportTaskTemplate = () => {
    const workbook = buildTaskImportWorkbook({ locale, tasks: [...ideas, ...tasks] });
    XLSX.writeFile(workbook, locale === "ru" ? "шаблон-импорта-roadmap.xlsx" : "roadmap-task-import-template.xlsx");
    setImportState(null);
  };

  const exportScenarioBackup = () => {
    const workbook = buildScenarioBackupWorkbook({
      locale,
      baseline,
      tasks,
      ideas,
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
      setTasks(imported.tasks.map((t) => withInitiativeDefaults(t)));
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
      setTasks(imported.tasks.map((t) => withInitiativeDefaults(t)));
      setIdeas(imported.ideas.map((t) => withInitiativeDefaults(t)));
      setTrafficChangePercent(imported.trafficChangePercent);
      setSelectedStageFilter("");

      setImportState({
        type: "success",
        message:
          imported.locale === "ru"
            ? `${importedText.scenarioImportSuccess} Roadmap: ${imported.tasks.length}, идей: ${imported.ideas.length}.`
            : `${importedText.scenarioImportSuccess} Roadmap: ${imported.tasks.length}, ideas: ${imported.ideas.length}.`,
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
      source: "initial" | "realtime" = "initial",
    ) => {
      const p = data.payload;

      if (source === "realtime" && p._writeMode === "ideas") {
        if (Array.isArray(p.ideas)) {
          setIdeas((p.ideas as Task[]).map((t) => withInitiativeDefaults(t)));
        }
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
              ? `Идеи обновлены (${timeStr})`
              : `Ideas updated (${timeStr})`
            : loc === "ru"
              ? "Идеи синхронизированы"
              : "Ideas synced",
        );
        return;
      }

      if (p?.locale) setLocale(p.locale);
      if (p?.baseline) setBaseline(p.baseline);
      if (Array.isArray(p?.tasks)) {
        setTasks((p.tasks as Task[]).map((t) => withInitiativeDefaults(t)));
      }
      // Не затираем идеи, если в общем payload нет ключа ideas (старые записи в Supabase).
      // Пустой список с сервера — только если явно пришёл массив (в т.ч. []).
      if (Array.isArray(p?.ideas)) {
        setIdeas((p.ideas as Task[]).map((t) => withInitiativeDefaults(t)));
      }
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
      applyPayloadAndStatus(data, loc, "initial");

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
              "realtime",
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

  /** Автосохранение идей в Supabase (roadmap по-прежнему — только кнопкой). */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = async () => {
      const ideasNow = useCalculatorStore.getState().ideas;
      const result = await persistIdeasOnlyToSupabase(ideasNow);
      if (cancelled) return;
      if (!result.ok && result.error) {
        const loc = useCalculatorStore.getState().locale;
        setSharedStatus(
          loc === "ru"
            ? `Не удалось синхронизировать идеи: ${result.error}`
            : `Could not sync ideas: ${result.error}`,
        );
      }
    };

    const unsub = useCalculatorStore.subscribe((state, previousState) => {
      if (state.ideas === previousState.ideas) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, 900);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
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
      ideas,
      trafficChangePercent,
      locale,
      pmData,
      _writeMode: "full",
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
          <div className="hero-export-row">
            <div className="hero-export-row__buttons">
              <button className="ghost-button" onClick={exportWorkbook} type="button">
                {text.export}
              </button>
              <Link className="ghost-button" href="/report">
                {text.ceoReportLink}
              </Link>
            </div>
            <label className="traffic-control hero-language-control">
              <span>{text.language}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as "ru" | "en")}>
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="action-bar-sticky">
        <div className="action-bar toolbar">
          <div className="toolbar-group">
            <div
              className="tab-bar tab-bar--in-action-bar"
              role="tablist"
              aria-label={locale === "ru" ? "Разделы" : "Sections"}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "business"}
                className={`tab-button ${activeTab === "business" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("business")}
              >
                {text.tabBusiness}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ideas"}
                className={`tab-button ${activeTab === "ideas" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("ideas")}
              >
                {text.tabIdeas}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "pm"}
                className={`tab-button ${activeTab === "pm" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("pm")}
              >
                {text.tabPM}
              </button>
            </div>
          </div>
          <div className="toolbar-group toolbar-group-gap">
            {sharedStatus ? <span className="toolbar-status-inline">{sharedStatus}</span> : null}
            <button className="primary-button save-roadmap-button" onClick={saveSharedRoadmap} type="button">
              {locale === "ru" ? "Сохранить общий roadmap" : "Save shared roadmap"}
            </button>
          </div>
        </div>
      </div>

      {activeTab === "ideas" ? (
        <PreBacklogPanel
          locale={locale}
          baseline={baseline}
          roadmapTasks={tasks}
          trafficChangePercent={trafficChangePercent}
          initiatives={ideas}
          taskMetrics={taskMetrics}
          onUpdate={updateIdea}
          onSaveIdea={addIdea}
          onRemove={removeIdea}
          onDuplicate={duplicateIdea}
          onPromoteToRoadmap={promoteIdeaToRoadmap}
        />
      ) : null}

      {activeTab === "business" ? (
        <>
          <BaselineTable locale={locale} baseline={baseline} onChange={updateBaseline} />

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
            taskMetrics={taskMetrics}
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
            onSetAllActive={setAllRoadmapTasksActive}
            onAdd={addTask}
            onDownloadScenario={exportScenarioBackup}
            onImportScenario={importScenarioFromWorkbook}
            onDownloadTemplate={exportTaskTemplate}
            onImportFile={importTasksFromWorkbook}
            onRemove={removeTask}
            onDuplicate={duplicateTask}
            onReorder={reorderTasks}
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
      ) : null}

      {activeTab === "pm" ? <ProjectTracker locale={locale} tasks={tasks} /> : null}
    </main>
  );
}
