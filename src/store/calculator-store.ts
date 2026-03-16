import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_BASELINE, DEFAULT_TASKS } from "@/lib/constants";
import { AdjustableStage, BaselineInput, ImpactType, Task, TrafficScenarioKey } from "@/lib/types";

type StoreState = {
  baseline: BaselineInput;
  tasks: Task[];
  scenario: TrafficScenarioKey;
  updateBaseline: <K extends keyof BaselineInput>(key: K, value: number) => void;
  resetBaseline: () => void;
  updateTask: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  addTask: () => void;
  removeTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  setScenario: (scenario: TrafficScenarioKey) => void;
};

const newTaskTemplate = (index: number): Task => ({
  id: `task-new-${Date.now()}-${index}`,
  stream: "Custom",
  taskName: `Новая задача ${index}`,
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
      scenario: "base",
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
      addTask: () =>
        set((state) => ({
          tasks: [...state.tasks, newTaskTemplate(state.tasks.length + 1)],
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
              ...state.tasks,
              {
                ...task,
                id: `task-copy-${Date.now()}`,
                taskName: `${task.taskName} Copy`,
              },
            ],
          };
        }),
      setScenario: (scenario) => set({ scenario }),
    }),
    {
      name: "roadmap-impact-calculator-store",
    },
  ),
);

export const normalizeStage = (value: string): AdjustableStage | undefined =>
  value ? (value as AdjustableStage) : undefined;

export const normalizeImpactType = (value: string): ImpactType | undefined =>
  value ? (value as ImpactType) : undefined;
