import { create } from "zustand";
import { persist } from "zustand/middleware";

import { PhaseName, PhaseStatus, TaskPMData } from "@/lib/types";

export const emptyPhases = (): Record<PhaseName, PhaseStatus> => ({
  prd: "not_started",
  design: "not_started",
  analytics: "not_started",
  development: "not_started",
  qa: "not_started",
  ab_test: "not_started",
  rollout: "not_started",
  results: "not_started",
});

export const emptyPMData = (): TaskPMData => ({
  startDate: "",
  endDate: "",
  manager: "",
  managerGJ: "",
  blocker: "",
  needsAbTest: false,
  devCostHours: 0,
  phases: emptyPhases(),
});

type PMStoreState = {
  pmData: Record<string, TaskPMData>;
  updatePMField: <K extends keyof Omit<TaskPMData, "phases">>(
    taskId: string,
    field: K,
    value: TaskPMData[K],
  ) => void;
  updatePhase: (taskId: string, phase: PhaseName, status: PhaseStatus) => void;
  cyclePhase: (taskId: string, phase: PhaseName) => void;
  setPMData: (data: Record<string, TaskPMData>) => void;
  ensureTask: (taskId: string) => void;
};

const PHASE_STATUS_CYCLE: PhaseStatus[] = [
  "not_started",
  "in_progress",
  "done",
  "blocked",
  "skipped",
];

const DEFAULT_PM_DATA: Record<string, TaskPMData> = {
  "task-1": {
    startDate: "2026-01",
    endDate: "2026-04",
    manager: "Liga",
    managerGJ: "Evgenia Kozlova",
    blocker: "",
    needsAbTest: true,
    devCostHours: 1032,
    phases: { prd: "done", design: "in_progress", analytics: "done", development: "not_started", qa: "not_started", ab_test: "not_started", rollout: "not_started", results: "not_started" },
  },
  "task-2": {
    startDate: "2026-03",
    endDate: "2026-04",
    manager: "Liga",
    managerGJ: "Evgenia Kozlova",
    blocker: "OMS",
    needsAbTest: true,
    devCostHours: 488,
    phases: emptyPhases(),
  },
  "task-3": {
    startDate: "2026-03",
    endDate: "2026-04",
    manager: "OMS",
    managerGJ: "Alexey Kulikov",
    blocker: "OMS",
    needsAbTest: true,
    devCostHours: 0,
    phases: emptyPhases(),
  },
  "task-4": {
    startDate: "2026-03",
    endDate: "2026-04",
    manager: "Liga",
    managerGJ: "Alexey Kulikov",
    blocker: "",
    needsAbTest: true,
    devCostHours: 528,
    phases: emptyPhases(),
  },
  "task-5": {
    startDate: "2026-03",
    endDate: "2026-04",
    manager: "Liga",
    managerGJ: "Evgeniy Petrov",
    blocker: "BNPL operator agreement",
    needsAbTest: false,
    devCostHours: 1840,
    phases: emptyPhases(),
  },
  "task-6": {
    startDate: "2026-05",
    endDate: "2026-07",
    manager: "Liga",
    managerGJ: "Michail Golnev",
    blocker: "OMS",
    needsAbTest: true,
    devCostHours: 2400,
    phases: emptyPhases(),
  },
  "task-7": {
    startDate: "2026-02",
    endDate: "2026-03",
    manager: "Liga",
    managerGJ: "Evgenia Kozlova",
    blocker: "",
    needsAbTest: true,
    devCostHours: 664,
    phases: emptyPhases(),
  },
  "task-8": {
    startDate: "2026-03",
    endDate: "2026-04",
    manager: "Liga",
    managerGJ: "Evgeniy Petrov",
    blocker: "",
    needsAbTest: true,
    devCostHours: 264,
    phases: emptyPhases(),
  },
  "task-9": {
    startDate: "2026-04",
    endDate: "2026-04",
    manager: "Mindbox",
    managerGJ: "Evgeniy Petrov",
    blocker: "",
    needsAbTest: true,
    devCostHours: 10,
    phases: emptyPhases(),
  },
  "task-10": {
    startDate: "2026-04",
    endDate: "2026-06",
    manager: "Liga",
    managerGJ: "Evgeniy Petrov",
    blocker: "",
    needsAbTest: true,
    devCostHours: 2080,
    phases: emptyPhases(),
  },
  "task-11": {
    startDate: "2026-05",
    endDate: "2026-07",
    manager: "TBD",
    managerGJ: "Evgeniy Petrov",
    blocker: "Contractor needed",
    needsAbTest: true,
    devCostHours: 176,
    phases: emptyPhases(),
  },
  "task-12": {
    startDate: "2026-06",
    endDate: "2026-08",
    manager: "TBD",
    managerGJ: "Evgeniy Petrov",
    blocker: "Contractor needed",
    needsAbTest: true,
    devCostHours: 304,
    phases: emptyPhases(),
  },
  "task-13": {
    startDate: "2026-06",
    endDate: "2026-09",
    manager: "TBD",
    managerGJ: "Evgeniy Petrov",
    blocker: "Contractor needed",
    needsAbTest: true,
    devCostHours: 1112,
    phases: emptyPhases(),
  },
  "task-14": {
    startDate: "2026-06",
    endDate: "2026-09",
    manager: "TBD",
    managerGJ: "Evgeniy Petrov",
    blocker: "Contractor needed",
    needsAbTest: true,
    devCostHours: 980,
    phases: emptyPhases(),
  },
  "task-15": {
    startDate: "2026-04",
    endDate: "2026-07",
    manager: "TBD",
    managerGJ: "Evgeniy Zon",
    blocker: "Contractor needed",
    needsAbTest: false,
    devCostHours: 520,
    phases: emptyPhases(),
  },
  "task-16": {
    startDate: "2026-06",
    endDate: "2026-11",
    manager: "TBD",
    managerGJ: "Evgenia Kozlova",
    blocker: "Contractor needed",
    needsAbTest: false,
    devCostHours: 100,
    phases: emptyPhases(),
  },
  "task-17": {
    startDate: "2026-09",
    endDate: "2026-10",
    manager: "TBD",
    managerGJ: "Evgeniy Petrov",
    blocker: "Contractor + budget needed",
    needsAbTest: false,
    devCostHours: 50,
    phases: emptyPhases(),
  },
  "task-18": {
    startDate: "2026-08",
    endDate: "2026-11",
    manager: "TBD",
    managerGJ: "Evgeniy Petrov",
    blocker: "Contractor + budget needed",
    needsAbTest: true,
    devCostHours: 50,
    phases: emptyPhases(),
  },
  "task-19": {
    startDate: "2026-04",
    endDate: "2026-12",
    manager: "TBD",
    managerGJ: "Alexandr Zakomirmy",
    blocker: "Contractor needed",
    needsAbTest: false,
    devCostHours: 1000,
    phases: emptyPhases(),
  },
};

