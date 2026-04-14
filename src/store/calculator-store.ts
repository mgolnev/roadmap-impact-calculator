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
  BaselineInput,
  ImpactType,
  InitiativeStatus,
  Locale,
  Priority,
  Task,
  TimelineMode,
} from "@/lib/types";

type StoreState = {
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
      baseline: DEFAULT_BASELINE,
      tasks: DEFAULT_TASKS,
      ideas: [],
      trafficChangePercent: 0,
      timelineMode: "plan",
      locale: "ru",
      roadmapTableSort: null,
      setBaseline: (incoming) =>
        set((state) => {
          const merged = { ...state.baseline, ...incoming };
          return {
            baseline: {
              ...merged,
              seasonalityWeights: normalizeSeasonalityWeights(merged.seasonalityWeights),
            },
          };
        }),
      updateBaseline: (key, value) =>
        set((state) => {
          const num = value as number;
          return {
            baseline: {
              ...state.baseline,
              [key]: Number.isFinite(num) ? num : 0,
            },
          };
        }),
      setSeasonalityWeights: (weights) =>
        set((state) => ({
          baseline: {
            ...state.baseline,
            seasonalityWeights: normalizeSeasonalityWeights(weights),
          },
        })),
      resetSeasonalityWeights: () =>
        set((state) => ({
          baseline: {
            ...state.baseline,
            seasonalityWeights: uniformSeasonalityWeights(),
          },
        })),
      updateTask: (id, key, value) =>
        set((state) => {
          if (key === "initiativeStatus" && isPreBacklogStatus(value as InitiativeStatus)) {
            const task = state.tasks.find((t) => t.id === id);
            if (!task) return state;
            const demoted = buildDemotedIdeaTaskFromRoadmapTask({
              ...task,
              initiativeStatus: value as InitiativeStatus,
            });
            return {
              tasks: state.tasks.filter((t) => t.id !== id),
              ideas: [demoted, ...state.ideas],
            };
          }
          return {
            tasks: state.tasks.map((task) =>
              task.id === id
                ? {
                    ...task,
                    [key]: value,
                  }
                : task,
            ),
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
      setTasks: (tasks) => set({ tasks }),
      setIdeas: (ideas) => set({ ideas }),
      setAllTasksActive: (active) =>
        set((state) => ({
          tasks: state.tasks.map((task) => ({
            ...task,
            active,
          })),
          ideas: state.ideas.map((idea) => ({
            ...idea,
            active,
          })),
        })),
      setAllRoadmapTasksActive: (active) =>
        set((state) => ({
          tasks: state.tasks.map((task) => ({ ...task, active })),
        })),
      addTask: () =>
        set((state) => ({
          tasks: [newRoadmapTaskTemplate(state.tasks.length + 1), ...state.tasks],
        })),
      addIdea: (task) =>
        set((state) => ({
          ideas: [task, ...state.ideas],
        })),
      promoteIdeaToRoadmap: (id) =>
        set((state) => {
          const idea = state.ideas.find((i) => i.id === id);
          if (!idea) return state;
          const promoted = buildPromotedRoadmapTaskFromIdea(idea);
          return {
            ideas: state.ideas.filter((i) => i.id !== id),
            tasks: [promoted, ...state.tasks],
          };
        }),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
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

          return {
            tasks: [
              {
                ...task,
                id: `task-copy-${Date.now()}`,
                taskName: `${task.taskName} Copy`,
              },
              ...state.tasks,
            ],
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
          return { tasks: next };
        }),
      setTrafficChangePercent: (value) =>
        set({
          trafficChangePercent: Number.isFinite(value) ? value : 0,
        }),
      setTimelineMode: (timelineMode) => set({ timelineMode }),
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
      version: 7,
      migrate: (persistedState, persistedVersion) => {
        const version = typeof persistedVersion === "number" ? persistedVersion : 0;
        const state = persistedState as {
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

        return {
          baseline: { ...migratedBaselineCore, seasonalityWeights },
          tasks: migratedTasks,
          ideas,
          trafficChangePercent: state?.trafficChangePercent ?? 0,
          timelineMode,
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
