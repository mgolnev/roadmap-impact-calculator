import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_BASELINE, DEFAULT_TASKS } from "@/lib/constants";
import { normalizeSeasonalityWeights, uniformSeasonalityWeights } from "@/lib/seasonality";
import {
  buildDemotedIdeaTaskFromRoadmapTask,
  buildPromotedRoadmapTaskFromIdea,
  isPreBacklogStatus,
  withInitiativeDefaults,
} from "@/lib/initiative";
import {
  parsePersistedRoadmapTableSort,
  type RoadmapSortColumn,
  type RoadmapTableSortState,
} from "@/lib/roadmap-table-sort";
import {
  AdjustableStage,
  AnnualFunnel,
  BaselineInput,
  ImpactType,
  InitiativeStatus,
  Locale,
  PlanYear,
  Priority,
  SharedRoadmapPayload,
  Task,
  TimelineMode,
  YearPlan,
} from "@/lib/types";
import { simulateScenario, getTrafficMultiplier } from "@/lib/calculations";

export const PLAN_YEARS: PlanYear[] = [2026, 2027];
export const DEFAULT_PLAN_YEAR: PlanYear = 2026;
export const NEXT_PLAN_YEAR: PlanYear = 2027;

const emptyYearPlan = (baseline: BaselineInput = DEFAULT_BASELINE): YearPlan => ({
  baseline,
  tasks: [],
  trafficChangePercent: 0,
  timelineMode: "plan",
  pmData: {},
});

const normalizeTasks = (tasks: Task[] | undefined, fallback: Task[] = []) =>
  (tasks ?? fallback).map((task) =>
    withInitiativeDefaults({
      ...task,
      devCommittedReleaseMonth: task.devCommittedReleaseMonth ?? task.releaseMonth,
    }),
  );

const normalizeBaseline = (baseline?: Partial<BaselineInput>): BaselineInput => {
  const merged = { ...DEFAULT_BASELINE, ...(baseline ?? {}) };
  return {
    sessions: merged.sessions,
    catalogCr: merged.catalogCr,
    pdpCr: merged.pdpCr,
    atcCr: merged.atcCr,
    checkoutCr: merged.checkoutCr,
    orderCr: merged.orderCr,
    buyoutRate: merged.buyoutRate,
    atv: merged.atv,
    upt: merged.upt,
    seasonalityWeights: normalizeSeasonalityWeights(merged.seasonalityWeights),
  };
};

const normalizeYearPlan = (plan: Partial<YearPlan> | undefined, fallbackTasks: Task[] = []): YearPlan => ({
  baseline: normalizeBaseline(plan?.baseline),
  tasks: normalizeTasks(plan?.tasks, fallbackTasks),
  trafficChangePercent: Number.isFinite(plan?.trafficChangePercent)
    ? Number(plan?.trafficChangePercent)
    : 0,
  timelineMode: plan?.timelineMode === "dev_committed" ? "dev_committed" : "plan",
  pmData: plan?.pmData && typeof plan.pmData === "object" ? plan.pmData : {},
});

const defaultYearPlans = (): Record<PlanYear, YearPlan> => ({
  2026: normalizeYearPlan({
    baseline: DEFAULT_BASELINE,
    tasks: DEFAULT_TASKS,
    trafficChangePercent: 0,
    timelineMode: "plan",
    pmData: {},
  }),
  2027: emptyYearPlan(),
});

const toPlanYear = (value: unknown): PlanYear =>
  value === 2027 || value === "2027" ? 2027 : 2026;

const safeDivide = (value: number, base: number) => (base > 0 ? value / base : 0);

export const baselineFromAnnualFunnel = (
  annual: AnnualFunnel,
  seasonalityWeights: number[] = DEFAULT_BASELINE.seasonalityWeights,
): BaselineInput => ({
  sessions: annual.sessions,
  catalogCr: safeDivide(annual.catalog, annual.sessions),
  pdpCr: safeDivide(annual.pdp, annual.catalog),
  atcCr: safeDivide(annual.atc, annual.pdp),
  checkoutCr: safeDivide(annual.checkout, annual.atc),
  orderCr: safeDivide(annual.orders, annual.checkout),
  buyoutRate: annual.buyoutRate,
  atv: annual.atv,
  upt: annual.upt,
  seasonalityWeights: normalizeSeasonalityWeights(seasonalityWeights),
});

