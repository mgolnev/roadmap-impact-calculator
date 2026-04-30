import type { Locale, Task, TaskValueMetrics, TimelineMode } from "@/lib/types";
import { effectiveReleaseMonth } from "@/lib/timeline";
import { formatTaskImpactCeoCompactSummary, formatTaskImpactCeoVerboseSummary } from "@/lib/task-impact-ceo";
import { formatTaskImpactSummary } from "@/lib/task-impact-summary";
import type { TopTasksRevenueBundle } from "@/lib/top-tasks-revenue";

const DISPLAY_LIMIT = 10;

type ProjectAcc = {
  contribution: number;
  tasks: Task[];
  latestMonth: number;
};

/**
 * Топ проектов по суммарному инкременту (как у задач): для колонки CR Δ берётся
 * формулировка влияния у задачи с максимальным вкладом внутри проекта.
 */
export const buildTopProjectsRevenueBundle = (
  tasks: Task[],
  taskMetrics: Record<string, TaskValueMetrics>,
  locale: Locale,
  noProjectLabel: string,
  includeTask: (task: Task) => boolean,
  timelineMode: TimelineMode = "plan",
): TopTasksRevenueBundle => {
  const map = new Map<string, ProjectAcc>();

  for (const task of tasks.filter(includeTask)) {
    const key = task.project.trim() || noProjectLabel;
    let cur = map.get(key);
    if (!cur) {
      cur = { contribution: 0, tasks: [], latestMonth: 0 };
      map.set(key, cur);
    }
    cur.contribution += taskMetrics[task.id]?.incrementalCurrent ?? 0;
    cur.tasks.push(task);
    cur.latestMonth = Math.max(cur.latestMonth, effectiveReleaseMonth(task, timelineMode));
  }

  const sorted = Array.from(map.entries())
    .map(([projectName, acc]) => {
      const lead = [...acc.tasks].sort(
        (a, b) =>
          (taskMetrics[b.id]?.incrementalCurrent ?? 0) - (taskMetrics[a.id]?.incrementalCurrent ?? 0),
      )[0];
      return {
        id: projectName,
        taskName: projectName,
        project: "",
        hypothesisComment: "",
        incremental: acc.contribution,
        impactSummary: lead ? formatTaskImpactSummary(lead, locale) : "—",
        impactCeoCompact: lead ? formatTaskImpactCeoCompactSummary(lead, locale) : "—",
        impactCeoVerbose: lead ? formatTaskImpactCeoVerboseSummary(lead, locale) : "—",
        releaseMonth: acc.latestMonth,
      };
    })
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
