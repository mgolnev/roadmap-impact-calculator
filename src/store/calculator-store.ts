import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_BASELINE, DEFAULT_TASKS } from "@/lib/constants";
import {
  buildDemotedIdeaTaskFromRoadmapTask,
  buildPromotedRoadmapTaskFromIdea,
  isPreBacklogStatus,
  withInitiativeDefaults,
} from "@/lib/initiative";
import { AdjustableStage, BaselineInput, ImpactType, InitiativeStatus, Locale, Priority, Task } from "@/lib/types";

type StoreState = {
  baseline: BaselineInput;
  /** Только roadmap (planned / in_progress / released). */
  tasks: Task[];
  /** Pre-backlog: draft / hypothesis — отдельно от roadmap. */
  ideas: Task[];
  trafficChangePercent: number;
  locale: Locale;
  setBaseline: (baseline: BaselineInput) => void;
  updateBaseline: <K extends keyof BaselineInput>(key: K, value: number) => void;
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
  setLocale: (locale: Locale) => void;
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
      locale: "ru",
      setBaseline: (baseline) =>
        set({
          baseline: {
            ...baseline,
          },
        }),
      updateBaseline: (key, value) =>
        set((state) => ({
          baseline: {
            ...state.baseline,
            [key]: Number.isFinite(value) ? value : 0,
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
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "roadmap-impact-calculator-store",
      version: 4,
      migrate: (persistedState, persistedVersion) => {
        const version = typeof persistedVersion === "number" ? persistedVersion : 0;
        const state = persistedState as {
          baseline?: Partial<BaselineInput> & {
            catalog?: number;
            pdp?: number;
            atc?: number;
            checkout?: number;
            orders?: number;
          };
          tasks?: Array<Task & { stream?: string }>;
          ideas?: Task[];
          trafficChangePercent?: number;
          locale?: Locale;
        };

        const baselineState = state?.baseline;
        const hasLegacyAbsoluteBaseline =
          typeof baselineState?.catalog === "number" &&
          typeof baselineState?.pdp === "number" &&
          typeof baselineState?.atc === "number" &&
          typeof baselineState?.checkout === "number" &&
          typeof baselineState?.orders === "number" &&
          typeof baselineState?.sessions === "number";

        const migratedBaseline: BaselineInput = hasLegacyAbsoluteBaseline
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

        migratedTasks = migratedTasks.map((task) => withInitiativeDefaults(task as Task));

        let ideas: Task[] = [];
        if (version >= 4) {
          ideas = (state.ideas ?? []).map((t) => withInitiativeDefaults(t as Task));
        } else {
          const normalized = migratedTasks.map((t) => withInitiativeDefaults(t as Task));
          ideas = normalized.filter((t) => isPreBacklogStatus(t.initiativeStatus));
          migratedTasks = normalized.filter((t) => !isPreBacklogStatus(t.initiativeStatus));
          if (migratedTasks.length === 0) {
            migratedTasks = DEFAULT_TASKS;
          }
        }

        return {
          baseline: migratedBaseline,
          tasks: migratedTasks,
          ideas,
          trafficChangePercent: state?.trafficChangePercent ?? 0,
          locale: state?.locale ?? "ru",
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
