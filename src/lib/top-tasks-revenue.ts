import type { Locale, Task, TaskValueMetrics, TimelineMode } from "@/lib/types";
import { effectiveReleaseMonth } from "@/lib/timeline";

import { formatTaskImpactCeoCompactSummary, formatTaskImpactCeoVerboseSummary } from "@/lib/task-impact-ceo";
import { formatTaskImpactSummary } from "@/lib/task-impact-summary";

export type TopTaskRevenueRow = {
  id: string;
  taskName: string;
  project: string;
  incremental: number;
  impactSummary: string;
  /** Колонка CR Δ в CEO-приложении: «+10% C/O», «+7pp BO». */
  impactCeoCompact: string;
  /** RU: развёрнуто «Чекаут: 10,0% к конверсии шага». */
  impactCeoVerbose: string;
  releaseMonth: number;
};

export type TopTasksRevenueBundle = {
  /** Строки таблицы (полный отсортированный список). */
  displayRows: TopTaskRevenueRow[];
  /** Сумма инкремента по всем отфильтрованным задачам. */
  sumTotal: number;
  sumTop3: number;
  sumTop10: number;
};

/**
 * Ранжирование задач по incremental в плане + агрегаты для футера (ТОП‑3 / ТОП‑10 / всего).
 */
export const buildTopTasksRevenueBundle = (
  tasks: Task[],
  taskMetrics: Record<string, TaskValueMetrics>,
  locale: Locale,
  includeTask: (task: Task) => boolean,
  timelineMode: TimelineMode = "plan",
): TopTasksRevenueBundle => {
  const sorted = tasks
    .filter(includeTask)
    .map((task) => ({
      id: task.id,
      taskName: task.taskName.trim() || "—",
      project: task.project.trim(),
      incremental: taskMetrics[task.id]?.incrementalCurrent ?? 0,
      impactSummary: formatTaskImpactSummary(task, locale),
      impactCeoCompact: formatTaskImpactCeoCompactSummary(task, locale),
      impactCeoVerbose: formatTaskImpactCeoVerboseSummary(task, locale),
      releaseMonth: effectiveReleaseMonth(task, timelineMode),
    }))
    .sort((a, b) => b.incremental - a.incremental);

  const sumTotal = sorted.reduce((s, r) => s + r.incremental, 0);
  const sumTop3 = sorted.slice(0, 3).reduce((s, r) => s + r.incremental, 0);
  const sumTop10 = sorted.slice(0, 10).reduce((s, r) => s + r.incremental, 0);

  return {
    displayRows: sorted,
    sumTotal,
    sumTop3,
    sumTop10,
  };
};
