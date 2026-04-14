import type { Task, TimelineMode } from "@/lib/types";

/** Месяц старта эффекта в модели при выбранном сценарии сроков. */
export const effectiveReleaseMonth = (task: Task, mode: TimelineMode): number =>
  mode === "dev_committed" ? task.devCommittedReleaseMonth : task.releaseMonth;
