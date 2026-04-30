import type { InitiativeStatus, Priority, Task, TaskValueMetrics } from "@/lib/types";

export const ROADMAP_SORT_COLUMNS = [
  "active",
  "project",
  "taskName",
  "primaryImpact",
  "secondaryImpact",
  "releaseMonth",
  "monthsActive",
  "standalone",
  "incremental",
  "valuePerMonth",
  "valuePerYearIgnoreRelease",
  "comment",
  "priority",
  "initiativeStatus",
] as const;

export type RoadmapSortColumn = (typeof ROADMAP_SORT_COLUMNS)[number];

export type RoadmapSortDirection = "asc" | "desc";

export type RoadmapTableSortState = { column: RoadmapSortColumn; direction: RoadmapSortDirection };

const SORT_COLUMN_SET = new Set<string>(ROADMAP_SORT_COLUMNS);

export function isRoadmapSortColumn(value: unknown): value is RoadmapSortColumn {
  return typeof value === "string" && SORT_COLUMN_SET.has(value);
}

const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

const PRIORITY_RANK: Record<Priority, number> = { p1: 0, p2: 1, p3: 2 };

const INITIATIVE_RANK: Record<InitiativeStatus, number> = {
  draft: 0,
  hypothesis: 1,
  planned: 2,
  in_progress: 3,
  released: 4,
};

export function compareRoadmapTasks(
  a: Task,
  b: Task,
  ma: TaskValueMetrics | undefined,
  mb: TaskValueMetrics | undefined,
  column: RoadmapSortColumn,
  direction: RoadmapSortDirection,
): number {
  let c = 0;
  switch (column) {
    case "active":
      c = (a.active ? 0 : 1) - (b.active ? 0 : 1);
      break;
    case "project":
      c = cmpStr(a.project.trim(), b.project.trim());
      break;
    case "taskName":
      c = cmpStr(a.taskName.trim(), b.taskName.trim());
      break;
    case "primaryImpact": {
      const sa = a.stage1 ?? "";
      const sb = b.stage1 ?? "";
      c = cmpStr(String(sa), String(sb));
      if (c === 0) c = a.impact1Value - b.impact1Value;
      break;
    }
    case "secondaryImpact": {
      const sa = a.stage2 ?? "";
      const sb = b.stage2 ?? "";
      c = cmpStr(String(sa), String(sb));
      if (c === 0) c = a.impact2Value - b.impact2Value;
      break;
    }
    case "releaseMonth":
      c = a.releaseMonth - b.releaseMonth;
      break;
    case "monthsActive":
      c = (ma?.monthsActive ?? 0) - (mb?.monthsActive ?? 0);
      break;
    case "standalone":
      c = (ma?.standaloneBase ?? 0) - (mb?.standaloneBase ?? 0);
      break;
    case "incremental":
      c = (ma?.incrementalCurrent ?? 0) - (mb?.incrementalCurrent ?? 0);
      break;
    case "valuePerMonth":
      c = (ma?.valuePerMonth ?? 0) - (mb?.valuePerMonth ?? 0);
      break;
    case "valuePerYearIgnoreRelease":
      c = (ma?.valuePerYearIgnoreRelease ?? 0) - (mb?.valuePerYearIgnoreRelease ?? 0);
      break;
    case "comment":
      c = cmpStr(a.comment.trim(), b.comment.trim());
      break;
    case "priority":
      c = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      break;
    case "initiativeStatus":
      c = INITIATIVE_RANK[a.initiativeStatus] - INITIATIVE_RANK[b.initiativeStatus];
      break;
    default:
      c = 0;
  }
  if (c !== 0) return direction === "asc" ? c : -c;
  return cmpStr(a.id, b.id);
}

export function parsePersistedRoadmapTableSort(raw: unknown): RoadmapTableSortState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.direction !== "asc" && o.direction !== "desc") return null;
  if (!isRoadmapSortColumn(o.column)) return null;
  return { column: o.column, direction: o.direction };
}
