import type { Task, TaskValueMetrics } from "@/lib/types";

export type TopProjectRow = {
  project: string;
  netRevenueContribution: number;
  taskCount: number;
  /** Последний месяц старта эффекта среди задач проекта (все задачи группы уже «живы» в модели к этому месяцу). */
  latestReleaseMonth: number;
};

/**
 * Группировка задач по проекту: вклад в план и поздний релиз (max release_month).
 */
export const buildTopProjectRows = (
  tasks: Task[],
  taskMetrics: Record<string, TaskValueMetrics>,
  noProjectLabel: string,
  includeTask: (task: Task) => boolean,
): TopProjectRow[] =>
  Array.from(
    tasks
      .filter(includeTask)
      .reduce((acc, task) => {
        const key = task.project.trim() || noProjectLabel;
        const cur =
          acc.get(key) ??
          ({
            project: key,
            netRevenueContribution: 0,
            taskCount: 0,
            latestReleaseMonth: 0,
          } satisfies TopProjectRow);
        cur.netRevenueContribution += taskMetrics[task.id]?.incrementalCurrent ?? 0;
        cur.taskCount += 1;
        cur.latestReleaseMonth = Math.max(cur.latestReleaseMonth, task.releaseMonth);
        acc.set(key, cur);
        return acc;
      }, new Map<string, TopProjectRow>())
      .values(),
  ).sort((a, b) => b.netRevenueContribution - a.netRevenueContribution);
