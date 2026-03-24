import type { Locale, Task, TaskValueMetrics } from "@/lib/types";

import { formatTaskImpactSummary } from "@/lib/task-impact-summary";

export type TopTaskRevenueRow = {
  id: string;
  taskName: string;
  project: string;
  incremental: number;
  impactSummary: string;
  releaseMonth: number;
};

export type TopTasksRevenueBundle = {
  /** Строки таблицы (ограничение по числу). */
  displayRows: TopTaskRevenueRow[];
  /** Сумма инкремента по всем отфильтрованным задачам. */
  sumTotal: number;
  sumTop3: number;
  sumTop10: number;
};

const DISPLAY_LIMIT = 10;

/**
 * Ранжирование задач по incremental в плане + агрегаты для футера (ТОП‑3 / ТОП‑10 / всего).
 */
export const buildTopTasksRevenueBundle = (
  tasks: Task[],
  taskMetrics: Record<string, TaskValueMetrics>,
  locale: Locale,
  includeTask: (task: Task) => boolean,
): TopTasksRevenueBundle => {
  const sorted = tasks
    .filter(includeTask)
    .map((task) => ({
      id: task.id,
      taskName: task.taskName.trim() || "—",
      project: task.project.trim(),
      incremental: taskMetrics[task.id]?.incrementalCurrent ?? 0,
      impactSummary: formatTaskImpactSummary(task, locale),
      releaseMonth: task.releaseMonth,
    }))
    .sort((a, b) => b.incremental - a.incremental);

  const sumTotal = sorted.reduce((s, r) => s + r.incremental, 0);
  const sumTop3 = sorted.slice(0, 3).reduce((s, r) => s + r.incremental, 0);
  const sumTop10 = sorted.slice(0, 10).reduce((s, r) => s + r.incremental, 0);

  return {
    displayRows: sorted.slice(0, DISPLAY_LIMIT),
    sumTotal,
    sumTop3,
    sumTop10,
  };
};
