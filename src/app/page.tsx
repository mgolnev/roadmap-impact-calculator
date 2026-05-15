"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { AnnualFunnelTable } from "@/components/AnnualFunnelTable";
import { BaselineTable } from "@/components/BaselineTable";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { SeasonalityWeightsPanel } from "@/components/SeasonalityWeightsPanel";
import { ImpactHighlights } from "@/components/ImpactHighlights";
import { MonthlyModelTable } from "@/components/MonthlyModelTable";
import { PreBacklogPanel } from "@/components/PreBacklogPanel";
import { ProjectTracker } from "@/components/ProjectTracker";
import { TasksTable } from "@/components/TasksTable";
import { getText } from "@/lib/i18n";
import { buildRoadmapImpactWorkbook } from "@/lib/export";
import { buildLeaderboardProjectRows } from "@/lib/top-projects";
import { buildScenarioBackupWorkbook, parseScenarioBackupWorkbook } from "@/lib/scenario-backup";
import { buildTaskImportWorkbook, parseTaskImportWorkbook } from "@/lib/task-template";
import {
  getFullyImplementedRates,
  getTaskValueMetrics,
  getTrafficMultiplier,
  simulateScenario,
} from "@/lib/calculations";
import { taskCountsTowardPlan, withInitiativeDefaults } from "@/lib/initiative";
import { AdjustableStage, PlanYear, SharedRoadmapPayload, Task, TaskPMData, YearPlan } from "@/lib/types";
import { persistIdeasOnlyToSupabase } from "@/lib/persist-ideas-supabase";
import { formatSupabaseError, getSupabaseClientAsync } from "@/lib/supabase";
import { DEFAULT_PLAN_YEAR, NEXT_PLAN_YEAR, PLAN_YEARS, useCalculatorStore } from "@/store/calculator-store";
import { DEFAULT_BASELINE } from "@/lib/constants";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import { usePMStore } from "@/store/pm-store";

type RoadmapStateRow = {
  id: number;
  payload: Partial<SharedRoadmapPayload> | null;
  updated_at?: string | null;
};

type LegacySharedRoadmapPayload = Partial<{
  baseline: YearPlan["baseline"];
  tasks: Task[];
  ideas: Task[];
  trafficChangePercent: number;
  timelineMode: YearPlan["timelineMode"];
  locale: SharedRoadmapPayload["locale"];
  pmData: Record<string, TaskPMData>;
}>;

const emptyYearPlan = (): YearPlan => ({
  baseline: DEFAULT_BASELINE,
  tasks: [],
  trafficChangePercent: 0,
  timelineMode: "plan",
  pmData: {},
});

const normalizeYearPlan = (plan: Partial<YearPlan> | undefined): YearPlan => {
  const mergedBaseline = { ...DEFAULT_BASELINE, ...(plan?.baseline ?? {}) };
  return {
    baseline: {
      ...mergedBaseline,
      seasonalityWeights: normalizeSeasonalityWeights(mergedBaseline.seasonalityWeights),
    },
    tasks: Array.isArray(plan?.tasks) ? (plan.tasks as Task[]).map((t) => withInitiativeDefaults(t)) : [],
    trafficChangePercent: plan?.trafficChangePercent ?? 0,
    timelineMode: plan?.timelineMode === "dev_committed" ? "dev_committed" : "plan",
    pmData: plan?.pmData && typeof plan.pmData === "object" ? plan.pmData : {},
  };
};

function normalizeSharedPayload(raw: Partial<SharedRoadmapPayload> | null | undefined): SharedRoadmapPayload | null {
  if (!raw) return null;
  if (raw.yearPlans) {
    return {
      activeYear: raw.activeYear === NEXT_PLAN_YEAR ? NEXT_PLAN_YEAR : DEFAULT_PLAN_YEAR,
      sharedIdeas: Array.isArray(raw.sharedIdeas)
        ? raw.sharedIdeas.map((t) => withInitiativeDefaults(t))
        : [],
      yearPlans: {
        2026: normalizeYearPlan(raw.yearPlans[2026]),
        2027: normalizeYearPlan(raw.yearPlans[2027]),
      },
      locale: raw.locale ?? "ru",
      _writeMode: raw._writeMode,
    };
  }

  const legacy = raw as LegacySharedRoadmapPayload;
  if (!Array.isArray(legacy.tasks)) return null;
  return {
    activeYear: DEFAULT_PLAN_YEAR,
    sharedIdeas: Array.isArray(legacy.ideas)
      ? legacy.ideas.map((t) => withInitiativeDefaults(t))
      : [],
    yearPlans: {
      2026: normalizeYearPlan({
        baseline: legacy.baseline,
        tasks: legacy.tasks,
        trafficChangePercent: legacy.trafficChangePercent,
        timelineMode: legacy.timelineMode,
        pmData: legacy.pmData ?? {},
      }),
      2027: emptyYearPlan(),
    },
    locale: legacy.locale ?? "ru",
  };
}

