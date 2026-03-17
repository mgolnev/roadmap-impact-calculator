"use client";

import { useMemo, useState } from "react";

import { getPhaseLabels, getPhaseStatusLabels, getText } from "@/lib/i18n";
import { Locale, PHASE_LIST, PhaseName, PhaseStatus, Task, TaskPMData } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { emptyPMData, usePMStore } from "@/store/pm-store";

type ProjectTrackerProps = {
  locale: Locale;
  tasks: Task[];
};

type TaskStatus = "on_track" | "delayed" | "at_risk" | "not_started";

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const monthName = MONTH_NAMES[parts[1]] ?? parts[1];
  return `${monthName} ${parts[0]}`;
};

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
  if (hasBlocked || pm.blocker) return "at_risk";

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

export function ProjectTracker({ locale, tasks }: ProjectTrackerProps) {
  const { pmData, updatePMField, cyclePhase, ensureTask } = usePMStore();
  const text = getText(locale);
  const phaseLabels = getPhaseLabels(locale);
  const statusLabels = getPhaseStatusLabels(locale);
  const [managerFilter, setManagerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [searchValue, setSearchValue] = useState("");

  const taskRows = useMemo(() => {
    return tasks.map((task) => {
      const pm = pmData[task.id] ?? emptyPMData();
      const status = getTaskStatus(pm);
      const doneCount = PHASE_LIST.filter(
        (p) => pm.phases[p] === "done" || pm.phases[p] === "skipped",
      ).length;
      return { task, pm, status, doneCount };
    });
  }, [tasks, pmData]);

  const managerOptions = useMemo(() => {
    const set = new Set<string>();
    taskRows.forEach((row) => {
      if (row.pm.managerGJ) set.add(row.pm.managerGJ);
    });
    return Array.from(set).sort();
  }, [taskRows]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return taskRows.filter((row) => {
      if (managerFilter && row.pm.managerGJ !== managerFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (query) {
        const haystack = `${row.task.project} ${row.task.taskName} ${row.pm.manager} ${row.pm.managerGJ} ${row.pm.blocker}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [taskRows, managerFilter, statusFilter, searchValue]);

  const totalDevCost = filteredRows.reduce((sum, row) => sum + row.pm.devCostHours, 0);

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

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>{text.pmTitle}</h2>
          <p>{text.pmDescription}</p>
        </div>
      </div>

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
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
          >
            <option value="">{text.pmAllManagers}</option>
            {managerOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
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
        </div>
      </div>

      <div className="filters-summary">
        {text.shownTasks}: {filteredRows.length} / {tasks.length}
        {" • "}{text.pmTotalDevCost}: {formatNumber(totalDevCost)} h
      </div>

      <div className="table-wrap">
        <table className="matrix-table tasks-table pm-table">
          <thead>
            <tr>
              <th className="sticky-col sticky-col-1">{text.project}</th>
              <th className="sticky-col sticky-col-pm-2">{text.task}</th>
              <th className="pm-status-col">{text.pmStatus}</th>
              <th>{text.pmStartDate}</th>
              <th>{text.pmEndDate}</th>
              <th>{text.pmManagerGJ}</th>
              <th>{text.pmManager}</th>
              <th>{text.pmBlocker}</th>
              <th>{text.pmAbTest}</th>
              <th>{text.pmDevCost}</th>
              {PHASE_LIST.map((phase) => (
                <th key={phase} className="pm-phase-header">{phaseLabels[phase]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ task, pm, status, doneCount }) => (
              <tr key={task.id} className={!task.active ? "task-row-inactive" : ""}>
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
                  <input
                    className="cell-input"
                    value={pm.managerGJ}
                    onChange={(e) => handleFieldChange(task.id, "managerGJ", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={pm.manager}
                    onChange={(e) => handleFieldChange(task.id, "manager", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={pm.blocker}
                    placeholder={text.pmNoBlocker}
                    onChange={(e) => handleFieldChange(task.id, "blocker", e.target.value)}
                  />
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
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-col sticky-col-1" colSpan={9}>
                {text.pmTotalDevCost}
              </td>
              <td><strong>{formatNumber(totalDevCost)} h</strong></td>
              <td colSpan={PHASE_LIST.length} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="pm-legend">
        {(["not_started", "in_progress", "done", "blocked", "skipped"] as PhaseStatus[]).map(
          (status) => (
            <div key={status} className="pm-legend-item">
              <span className={`phase-dot ${PHASE_DOT_CLASS[status]}`} />
              <span>{statusLabels[status]}</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
