import type { Task, TaskValueMetrics, TimelineMode } from "@/lib/types";
import { effectiveReleaseMonth } from "@/lib/timeline";

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
  timelineMode: TimelineMode = "plan",
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
        cur.latestReleaseMonth = Math.max(
          cur.latestReleaseMonth,
          effectiveReleaseMonth(task, timelineMode),
        );
        acc.set(key, cur);
        return acc;
      }, new Map<string, TopProjectRow>())
      .values(),
  ).sort((a, b) => b.netRevenueContribution - a.netRevenueContribution);

/**
 * Все уникальные названия проектов из списка задач; вклад и число задач — только по `planTaskFilter`
 * (например `taskCountsTowardPlan`). Месяц — максимум среди задач плана, иначе среди всех задач проекта.
 */
export const buildLeaderboardProjectRows = (
  tasks: Task[],
  taskMetrics: Record<string, TaskValueMetrics>,
  noProjectLabel: string,
  planTaskFilter: (task: Task) => boolean,
  timelineMode: TimelineMode = "plan",
): TopProjectRow[] => {
  const keys = new Set<string>();
  for (const task of tasks) {
    keys.add(task.project.trim() || noProjectLabel);
  }

  return Array.from(keys)
    .map((projectKey) => {
      const projectTasks = tasks.filter(
        (t) => (t.project.trim() || noProjectLabel) === projectKey,
      );
      const planTasks = projectTasks.filter(planTaskFilter);

      let netRevenueContribution = 0;
      let latestReleaseMonth = 0;
      for (const task of planTasks) {
        netRevenueContribution += taskMetrics[task.id]?.incrementalCurrent ?? 0;
        latestReleaseMonth = Math.max(
          latestReleaseMonth,
          effectiveReleaseMonth(task, timelineMode),
        );
      }
      if (latestReleaseMonth === 0) {
        for (const task of projectTasks) {
          latestReleaseMonth = Math.max(
            latestReleaseMonth,
            effectiveReleaseMonth(task, timelineMode),
          );
        }
      }

      return {
        project: projectKey,
        netRevenueContribution,
        taskCount: planTasks.length,
        latestReleaseMonth,
      } satisfies TopProjectRow;
    })
    .sort((a, b) => b.netRevenueContribution - a.netRevenueContribution);
};