const copyTaskForYear = (task: Task, sourceYear: PlanYear, targetYear: PlanYear): Task => ({
  ...task,
  id: `task-${targetYear}-${task.id}-${Date.now()}`,
  originYear: task.originYear ?? sourceYear,
  originTaskId: task.originTaskId ?? task.id,
  initiativeStatus: isPreBacklogStatus(task.initiativeStatus) ? "planned" : task.initiativeStatus,
});

/** Канонический ключ происхождения для дедупа копий между годами. */
export const taskCanonicalOriginKey = (task: Task, yearWhenNoOrigin: PlanYear): string =>
  `${task.originYear ?? yearWhenNoOrigin}:${task.originTaskId ?? task.id}`;

type StoreState = {
  activeYear: PlanYear;
  yearPlans: Record<PlanYear, YearPlan>;
  baseline: BaselineInput;
  /** Только roadmap (planned / in_progress / released). */
  tasks: Task[];
  /** Pre-backlog: draft / hypothesis — отдельно от roadmap. */
  ideas: Task[];
  trafficChangePercent: number;
  /** Сценарий сроков: продуктовый план или коммит разработки (PM). */
  timelineMode: TimelineMode;
  locale: Locale;
  /** Сортировка таблицы задач на вкладке «Бизнес и продукт» (null — порядок как в store). */
  roadmapTableSort: RoadmapTableSortState | null;
  setActiveYear: (year: PlanYear) => void;
  ensureYearPlan: (year: PlanYear) => void;
  copyTasksBetweenYears: (sourceYear: PlanYear, targetYear: PlanYear) => void;
  deriveYearBaselineFromYear: (sourceYear: PlanYear, targetYear: PlanYear) => void;
  applyMultiYearState: (payload: SharedRoadmapPayload) => void;
  setBaseline: (baseline: BaselineInput) => void;
  updateBaseline: <K extends Exclude<keyof BaselineInput, "seasonalityWeights">>(
    key: K,
    value: BaselineInput[K],
  ) => void;
  setSeasonalityWeights: (weights: number[]) => void;
  resetSeasonalityWeights: () => void;
  updateTask: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  updateIdea: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  setTasks: (tasks: Task[]) => void;
  setIdeas: (ideas: Task[]) => void;
  setAllTasksActive: (active: boolean) => void;
  setAllRoadmapTasksActive: (active: boolean) => void;
  addTask: () => void;
  /** Добавить сохранённую идею в начало списка pre-backlog. */
  addIdea: (task: Task) => void;
  promoteIdeaToRoadmap: (id: string) => void;
  promoteIdeaToRoadmapForYear: (id: string, year: PlanYear) => void;
  copyRoadmapTaskToYear: (taskId: string, targetYear: PlanYear) => void;
  moveRoadmapTaskToYear: (taskId: string, targetYear: PlanYear) => void;
  moveRoadmapTaskToIdeas: (taskId: string) => void;
  removeTask: (id: string) => void;
  removeIdea: (id: string) => void;
  duplicateTask: (id: string) => void;
  duplicateIdea: (id: string) => void;
  reorderTasks: (draggedId: string, targetId: string) => void;
  setTrafficChangePercent: (value: number) => void;
  setTimelineMode: (mode: TimelineMode) => void;
  setLocale: (locale: Locale) => void;
  toggleRoadmapTableSort: (column: RoadmapSortColumn) => void;
  resetRoadmapTableSort: () => void;
};

const newRoadmapTaskTemplate = (index: number): Task => ({
  id: `task-new-${Date.now()}-${index}`,
  project: "Custom",
  taskName: `Новая задача ${index}`,
  priority: "p2",
  initiativeStatus: "planned",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "medium",
  effort: "m",
  stage1: "order",
  impact1Type: "relative_percent",
  impact1Value: 0,
  stage2: undefined,
  impact2Type: undefined,
  impact2Value: 0,
  releaseMonth: 1,
  devCommittedReleaseMonth: 1,
  active: true,
  comment: "",
});