const formatStatusDateTime = (value: string, locale: "ru" | "en") =>
  new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

async function fetchRoadmapStateRow(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>,
): Promise<RoadmapStateRow | null> {
  const byCanonicalId = await supabase
    .from("roadmap_state")
    .select("id, payload, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (byCanonicalId.error) throw byCanonicalId.error;
  if (byCanonicalId.data) return byCanonicalId.data as RoadmapStateRow;

  const latest = await supabase
    .from("roadmap_state")
    .select("id, payload, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) throw latest.error;
  return (latest.data as RoadmapStateRow | null) ?? null;
}

export default function HomePage() {
  const {
    activeYear,
    yearPlans,
    baseline,
    tasks,
    ideas,
    trafficChangePercent,
    locale,
    setLocale,
    setTrafficChangePercent,
    timelineMode,
    setTimelineMode,
    updateBaseline,
    setSeasonalityWeights,
    resetSeasonalityWeights,
    setActiveYear,
    deriveYearBaselineFromYear,
    applyMultiYearState,
    updateTask,
    updateIdea,
    setTasks,
    setIdeas,
    setAllRoadmapTasksActive,
    addTask,
    addIdea,
    promoteIdeaToRoadmapForYear,
    removeTask,
    removeIdea,
    duplicateTask,
    duplicateIdea,
    reorderTasks,
  } = useCalculatorStore();
  const {
    pmData,
    pmDataByYear,
    setPMDataByYear,
    setActiveYear: setPMActiveYear,
  } = usePMStore();
  const text = getText(locale);
  const [importState, setImportState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeImport, setActiveImport] = useState<"tasks" | "scenario" | null>(null);
  const [selectedStageFilter, setSelectedStageFilter] = useState<AdjustableStage | "">("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"business" | "ideas" | "pm">("business");
  const [sharedStatus, setSharedStatus] = useState<string | null>(null);
  const tasksSectionRef = useRef<HTMLDivElement>(null);
  const applyingSharedPayloadRef = useRef(false);
  const sourceYearPlan = yearPlans[DEFAULT_PLAN_YEAR];

  useEffect(() => {
    setPMActiveYear(activeYear);
  }, [activeYear, setPMActiveYear]);

  useEffect(() => {
    deriveYearBaselineFromYear(DEFAULT_PLAN_YEAR, NEXT_PLAN_YEAR);
  }, [activeYear, deriveYearBaselineFromYear, sourceYearPlan]);

  const allInitiativesForMetrics = useMemo(() => [...ideas, ...tasks], [ideas, tasks]);

  const baselineSimulation = useMemo(
    () =>
      simulateScenario(baseline, [], getTrafficMultiplier(trafficChangePercent), { timelineMode }),
    [baseline, trafficChangePercent, timelineMode],
  );
  const projectedSimulation = useMemo(
    () =>
      simulateScenario(baseline, tasks, getTrafficMultiplier(trafficChangePercent), { timelineMode }),
    [baseline, trafficChangePercent, tasks, timelineMode],
  );
  const taskMetrics = useMemo(
    () =>
      getTaskValueMetrics(baseline, allInitiativesForMetrics, trafficChangePercent, { timelineMode }),
    [allInitiativesForMetrics, baseline, trafficChangePercent, timelineMode],
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
          devCommittedReleaseMonth: 1,
        })),
        getTrafficMultiplier(trafficChangePercent),
        { timelineMode },
      ),
    [baseline, tasks, trafficChangePercent, timelineMode],
  );
  const topTasks = useMemo(() => {
    const noProject = locale === "ru" ? "Без проекта" : "No project";
    return buildLeaderboardProjectRows(
      tasks,
      taskMetrics,
      noProject,
      taskCountsTowardPlan,
      timelineMode,
    ).map((r) => ({
      projectName: r.project,
      value: r.netRevenueContribution,
      taskCount: r.taskCount,
      latestReleaseMonth: r.latestReleaseMonth,
    }));
  }, [locale, taskMetrics, tasks, timelineMode]);

  useEffect(() => {
    if (selectedProjectFilter || selectedStageFilter) {
      tasksSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedProjectFilter, selectedStageFilter]);

  const exportWorkbook = () => {
    const workbook = buildRoadmapImpactWorkbook({
      locale,
      planYear: activeYear,
      baseline,
      tasks,
      ideas,
      trafficChangePercent,
      taskMetrics,
      timelineMode,
    });
    XLSX.writeFile(workbook, `roadmap-impact-calculator-${activeYear}.xlsx`);
  };

  const exportTaskTemplate = () => {
    const workbook = buildTaskImportWorkbook({ locale, tasks: [...ideas, ...tasks] });
    XLSX.writeFile(workbook, locale === "ru" ? "шаблон-импорта-roadmap.xlsx" : "roadmap-task-import-template.xlsx");
    setImportState(null);
  };

  const exportScenarioBackup = () => {
    const workbook = buildScenarioBackupWorkbook({
      locale,
      activeYear,
      yearPlans,
      baseline,
      tasks,
      ideas,
      trafficChangePercent,
      timelineMode,
      pmData,
      pmDataByYear,
    });

    XLSX.writeFile(
      workbook,
      locale === "ru" ? `backup-scenario-roadmap-${activeYear}.xlsx` : `roadmap-scenario-backup-${activeYear}.xlsx`,
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

      applyMultiYearState({
        activeYear: imported.activeYear,
        sharedIdeas: imported.ideas.map((t) => withInitiativeDefaults(t)),
        yearPlans: imported.yearPlans,
        locale: imported.locale,
      });
      setPMDataByYear(
        {
          2026: imported.yearPlans[2026].pmData,
          2027: imported.yearPlans[2027].pmData,
        },
        imported.activeYear,
      );
      setSelectedStageFilter("");

      setImportState({
        type: "success",
        message:
          imported.locale === "ru"
            ? `${importedText.scenarioImportSuccess} ${imported.activeYear}: ${imported.yearPlans[imported.activeYear].tasks.length}, идей: ${imported.ideas.length}.`
            : `${importedText.scenarioImportSuccess} ${imported.activeYear}: ${imported.yearPlans[imported.activeYear].tasks.length}, ideas: ${imported.ideas.length}.`,
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
      applyingSharedPayloadRef.current = true;
      try {
        const payload = normalizeSharedPayload(data.payload);
        if (!payload) return;

        if (source === "realtime" && payload._writeMode === "ideas") {
          setIdeas(payload.sharedIdeas.map((t) => withInitiativeDefaults(t)));
          const savedAt = data.updated_at ? formatStatusDateTime(data.updated_at, loc) : "";
          setSharedStatus(
            savedAt
              ? loc === "ru"
                ? `Идеи обновлены (${savedAt})`
                : `Ideas updated (${savedAt})`
              : loc === "ru"
                ? "Идеи синхронизированы"
                : "Ideas synced",
          );
          return;
        }

        applyMultiYearState(payload);
        setPMDataByYear(
          {
            2026: payload.yearPlans[2026].pmData,
            2027: payload.yearPlans[2027].pmData,
          },
          payload.activeYear,
        );

        const savedAt = data.updated_at ? formatStatusDateTime(data.updated_at, loc) : "";
        setSharedStatus(
          savedAt
            ? loc === "ru"
              ? `Роадмап сохранён: ${savedAt}`
              : `Roadmap saved: ${savedAt}`
            : loc === "ru"
              ? "Загружен общий roadmap"
              : "Loaded shared roadmap",
        );
      } finally {
        applyingSharedPayloadRef.current = false;
      }
    };

    const loadSharedRoadmap = async () => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return;

      let data: RoadmapStateRow | null = null;
      try {
        data = await fetchRoadmapStateRow(supabase);
      } catch {
        return;
      }

      if (!data?.payload) return;

      const payload = data.payload as Partial<SharedRoadmapPayload>;
      const loc = (payload.locale as "ru" | "en") || locale;
      applyPayloadAndStatus({ payload, updated_at: data.updated_at ?? null }, loc, "initial");

      const ch = supabase
        .channel("roadmap_state_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "roadmap_state",
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
      if (applyingSharedPayloadRef.current) return;
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

    setSharedStatus(locale === "ru" ? "Сохранение..." : "Saving...");

    const calc = useCalculatorStore.getState();
    const pm = usePMStore.getState();
    let serverRow: RoadmapStateRow | null = null;
    let serverPayload: Partial<SharedRoadmapPayload> | null = null;
    try {
      serverRow = await fetchRoadmapStateRow(supabase);
      serverPayload = serverRow?.payload ?? null;
    } catch (error) {
      setSharedStatus(
        (calc.locale === "ru" ? "Ошибка сохранения: " : "Failed to save: ") +
          formatSupabaseError(error),
      );
      return;
    }

    const normalizedServerPayload = normalizeSharedPayload(serverPayload);
    const serverIdeas = normalizedServerPayload?.sharedIdeas ?? [];
    const payloadIdeas = calc.ideas.length === 0 && serverIdeas.length > 0 ? serverIdeas : calc.ideas;

    const payload: SharedRoadmapPayload = {
      activeYear: calc.activeYear,
      sharedIdeas: payloadIdeas,
      yearPlans: {
        2026: {
          ...(calc.yearPlans[2026] ?? emptyYearPlan()),
          pmData: pm.pmDataByYear[2026] ?? {},
        },
        2027: {
          ...(calc.yearPlans[2027] ?? emptyYearPlan()),
          pmData: pm.pmDataByYear[2027] ?? {},
        },
      },
      locale: calc.locale,
      _writeMode: "full",
    };

    const updated = { payload, updated_at: new Date().toISOString() };
    const { error } = serverRow?.id != null
      ? await supabase.from("roadmap_state").update(updated).eq("id", serverRow.id)
      : await supabase.from("roadmap_state").insert(updated);

    if (error) {
      setSharedStatus(
        (calc.locale === "ru" ? "Ошибка сохранения: " : "Failed to save: ") +
          formatSupabaseError(error),
      );
      return;
    }

    const savedAt = formatStatusDateTime(new Date().toISOString(), calc.locale);
    setSharedStatus(
      calc.locale === "ru" ? `Роадмап сохранён: ${savedAt}` : `Roadmap saved: ${savedAt}`,
    );
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{text.heroEyebrow.replace("2026", String(activeYear))}</p>
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
            <label className="traffic-control">
              <select
                aria-label={locale === "ru" ? "Год плана" : "Plan year"}
                value={activeYear}
                onChange={(event) => {
                  const nextYear = Number(event.target.value) as PlanYear;
                  setActiveYear(nextYear);
                  setPMActiveYear(nextYear);
                  setSelectedStageFilter("");
                  setSelectedProjectFilter("");
                }}
              >
                {PLAN_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
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
          onPromoteToRoadmap={promoteIdeaToRoadmapForYear}
        />
      ) : null}

      {activeTab === "business" ? (
        <>
          <BaselineTable locale={locale} baseline={baseline} onChange={updateBaseline} />

          <CollapsibleSection
            className="timeline-mode-card"
            title={text.timelineModeLabel}
            description={<p className="timeline-mode-hint">{text.timelineModeHint}</p>}
            headerAside={
              <div
                className="tab-bar timeline-mode-tabs"
                role="group"
                aria-label={text.timelineModeLabel}
              >
                <button
                  type="button"
                  className={`tab-button ${timelineMode === "plan" ? "tab-active" : ""}`}
                  aria-pressed={timelineMode === "plan"}
                  onClick={() => setTimelineMode("plan")}
                >
                  {text.timelineModePlan}
                </button>
                <button
                  type="button"
                  className={`tab-button ${timelineMode === "dev_committed" ? "tab-active" : ""}`}
                  aria-pressed={timelineMode === "dev_committed"}
                  onClick={() => setTimelineMode("dev_committed")}
                >
                  {text.timelineModeDevCommitted}
                </button>
              </div>
            }
          >
            {timelineMode === "dev_committed" ? (
              <p className="toolbar-status timeline-mode-banner">{text.timelineModeBannerDev}</p>
            ) : null}
          </CollapsibleSection>

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
            timelineMode={timelineMode}
          />

          <div ref={tasksSectionRef}>
          <TasksTable
            locale={locale}
            timelineMode={timelineMode}
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

          <CollapsibleSection
            defaultOpen={false}
            title={text.detailedAnnual}
            description={<p>{text.annualDescription}</p>}
          >
            <AnnualFunnelTable
              locale={locale}
              baseline={baselineSimulation.annual}
              projected={projectedSimulation.annual}
            />
          </CollapsibleSection>

          <CollapsibleSection
            defaultOpen={false}
            title={text.monthlyModel.replace("2026", String(activeYear))}
            description={<p>{text.monthlyDescription}</p>}
          >
            <MonthlyModelTable locale={locale} rows={projectedSimulation.months} />
          </CollapsibleSection>

          <SeasonalityWeightsPanel
            locale={locale}
            planYear={activeYear}
            weights={baseline.seasonalityWeights}
            onCommit={setSeasonalityWeights}
            onResetEqual={resetSeasonalityWeights}
          />
        </>
      ) : null}

      {activeTab === "pm" ? <ProjectTracker locale={locale} tasks={tasks} /> : null}
    </main>
  );
}
