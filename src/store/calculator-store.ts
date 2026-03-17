import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_BASELINE, DEFAULT_TASKS } from "@/lib/constants";
import { AdjustableStage, BaselineInput, ImpactType, Locale, Priority, Task } from "@/lib/types";

type StoreState = {
  baseline: BaselineInput;
  tasks: Task[];
  trafficChangePercent: number;
  locale: Locale;
  updateBaseline: <K extends keyof BaselineInput>(key: K, value: number) => void;
  resetBaseline: () => void;
  updateTask: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  setTasks: (tasks: Task[]) => void;
  setAllTasksActive: (active: boolean) => void;
  addTask: () => void;
  removeTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  setTrafficChangePercent: (value: number) => void;
  setLocale: (locale: Locale) => void;
};

const newTaskTemplate = (index: number): Task => ({
  id: `task-new-${Date.now()}-${index}`,
  project: "Custom",
  taskName: `Новая задача ${index}`,
  priority: "p2",
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
      trafficChangePercent: 0,
      locale: "ru",
      updateBaseline: (key, value) =>
        set((state) => ({
          baseline: {
            ...state.baseline,
            [key]: Number.isFinite(value) ? value : 0,
          },
        })),
      resetBaseline: () => set({ baseline: DEFAULT_BASELINE }),
      updateTask: (id, key, value) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  [key]: value,
                }
              : task,
          ),
        })),
      setTasks: (tasks) => set({ tasks }),
      setAllTasksActive: (active) =>
        set((state) => ({
          tasks: state.tasks.map((task) => ({
            ...task,
            active,
          })),
        })),
      addTask: () =>
        set((state) => ({
          tasks: [newTaskTemplate(state.tasks.length + 1), ...state.tasks],
        })),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
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
      setTrafficChangePercent: (value) =>
        set({
          trafficChangePercent: Number.isFinite(value) ? value : 0,
        }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "roadmap-impact-calculator-store",
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as {
          baseline?: Partial<BaselineInput> & {
            catalog?: number;
            pdp?: number;
            atc?: number;
            checkout?: number;
            orders?: number;
          };
          tasks?: Array<Task & { stream?: string }>;
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

        const migratedTasks =
          state?.tasks?.map((task) => ({
            ...task,
            project: task.project ?? task.stream ?? "Custom",
            priority: (task.priority as Priority | undefined) ?? "p2",
          })) ?? DEFAULT_TASKS;

        return {
          baseline: migratedBaseline,
          tasks: migratedTasks,
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