export const usePMStore = create<PMStoreState>()(
  persist(
    (set, get) => ({
      pmData: DEFAULT_PM_DATA,
      updatePMField: (taskId, field, value) =>
        set((state) => {
          const current = state.pmData[taskId] ?? emptyPMData();
          return {
            pmData: {
              ...state.pmData,
              [taskId]: { ...current, [field]: value },
            },
          };
        }),
      updatePhase: (taskId, phase, status) =>
        set((state) => {
          const current = state.pmData[taskId] ?? emptyPMData();
          return {
            pmData: {
              ...state.pmData,
              [taskId]: {
                ...current,
                phases: { ...current.phases, [phase]: status },
              },
            },
          };
        }),
      cyclePhase: (taskId, phase) => {
        const state = get();
        const current = state.pmData[taskId] ?? emptyPMData();
        const currentStatus = current.phases[phase];
        const nextIndex = (PHASE_STATUS_CYCLE.indexOf(currentStatus) + 1) % PHASE_STATUS_CYCLE.length;
        state.updatePhase(taskId, phase, PHASE_STATUS_CYCLE[nextIndex]);
      },
      setPMData: (data) => set({ pmData: data }),
      ensureTask: (taskId) =>
        set((state) => {
          if (state.pmData[taskId]) return state;
          return {
            pmData: { ...state.pmData, [taskId]: emptyPMData() },
          };
        }),
    }),
    {
      name: "roadmap-pm-store",
      version: 1,
    },
  ),
);
