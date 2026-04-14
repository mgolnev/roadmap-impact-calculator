"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { getMonthLabel, getPhaseLabels, getPhaseStatusLabels, getText } from "@/lib/i18n";
import {
  comparePmRows,
  mergePmVisibleReorder,
  sanitizePmManualOrder,
  type PMSortColumn,
} from "@/lib/pm-display-order";
import { Locale, PHASE_LIST, PhaseStatus, Task, TaskPMData } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { useCalculatorStore } from "@/store/calculator-store";
import { emptyPMData, emptyPhases, usePMStore } from "@/store/pm-store";

type ProjectTrackerProps = {
  locale: Locale;
  tasks: Task[];
};

type TaskStatus = "on_track" | "delayed" | "at_risk" | "not_started";

const getTaskStatus = (pm: TaskPMData): TaskStatus => {
  const doneCount = PHASE_LIST.filter(
    (p) => pm.phases[p] === "done" || pm.phases[p] === "skipped",
  ).length;
  const hasBlocked = PHASE_LIST.some((p) => pm.phases[p] === "blocked");
  const hasStarted = PHASE_LIST.some(
    (p) => pm.phases[p] !== "not_started",
  );

  if (!hasStarted && !pm.startDate) return "not_started";

  if (doneCount === PHASE_LIST.length) return "on_track";
  if (hasBlocked) return "at_risk";

  if (pm.endDate) {
    const now = new Date();
    const [year, month] = pm.endDate.split("-").map(Number);
    if (year && month) {
      const deadline = new Date(year, month - 1, 28);
      if (now > deadline && doneCount < PHASE_LIST.length) return "delayed";
    }
  }

  if (!hasStarted) return "not_started";
  return "on_track";
};

const STATUS_CLASS: Record<TaskStatus, string> = {
  on_track: "pm-status-on-track",
  delayed: "pm-status-delayed",
  at_risk: "pm-status-at-risk",
  not_started: "pm-status-not-started",
};

const PHASE_DOT_CLASS: Record<PhaseStatus, string> = {
  not_started: "phase-dot-empty",
  in_progress: "phase-dot-progress",
  done: "phase-dot-done",
  blocked: "phase-dot-blocked",
  skipped: "phase-dot-skipped",
};

