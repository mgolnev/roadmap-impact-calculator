import type { PhaseName, PhaseStatus, Task } from "@/lib/types";

export type PMSortColumn =
  | "project"
  | "taskName"
  | "status"
  | "startDate"
  | "endDate"
  | "devCommittedReleaseMonth"
  | "needsAbTest"
  | "devCostHours"
  | `phase:${PhaseName}`;

export type PMSortDirection = "asc" | "desc";

export type TaskStatusPM = "on_track" | "delayed" | "at_risk" | "not_started";

const STATUS_RANK: Record<TaskStatusPM, number> = {
  not_started: 0,
  on_track: 1,
  delayed: 2,
  at_risk: 3,
};

const PHASE_STATUS_RANK: Record<PhaseStatus, number> = {
  not_started: 0,
  in_progress: 1,
  done: 2,
  blocked: 3,
  skipped: 4,
};

export type PMRowForSort = {
  task: Task;
  status: TaskStatusPM;
  doneCount: number;
  pm: {
    startDate: string;
    endDate: string;
    needsAbTest: boolean;
    devCostHours: number;
    phases: Record<PhaseName, PhaseStatus>;
  };
};

const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** Перестановка внутри списка id (как в reorderTasks). */
export function reorderIdList(ids: string[], draggedId: string, targetId: string): string[] {
  const fromIdx = ids.indexOf(draggedId);
  const toIdx = ids.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return ids;
  const next = [...ids];
  const [removed] = next.splice(fromIdx, 1);
  const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
  next.splice(insertIdx, 0, removed);
  return next;
}

/**
 * После drag в отфильтрованном списке: новый глобальный порядок id.
 * Видимые задачи занимают те же позиции в полном списке, что и до перестановки
 * (по порядку следования в `fullOrder`); внутри этих слотов задаётся новый порядок `nextVis`.
 */
export function mergePmVisibleReorder(
  fullOrder: string[],
  visibleOrderedIds: string[],
  draggedId: string,
  targetId: string,
): string[] {
  const nextVis = reorderIdList(visibleOrderedIds, draggedId, targetId);
  const visSet = new Set(nextVis);
  const slotIndices: number[] = [];
  fullOrder.forEach((id, i) => {
    if (visSet.has(id)) slotIndices.push(i);
  });
  if (slotIndices.length !== nextVis.length) return fullOrder;
  const next = [...fullOrder];
  nextVis.forEach((id, k) => {
    next[slotIndices[k]] = id;
  });
  return next;
}

export function sanitizePmManualOrder(manual: string[] | null, taskIds: string[]): string[] | null {
  if (!manual?.length) return null;
  if (manual.length !== taskIds.length) return null;
  const set = new Set(taskIds);
  if (new Set(manual).size !== manual.length) return null;
  for (const id of manual) {
    if (!set.has(id)) return null;
  }
  return manual;
}

function sortValueForColumn(row: PMRowForSort, column: PMSortColumn): string | number {
  const { task, pm, status } = row;
  if (column === "project") return task.project.trim().toLowerCase();
  if (column === "taskName") return task.taskName.trim().toLowerCase();
  if (column === "status") return STATUS_RANK[status];
  if (column === "startDate") return pm.startDate || "";
  if (column === "endDate") return pm.endDate || "";
  if (column === "devCommittedReleaseMonth") return task.devCommittedReleaseMonth;
  if (column === "needsAbTest") return pm.needsAbTest ? 1 : 0;
  if (column === "devCostHours") return pm.devCostHours;
  if (column.startsWith("phase:")) {
    const phase = column.slice("phase:".length) as PhaseName;
    return PHASE_STATUS_RANK[pm.phases[phase] ?? "not_started"];
  }
  return 0;
}

export function comparePmRows(
  a: PMRowForSort,
  b: PMRowForSort,
  column: PMSortColumn,
  direction: PMSortDirection,
): number {
  const va = sortValueForColumn(a, column);
  const vb = sortValueForColumn(b, column);
  let c = 0;
  if (typeof va === "number" && typeof vb === "number") {
    c = va - vb;
  } else {
    c = cmpStr(String(va), String(vb));
  }
  if (c !== 0) return direction === "asc" ? c : -c;
  return cmpStr(a.task.id, b.task.id);
}