export const useCalculatorStore = create<StoreState>()(
  persist(
    (set) => ({
      activeYear: DEFAULT_PLAN_YEAR,
      yearPlans: defaultYearPlans(),
      baseline: DEFAULT_BASELINE,
      tasks: DEFAULT_TASKS,
      ideas: [],
      trafficChangePercent: 0,
      timelineMode: "plan",
      locale: "ru",
      roadmapTableSort: null,
      setActiveYear: (year) =>
        set((state) => {
          const planYear = toPlanYear(year);
          const plan = state.yearPlans[planYear] ?? emptyYearPlan();
          return {
            activeYear: planYear,
            baseline: plan.baseline,
            tasks: plan.tasks,
            trafficChangePercent: plan.trafficChangePercent,
            timelineMode: plan.timelineMode ?? "plan",
          };
        }),
      ensureYearPlan: (year) =>
        set((state) => {
          const planYear = toPlanYear(year);
          if (state.yearPlans[planYear]) {
            return state;
          }
          return {
            yearPlans: {
              ...state.yearPlans,
              [planYear]: emptyYearPlan(state.baseline),
            },
          };
        }),
      copyTasksBetweenYears: (sourceYear, targetYear) =>
        set((state) => {
          const source = state.yearPlans[toPlanYear(sourceYear)];
          const targetYearPlan = toPlanYear(targetYear);
          const target = state.yearPlans[targetYearPlan] ?? emptyYearPlan(state.baseline);
          if (!source) return state;
          const existingOrigins = new Set(
            target.tasks.map((task) => `${task.originYear ?? ""}:${task.originTaskId ?? ""}`),
          );
          const copied = source.tasks
            .filter((task) => !existingOrigins.has(`${sourceYear}:${task.id}`))
            .map((task) => copyTaskForYear(task, toPlanYear(sourceYear), targetYearPlan));
          const nextTarget = { ...target, tasks: [...copied, ...target.tasks] };
          return {
            yearPlans: {
              ...state.yearPlans,
              [targetYearPlan]: nextTarget,
            },
            ...(state.activeYear === targetYearPlan ? { tasks: nextTarget.tasks } : {}),
          };
        }),
      deriveYearBaselineFromYear: (sourceYear, targetYear) =>
        set((state) => {
          const source = state.yearPlans[toPlanYear(sourceYear)];
          const targetYearPlan = toPlanYear(targetYear);
          const target = state.yearPlans[targetYearPlan] ?? emptyYearPlan(state.baseline);
          if (!source) return state;
          const annual = simulateScenario(
            source.baseline,
            source.tasks,
            getTrafficMultiplier(source.trafficChangePercent),
            { timelineMode: source.timelineMode },
          ).annual;
          const nextTarget = {
            ...target,
            baseline: baselineFromAnnualFunnel(annual, target.baseline.seasonalityWeights),
          };
          return {
            yearPlans: {
              ...state.yearPlans,
              [targetYearPlan]: nextTarget,
            },
            ...(state.activeYear === targetYearPlan ? { baseline: nextTarget.baseline } : {}),
          };
        }),
      applyMultiYearState: (payload) =>
        set((state) => {
          const activeYear = toPlanYear(payload.activeYear);
          const yearPlans: Record<PlanYear, YearPlan> = {
            2026: normalizeYearPlan(payload.yearPlans?.[2026] ?? state.yearPlans[2026]),
            2027: normalizeYearPlan(payload.yearPlans?.[2027] ?? state.yearPlans[2027]),
          };
          const activePlan = yearPlans[activeYear] ?? yearPlans[2026];
          return {
            activeYear,
            yearPlans,
            baseline: activePlan.baseline,
            tasks: activePlan.tasks,
            ideas: normalizeTasks(payload.sharedIdeas, []),
            trafficChangePercent: activePlan.trafficChangePercent,
            timelineMode: activePlan.timelineMode ?? "plan",
            locale: payload.locale ?? state.locale,
          };
        }),
      setBaseline: (incoming) =>
        set((state) => {
          const merged = { ...state.baseline, ...incoming };
          const baseline = {
            ...merged,
            seasonalityWeights: normalizeSeasonalityWeights(merged.seasonalityWeights),
          };
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            baseline,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, baseline },
            },
          };
        }),
      updateBaseline: (key, value) =>
        set((state) => {
          const num = value as number;
          const baseline = {
            ...state.baseline,
            [key]: Number.isFinite(num) ? num : 0,
          };
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            baseline,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, baseline },
            },
          };
        }),
      setSeasonalityWeights: (weights) =>
        set((state) => {
          const baseline = {
            ...state.baseline,
            seasonalityWeights: normalizeSeasonalityWeights(weights),
          };
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            baseline,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, baseline },
            },
          };
        }),
      resetSeasonalityWeights: () =>
        set((state) => {
          const baseline = {
            ...state.baseline,
            seasonalityWeights: uniformSeasonalityWeights(),
          };
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            baseline,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, baseline },
            },
          };
        }),
      updateTask: (id, key, value) =>
        set((state) => {
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          if (key === "initiativeStatus" && isPreBacklogStatus(value as InitiativeStatus)) {
            const task = state.tasks.find((t) => t.id === id);
            if (!task) return state;
            const demoted = buildDemotedIdeaTaskFromRoadmapTask({
              ...task,
              initiativeStatus: value as InitiativeStatus,
            });
            const nextTasks = state.tasks.filter((t) => t.id !== id);
            return {
              tasks: nextTasks,
              ideas: [demoted, ...state.ideas],
              yearPlans: {
                ...state.yearPlans,
                [state.activeYear]: { ...currentPlan, tasks: nextTasks },
              },
            };
          }
          const nextTasks = state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  [key]: value,
                }
              : task,
          );
          return {
            tasks: nextTasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks: nextTasks },
            },
          };
        }),
      updateIdea: (id, key, value) =>
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id
              ? {
                  ...idea,
                  [key]: value,
                }
              : idea,
          ),
        })),
      setTasks: (tasks) =>
        set((state) => {
          const nextTasks = normalizeTasks(tasks);
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks: nextTasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks: nextTasks },
            },
          };
        }),
      setIdeas: (ideas) => set({ ideas }),
      setAllTasksActive: (active) =>
        set((state) => {
          const tasks = state.tasks.map((task) => ({
            ...task,
            active,
          }));
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks },
            },
            ideas: state.ideas.map((idea) => ({
              ...idea,
              active,
            })),
          };
        }),
      setAllRoadmapTasksActive: (active) =>
        set((state) => {
          const tasks = state.tasks.map((task) => ({ ...task, active }));
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks },
            },
          };
        }),
      addTask: () =>
        set((state) => {
          const tasks = [newRoadmapTaskTemplate(state.tasks.length + 1), ...state.tasks];
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks },
            },
          };
        }),
      addIdea: (task) =>
        set((state) => ({
          ideas: [task, ...state.ideas],
        })),
      promoteIdeaToRoadmap: (id) =>
        set((state) => {
          const targetYear = state.activeYear;
          const idea = state.ideas.find((i) => i.id === id);
          if (!idea) return state;
          const targetPlan = state.yearPlans[targetYear] ?? emptyYearPlan();
          if (targetPlan.tasks.some((t) => t.originTaskId === idea.id)) return state;
          const promoted = {
            ...buildPromotedRoadmapTaskFromIdea(idea),
            id: `task-${targetYear}-${idea.id}-${Date.now()}`,
            originTaskId: idea.id,
          };
          const tasks = [promoted, ...targetPlan.tasks];
          const nextYearPlans = {
            ...state.yearPlans,
            [targetYear]: { ...targetPlan, tasks },
          };
          return {
            yearPlans: nextYearPlans,
            ...(state.activeYear === targetYear ? { tasks } : {}),
          };
        }),
      promoteIdeaToRoadmapForYear: (id, year) =>
        set((state) => {
          const targetYear = toPlanYear(year);
          const idea = state.ideas.find((i) => i.id === id);
          if (!idea) return state;
          const targetPlan = state.yearPlans[targetYear] ?? emptyYearPlan();
          if (targetPlan.tasks.some((t) => t.originTaskId === idea.id)) return state;
          const promoted = {
            ...buildPromotedRoadmapTaskFromIdea(idea),
            id: `task-${targetYear}-${idea.id}-${Date.now()}`,
            originTaskId: idea.id,
          };
          const tasks = [promoted, ...targetPlan.tasks];
          const nextYearPlans = {
            ...state.yearPlans,
            [targetYear]: { ...targetPlan, tasks },
          };
          return {
            yearPlans: nextYearPlans,
            ...(state.activeYear === targetYear ? { tasks } : {}),
          };
        }),
      copyRoadmapTaskToYear: (taskId, targetYear) =>
        set((state) => {
          const target = toPlanYear(targetYear);
          const sourceYear = state.activeYear;
          if (target === sourceYear) return state;
          const sourcePlan = state.yearPlans[sourceYear] ?? emptyYearPlan();
          const destPlan = state.yearPlans[target] ?? emptyYearPlan();
          const task = sourcePlan.tasks.find((t) => t.id === taskId);
          if (!task) return state;
          const originKey = taskCanonicalOriginKey(task, sourceYear);
          if (destPlan.tasks.some((t) => taskCanonicalOriginKey(t, target) === originKey)) {
            return state;
          }
          const copy = copyTaskForYear(task, sourceYear, target);
          const nextDestTasks = [copy, ...destPlan.tasks];
          const nextYearPlans = {
            ...state.yearPlans,
            [target]: { ...destPlan, tasks: nextDestTasks },
          };
          return {
            yearPlans: nextYearPlans,
            ...(state.activeYear === target ? { tasks: nextDestTasks } : {}),
          };
        }),
      moveRoadmapTaskToYear: (taskId, targetYear) =>
        set((state) => {
          const target = toPlanYear(targetYear);
          const sourceYear = state.activeYear;
          if (target === sourceYear) return state;
          const sourcePlan = state.yearPlans[sourceYear] ?? emptyYearPlan();
          const destPlan = state.yearPlans[target] ?? emptyYearPlan();
          const task = sourcePlan.tasks.find((t) => t.id === taskId);
          if (!task) return state;
          const originKey = taskCanonicalOriginKey(task, sourceYear);
          if (destPlan.tasks.some((t) => taskCanonicalOriginKey(t, target) === originKey)) {
            return state;
          }
          const copy = copyTaskForYear(task, sourceYear, target);
          const nextSourceTasks = sourcePlan.tasks.filter((t) => t.id !== taskId);
          const nextDestTasks = [copy, ...destPlan.tasks];
          const nextYearPlans = {
            ...state.yearPlans,
            [sourceYear]: { ...sourcePlan, tasks: nextSourceTasks },
            [target]: { ...destPlan, tasks: nextDestTasks },
          };
          let tasks = state.tasks;
          if (state.activeYear === sourceYear) tasks = nextSourceTasks;
          else if (state.activeYear === target) tasks = nextDestTasks;
          return {
            yearPlans: nextYearPlans,
            tasks,
          };
        }),
      moveRoadmapTaskToIdeas: (taskId) =>
        set((state) => {
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          const task = state.tasks.find((t) => t.id === taskId);
          if (!task) return state;
          const demoted = buildDemotedIdeaTaskFromRoadmapTask({
            ...task,
            initiativeStatus: "hypothesis",
          });
          const nextTasks = state.tasks.filter((t) => t.id !== taskId);
          return {
            tasks: nextTasks,
            ideas: [demoted, ...state.ideas],
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks: nextTasks },
            },
          };
        }),
      removeTask: (id) =>
        set((state) => {
          const tasks = state.tasks.filter((task) => task.id !== id);
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks },
            },
          };
        }),
      removeIdea: (id) =>
        set((state) => ({
          ideas: state.ideas.filter((idea) => idea.id !== id),
        })),
      duplicateTask: (id) =>
        set((state) => {
          const task = state.tasks.find((entry) => entry.id === id);

          if (!task) {
            return state;
          }

          const tasks = [
              {
                ...task,
                id: `task-copy-${Date.now()}`,
                taskName: `${task.taskName} Copy`,
              },
              ...state.tasks,
            ];
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks },
            },
          };
        }),
      duplicateIdea: (id) =>
        set((state) => {
          const idea = state.ideas.find((entry) => entry.id === id);
          if (!idea) return state;
          return {
            ideas: [
              {
                ...idea,
                id: `idea-copy-${Date.now()}`,
                taskName: `${idea.taskName} Copy`,
              },
              ...state.ideas,
            ],
          };
        }),
      reorderTasks: (draggedId, targetId) =>
        set((state) => {
          const fromIdx = state.tasks.findIndex((t) => t.id === draggedId);
          const toIdx = state.tasks.findIndex((t) => t.id === targetId);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;

          const next = [...state.tasks];
          const [removed] = next.splice(fromIdx, 1);
          const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
          next.splice(insertIdx, 0, removed);
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            tasks: next,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, tasks: next },
            },
          };
        }),
      setTrafficChangePercent: (value) =>
        set((state) => {
          const trafficChangePercent = Number.isFinite(value) ? value : 0;
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            trafficChangePercent,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, trafficChangePercent },
            },
          };
        }),
      setTimelineMode: (timelineMode) =>
        set((state) => {
          const currentPlan = state.yearPlans[state.activeYear] ?? emptyYearPlan();
          return {
            timelineMode,
            yearPlans: {
              ...state.yearPlans,
              [state.activeYear]: { ...currentPlan, timelineMode },
            },
          };
        }),
      setLocale: (locale) => set({ locale }),
      toggleRoadmapTableSort: (column) =>
        set((state) => {
          const cur = state.roadmapTableSort;
          if (cur?.column === column) {
            return {
              roadmapTableSort:
                cur.direction === "asc" ? { column, direction: "desc" } : null,
            };
          }
          return { roadmapTableSort: { column, direction: "asc" } };
        }),
      resetRoadmapTableSort: () => set({ roadmapTableSort: null }),
    }),
    {
      name: "roadmap-impact-calculator-store",
      version: 8,
      migrate: (persistedState, persistedVersion) => {
        const version = typeof persistedVersion === "number" ? persistedVersion : 0;
        const state = persistedState as {
          activeYear?: PlanYear;
          yearPlans?: Partial<Record<PlanYear, Partial<YearPlan>>>;
          baseline?: Partial<BaselineInput> & {
            catalog?: number;
            pdp?: number;
            atc?: number;
            checkout?: number;
            orders?: number;
            seasonalityWeights?: unknown;
          };
          tasks?: Array<Task & { stream?: string }>;
          ideas?: Task[];
          trafficChangePercent?: number;
          timelineMode?: TimelineMode;
          locale?: Locale;
          roadmapTableSort?: unknown;
        };

        const activeYear = toPlanYear(state?.activeYear);
        const persistedYearPlans = state?.yearPlans;
        const baselineState = state?.baseline;
        const hasLegacyAbsoluteBaseline =
          typeof baselineState?.catalog === "number" &&
          typeof baselineState?.pdp === "number" &&
          typeof baselineState?.atc === "number" &&
          typeof baselineState?.checkout === "number" &&
          typeof baselineState?.orders === "number" &&
          typeof baselineState?.sessions === "number";

        const migratedBaselineCore: Omit<BaselineInput, "seasonalityWeights"> =
          hasLegacyAbsoluteBaseline
            ? {
                sessions: baselineState.sessions ?? DEFAULT_BASELINE.sessions,
                catalogCr:
                  (baselineState.catalog ?? 0) / Math.max(baselineState.sessions ?? 1, 1),
                pdpCr: (baselineState.pdp ?? 0) / Math.max(baselineState.catalog ?? 1, 1),
                atcCr: (baselineState.atc ?? 0) / Math.max(baselineState.pdp ?? 1, 1),
                checkoutCr:
                  (baselineState.checkout ?? 0) / Math.max(baselineState.atc ?? 1, 1),
                orderCr:
                  (baselineState.orders ?? 0) / Math.max(baselineState.checkout ?? 1, 1),
                buyoutRate: baselineState.buyoutRate ?? DEFAULT_BASELINE.buyoutRate,
                atv: baselineState.atv ?? DEFAULT_BASELINE.atv,
                upt: baselineState.upt ?? DEFAULT_BASELINE.upt,
              }
            : {
                sessions: baselineState?.sessions ?? DEFAULT_BASELINE.sessions,
                catalogCr: baselineState?.catalogCr ?? DEFAULT_BASELINE.catalogCr,
                pdpCr: baselineState?.pdpCr ?? DEFAULT_BASELINE.pdpCr,
                atcCr: baselineState?.atcCr ?? DEFAULT_BASELINE.atcCr,
                checkoutCr: baselineState?.checkoutCr ?? DEFAULT_BASELINE.checkoutCr,
                orderCr: baselineState?.orderCr ?? DEFAULT_BASELINE.orderCr,
                buyoutRate: baselineState?.buyoutRate ?? DEFAULT_BASELINE.buyoutRate,
                atv: baselineState?.atv ?? DEFAULT_BASELINE.atv,
                upt: baselineState?.upt ?? DEFAULT_BASELINE.upt,
              };

        let migratedTasks =
          state?.tasks?.map((task) => ({
            ...task,
            project: task.project ?? task.stream ?? "Custom",
            priority: (task.priority as Priority | undefined) ?? "p2",
          })) ?? DEFAULT_TASKS;

        migratedTasks = migratedTasks.map((task) =>
          withInitiativeDefaults({
            ...(task as Task),
            devCommittedReleaseMonth:
              (task as Task).devCommittedReleaseMonth ?? (task as Task).releaseMonth,
          }),
        );

        let ideas: Task[] = [];
        if (version >= 4) {
          ideas = (state.ideas ?? []).map((t) =>
            withInitiativeDefaults({
              ...(t as Task),
              devCommittedReleaseMonth:
                (t as Task).devCommittedReleaseMonth ?? (t as Task).releaseMonth,
            }),
          );
        } else {
          ideas = migratedTasks.filter((t) => isPreBacklogStatus(t.initiativeStatus));
          migratedTasks = migratedTasks.filter((t) => !isPreBacklogStatus(t.initiativeStatus));
          if (migratedTasks.length === 0) {
            migratedTasks = DEFAULT_TASKS;
          }
        }

        const timelineMode: TimelineMode =
          state.timelineMode === "dev_committed" ? "dev_committed" : "plan";

        const roadmapTableSort =
          version >= 6 ? parsePersistedRoadmapTableSort(state.roadmapTableSort) : null;

        const seasonalityWeights = normalizeSeasonalityWeights(
          Array.isArray(baselineState?.seasonalityWeights)
            ? (baselineState.seasonalityWeights as number[])
            : undefined,
        );

        const legacyPlan = normalizeYearPlan({
          baseline: { ...migratedBaselineCore, seasonalityWeights },
          tasks: migratedTasks,
          trafficChangePercent: state?.trafficChangePercent ?? 0,
          timelineMode,
          pmData: {},
        });
        const yearPlans: Record<PlanYear, YearPlan> = {
          2026: normalizeYearPlan(persistedYearPlans?.[2026], legacyPlan.tasks),
          2027: normalizeYearPlan(persistedYearPlans?.[2027], []),
        };
        if (!persistedYearPlans?.[2026]) {
          yearPlans[2026] = legacyPlan;
        }
        const activePlan = yearPlans[activeYear] ?? yearPlans[2026];

        return {
          activeYear,
          yearPlans,
          baseline: activePlan.baseline,
          tasks: activePlan.tasks,
          ideas,
          trafficChangePercent: activePlan.trafficChangePercent,
          timelineMode: activePlan.timelineMode ?? "plan",
          locale: state?.locale ?? "ru",
          roadmapTableSort,
        };
      },
    },
  ),
);

export const normalizeStage = (value: string): AdjustableStage | undefined =>
  value ? (value as AdjustableStage) : undefined;

export const normalizeImpactType = (value: string): ImpactType | undefined =>
  value ? (value as ImpactType) : undefined;

export const normalizePriority = (value: string): Priority | undefined =>
  value ? (value as Priority) : undefined;