/** Распознаёт вставленный из браузера URL для кликабельной ссылки (http/https). */
function safeHttpHref(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  try {
    const href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

type RowModel = {
  task: Task;
  pm: TaskPMData;
  status: TaskStatus;
  doneCount: number;
};

/** Сливает частичные записи из стора/импорта с дефолтами (в т.ч. новые поля PM). */
function normalizePmRow(raw: Partial<TaskPMData> | undefined): TaskPMData {
  if (!raw) return emptyPMData();
  return {
    ...emptyPMData(),
    ...raw,
    phases: { ...emptyPhases(), ...raw.phases },
  };
}

function PMSortTh({
  column,
  label,
  sort,
  onToggle,
  align = "left",
}: {
  column: PMSortColumn;
  label: string;
  sort: { column: PMSortColumn; direction: "asc" | "desc" } | null;
  onToggle: (c: PMSortColumn) => void;
  align?: "left" | "center";
}) {
  const active = sort?.column === column;
  const arrow = active ? (sort.direction === "asc" ? " ↑" : " ↓") : "";
  return (
    <th className={align === "center" ? "pm-phase-header" : undefined}>
      <button
        type="button"
        className={`pm-sort-th ${align === "center" ? "pm-sort-th--center" : ""}`}
        onClick={() => onToggle(column)}
      >
        {label}
        {arrow}
      </button>
    </th>
  );
}

export function ProjectTracker({ locale, tasks }: ProjectTrackerProps) {
  const {
    pmData,
    updatePMField,
    cyclePhase,
    ensureTask,
    pmColumnSort,
    pmManualOrderIds,
    togglePmColumnSort,
    setPmManualOrderIds,
    resetPmTableLayout,
  } = usePMStore();
  const updateTask = useCalculatorStore((s) => s.updateTask);
  const text = getText(locale);
  const phaseLabels = getPhaseLabels(locale);
  const statusLabels = getPhaseStatusLabels(locale);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [searchValue, setSearchValue] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  useEffect(() => {
    if (pmManualOrderIds && !sanitizePmManualOrder(pmManualOrderIds, taskIds)) {
      setPmManualOrderIds(null);
    }
  }, [taskIds, pmManualOrderIds, setPmManualOrderIds]);

  const safeManual = useMemo(
    () => sanitizePmManualOrder(pmManualOrderIds, taskIds),
    [pmManualOrderIds, taskIds],
  );

  const taskRows = useMemo((): RowModel[] => {
    return tasks.map((task) => {
      const pm = normalizePmRow(pmData[task.id]);
      const status = getTaskStatus(pm);
      const doneCount = PHASE_LIST.filter(
        (p) => pm.phases[p] === "done" || pm.phases[p] === "skipped",
      ).length;
      return { task, pm, status, doneCount };
    });
  }, [tasks, pmData]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return taskRows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (query) {
        const haystack = `${row.task.project} ${row.task.taskName} ${row.pm.adjacentSystems} ${row.pm.pmComment} ${row.pm.jiraEpicUrl}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [taskRows, statusFilter, searchValue]);

  const orderedDisplayRows = useMemo(() => {
    const fset = new Set(filteredRows.map((r) => r.task.id));
    const byId = new Map(filteredRows.map((r) => [r.task.id, r]));

    if (pmColumnSort) {
      return [...filteredRows].sort((a, b) =>
        comparePmRows(
          { task: a.task, pm: a.pm, status: a.status, doneCount: a.doneCount },
          { task: b.task, pm: b.pm, status: b.status, doneCount: b.doneCount },
          pmColumnSort.column,
          pmColumnSort.direction,
        ),
      );
    }

    const base = safeManual ?? taskIds;
    return base.filter((id) => fset.has(id)).map((id) => byId.get(id)!);
  }, [filteredRows, taskIds, safeManual, pmColumnSort]);

  const handlePmDrop = useCallback(
    (targetId: string, draggedId: string) => {
      if (!draggedId || draggedId === targetId) return;
      const fullOrder = safeManual ?? taskIds;
      const visibleIds = orderedDisplayRows.map((r) => r.task.id);
      const next = mergePmVisibleReorder(fullOrder, visibleIds, draggedId, targetId);
      setPmManualOrderIds(next);
    },
    [safeManual, taskIds, orderedDisplayRows, setPmManualOrderIds],
  );

  const totalDevCost = orderedDisplayRows.reduce((sum, row) => sum + row.pm.devCostHours, 0);

  const statusText = (status: TaskStatus) => {
    switch (status) {
      case "on_track": return text.pmOnTrack;
      case "delayed": return text.pmDelayed;
      case "at_risk": return text.pmAtRisk;
      case "not_started": return text.pmNotStarted;
    }
  };

  const handleFieldChange = (taskId: string, field: keyof Omit<TaskPMData, "phases">, value: string | boolean | number) => {
    ensureTask(taskId);
    updatePMField(taskId, field, value as never);
  };

  const showResetLayout = !!(pmColumnSort || safeManual);

  return (
    <CollapsibleSection title={text.pmTitle} description={<p>{text.pmDescription}</p>}>
      <div className="tasks-filters">
        <div className="filters-row filters-row-primary">
          <input
            className="cell-input"
            placeholder={text.taskSearchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <select
            className="cell-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
          >
            <option value="">{text.pmAllStatuses}</option>
            <option value="on_track">{text.pmOnTrack}</option>
            <option value="at_risk">{text.pmAtRisk}</option>
            <option value="delayed">{text.pmDelayed}</option>
            <option value="not_started">{text.pmNotStarted}</option>
          </select>
          {showResetLayout ? (
            <button
              type="button"
              className="ghost-button"
              title={text.pmOrderResetHint}
              onClick={() => resetPmTableLayout()}
            >
              {text.pmOrderReset}
            </button>
          ) : null}
        </div>
      </div>

      <div className="filters-summary">
        {text.shownTasks}: {orderedDisplayRows.length} / {tasks.length}
        {" • "}{text.pmTotalDevCost}: {formatNumber(totalDevCost)} h
      </div>

      <div className="pm-table-wrap">
        <div className="pm-table-scroll-x">
        <table className="matrix-table tasks-table pm-table">
          <thead>
            <tr>
              <th className="sticky-col sticky-col-0 drag-col pm-drag-col" aria-hidden />
              <PMSortTh column="project" label={text.project} sort={pmColumnSort} onToggle={togglePmColumnSort} />
              <PMSortTh
                column="taskName"
                label={text.task}
                sort={pmColumnSort}
                onToggle={togglePmColumnSort}
              />
              <PMSortTh column="status" label={text.pmStatus} sort={pmColumnSort} onToggle={togglePmColumnSort} />
              <PMSortTh column="startDate" label={text.pmStartDate} sort={pmColumnSort} onToggle={togglePmColumnSort} />
              <PMSortTh column="endDate" label={text.pmEndDate} sort={pmColumnSort} onToggle={togglePmColumnSort} />
              <PMSortTh
                column="devCommittedReleaseMonth"
                label={text.pmDevCommittedMonth}
                sort={pmColumnSort}
                onToggle={togglePmColumnSort}
              />
              <PMSortTh column="needsAbTest" label={text.pmAbTest} sort={pmColumnSort} onToggle={togglePmColumnSort} />
              <PMSortTh column="devCostHours" label={text.pmDevCost} sort={pmColumnSort} onToggle={togglePmColumnSort} />
              <th>{text.pmAdjacentSystems}</th>
              <th>{text.pmComment}</th>
              <th>{text.pmJiraEpic}</th>
              {PHASE_LIST.map((phase) => (
                <PMSortTh
                  key={phase}
                  column={`phase:${phase}`}
                  label={phaseLabels[phase]}
                  sort={pmColumnSort}
                  onToggle={togglePmColumnSort}
                  align="center"
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedDisplayRows.map(({ task, pm, status, doneCount }) => {
              const jiraHref = safeHttpHref(pm.jiraEpicUrl);
              return (
              <tr
                key={task.id}
                className={`${!task.active ? "task-row-inactive" : ""} ${dragOverId === task.id ? "drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverId(task.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  const draggedId = e.dataTransfer.getData("text/plain");
                  handlePmDrop(task.id, draggedId);
                }}
              >
                <td
                  className="sticky-col sticky-col-0 drag-cell pm-drag-col"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <span className="drag-handle" aria-hidden>⋮⋮</span>
                </td>
                <td className="sticky-col sticky-col-1">
                  <span className="pm-project-label">{task.project}</span>
                </td>
                <td className="sticky-col sticky-col-pm-2">
                  <div className="task-name-cell">
                    <span>{task.taskName}</span>
                    <span className="task-subtitle">
                      {doneCount}/{PHASE_LIST.length} {text.pmPhases.toLowerCase()}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`pm-status-chip ${STATUS_CLASS[status]}`}>
                    {statusText(status)}
                  </span>
                </td>
                <td>
                  <input
                    className="cell-input pm-date-input"
                    type="month"
                    value={pm.startDate}
                    onChange={(e) => handleFieldChange(task.id, "startDate", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input pm-date-input"
                    type="month"
                    value={pm.endDate}
                    onChange={(e) => handleFieldChange(task.id, "endDate", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className="cell-input"
                    value={task.devCommittedReleaseMonth}
                    onChange={(e) =>
                      updateTask(task.id, "devCommittedReleaseMonth", Number(e.target.value))
                    }
                    title={text.pmDevCommittedMonthHint}
                  >
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {getMonthLabel(locale, index + 1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pm-center-cell">
                  <input
                    className="task-checkbox"
                    type="checkbox"
                    checked={pm.needsAbTest}
                    onChange={(e) => handleFieldChange(task.id, "needsAbTest", e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input pm-cost-input"
                    type="number"
                    min="0"
                    value={pm.devCostHours || ""}
                    onChange={(e) => handleFieldChange(task.id, "devCostHours", Number(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input pm-wide-text-input"
                    value={pm.adjacentSystems}
                    onChange={(e) => handleFieldChange(task.id, "adjacentSystems", e.target.value)}
                  />
                </td>
                <td>
                  <textarea
                    className="cell-input pm-comment-textarea"
                    rows={2}
                    value={pm.pmComment}
                    onChange={(e) => handleFieldChange(task.id, "pmComment", e.target.value)}
                  />
                </td>
                <td className="pm-jira-cell">
                  <input
                    className="cell-input pm-jira-input"
                    type="text"
                    value={pm.jiraEpicUrl}
                    placeholder={text.pmJiraEpicPlaceholder}
                    onChange={(e) => handleFieldChange(task.id, "jiraEpicUrl", e.target.value)}
                  />
                  {jiraHref ? (
                    <a
                      className="pm-jira-link"
                      href={jiraHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {text.pmJiraEpicOpen}
                    </a>
                  ) : null}
                </td>
                {PHASE_LIST.map((phase) => (
                  <td key={phase} className="pm-phase-cell">
                    <button
                      className={`phase-dot ${PHASE_DOT_CLASS[pm.phases[phase]]}`}
                      type="button"
                      title={`${phaseLabels[phase]}: ${statusLabels[pm.phases[phase]]}`}
                      onClick={() => {
                        ensureTask(task.id);
                        cyclePhase(task.id, phase);
                      }}
                    />
                  </td>
                ))}
              </tr>
            );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-col sticky-col-0 pm-drag-col" aria-hidden />
              <td className="sticky-col sticky-col-1" colSpan={7}>
                {text.pmTotalDevCost}
              </td>
              <td><strong>{formatNumber(totalDevCost)} h</strong></td>
              <td colSpan={3} aria-hidden />
              <td colSpan={PHASE_LIST.length} />
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      <div className="pm-legend">
        {(["not_started", "in_progress", "done", "blocked", "skipped"] as PhaseStatus[]).map(
          (st) => (
            <div key={st} className="pm-legend-item">
              <span className={`phase-dot ${PHASE_DOT_CLASS[st]}`} />
              <span>{statusLabels[st]}</span>
            </div>
          ),
        )}
      </div>
    </CollapsibleSection>
  );
}
