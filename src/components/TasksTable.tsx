"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { formatCurrency, formatNumber } from "@/lib/format";
import {
  getImpactTypeLabels,
  getMonthLabel,
  getPriorityLabels,
  getStageLabels,
  getText,
  INITIATIVE_STATUS_LABELS,
} from "@/lib/i18n";
import {
  ALL_INITIATIVE_STATUSES,
  isPreBacklogStatus,
  isRoadmapStatus,
  normalizeInitiativeStatus,
} from "@/lib/initiative";
import { AdjustableStage, ImpactType, InitiativeStatus, Locale, Priority, Task, TaskValueMetrics } from "@/lib/types";
import { normalizeImpactType, normalizePriority, normalizeStage } from "@/store/calculator-store";

type TasksTableProps = {
  locale: Locale;
  tasks: Task[];
  taskMetrics: Record<string, TaskValueMetrics>;
  importState: { type: "success" | "error"; message: string } | null;
  activeImport: "tasks" | "scenario" | null;
  stageFilter: AdjustableStage | "";
  onStageFilterChange: (stage: AdjustableStage | "") => void;
  projectFilter: string;
  onProjectFilterChange: (project: string) => void;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onSetAllActive: (active: boolean) => void;
  onAdd: () => void;
  onDownloadScenario: () => void;
  onImportScenario: (file: File) => Promise<void>;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => Promise<void>;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
};

const formatImpactInputValue = (
  type: Task["impact1Type"] | Task["impact2Type"],
  value: number,
) => {
  if (type === "relative_percent" || type === "absolute_pp") {
    return value * 100;
  }

  return value;
};

const parseImpactInputValue = (
  type: Task["impact1Type"] | Task["impact2Type"],
  rawValue: number,
) => {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  if (type === "relative_percent" || type === "absolute_pp") {
    return rawValue / 100;
  }

  return rawValue;
};

const PRIORITY_INLINE_STYLES: Record<string, React.CSSProperties> = {
  p1: { background: "rgba(206, 59, 59, 0.08)", color: "#ce3b3b", borderColor: "rgba(206, 59, 59, 0.2)" },
  p2: { background: "rgba(59, 107, 255, 0.06)", color: "#3b6bff", borderColor: "rgba(59, 107, 255, 0.18)" },
  p3: { background: "rgba(98, 112, 138, 0.08)", color: "#5c6a82", borderColor: "#e2e8f4" },
};

const SHORT_IMPACT_TYPE_LABELS: Record<Locale, Record<ImpactType, string>> = {
  ru: {
    relative_percent: "%",
    absolute_pp: "п.п.",
    absolute_value: "abs",
  },
  en: {
    relative_percent: "%",
    absolute_pp: "p.p.",
    absolute_value: "abs",
  },
};

const formatEditableNumber = (value: number, maximumFractionDigits = 2) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("ru-RU", {
    useGrouping: false,
    maximumFractionDigits,
  }).format(value);
};

const parseEditableNumber = (value: string) => {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");

  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export function EditableImpactInput({
  type,
  value,
  onCommit,
  /** Если true — обновляем родителя при каждом вводе (для live-превью эффекта). По умолчанию только по blur. */
  liveCommit = false,
}: {
  type: Task["impact1Type"] | Task["impact2Type"];
  value: number;
  onCommit: (value: number) => void;
  liveCommit?: boolean;
}) {
  const [draft, setDraft] = useState(() => formatEditableNumber(formatImpactInputValue(type, value)));
  const [isFocused, setIsFocused] = useState(false);

  const commitValue = () => {
    const parsed = parseEditableNumber(draft);

    if (parsed === null) {
      setDraft(formatEditableNumber(formatImpactInputValue(type, value)));
      return;
    }

    const nextValue = parseImpactInputValue(type, parsed);
    onCommit(nextValue);
    setDraft(formatEditableNumber(formatImpactInputValue(type, nextValue)));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (liveCommit) {
      const parsed = parseEditableNumber(next);
      if (parsed !== null) {
        onCommit(parseImpactInputValue(type, parsed));
      }
    }
  };

  return (
    <input
      className="cell-input small-input"
      inputMode="decimal"
      type="text"
      value={isFocused ? draft : formatEditableNumber(formatImpactInputValue(type, value))}
      onFocus={() => {
        setDraft(formatEditableNumber(formatImpactInputValue(type, value)));
        setIsFocused(true);
      }}
      onBlur={() => {
        setIsFocused(false);
        commitValue();
      }}
      onChange={handleChange}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function ImpactEditor({
  locale,
  task,
  index,
  onUpdate,
}: {
  locale: Locale;
  task: Task;
  index: 1 | 2;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
}) {
  const stageOptions = Object.entries(getStageLabels(locale));
  const impactOptions = Object.entries(getImpactTypeLabels(locale));
  const text = getText(locale);
  const stageKey = index === 1 ? "stage1" : "stage2";
  const typeKey = index === 1 ? "impact1Type" : "impact2Type";
  const valueKey = index === 1 ? "impact1Value" : "impact2Value";
  const stageValue = index === 1 ? task.stage1 : task.stage2;
  const typeValue = index === 1 ? task.impact1Type : task.impact2Type;
  const impactValue = index === 1 ? task.impact1Value : task.impact2Value;

  return (
    <div className="impact-editor">
      <select
        className="cell-input"
        value={stageValue ?? ""}
        onChange={(event) => onUpdate(task.id, stageKey, normalizeStage(event.target.value))}
      >
        <option value="">{text.stagePlaceholder}</option>
        {stageOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <div className="impact-value-group">
        <EditableImpactInput
          type={typeValue}
          value={impactValue}
          onCommit={(nextValue) => onUpdate(task.id, valueKey, nextValue)}
        />
        <select
          className="cell-input impact-type-select"
          title={
            typeValue
              ? impactOptions.find(([value]) => value === typeValue)?.[1] ?? text.typePlaceholder
              : text.typePlaceholder
          }
          value={typeValue ?? ""}
          onChange={(event) => onUpdate(task.id, typeKey, normalizeImpactType(event.target.value))}
        >
          <option value="">{text.typePlaceholder}</option>
          {(Object.keys(SHORT_IMPACT_TYPE_LABELS[locale]) as ImpactType[]).map((value) => (
            <option key={value} value={value}>
              {SHORT_IMPACT_TYPE_LABELS[locale][value]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function TasksTable({
  locale,
  tasks,
  taskMetrics,
  importState,
  activeImport,
  stageFilter,
  onStageFilterChange,
  projectFilter,
  onProjectFilterChange,
  onUpdate,
  onSetAllActive,
  onAdd,
  onDownloadScenario,
  onImportScenario,
  onDownloadTemplate,
  onImportFile,
  onRemove,
  onDuplicate,
  onReorder,
}: TasksTableProps) {
  const [searchValue, setSearchValue] = useState("");
  const setProjectFilter = onProjectFilterChange;
  const [monthFilter, setMonthFilter] = useState<number | "">("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scenarioFileInputRef = useRef<HTMLInputElement | null>(null);
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);
  const priorityLabels = getPriorityLabels(locale);
  const projectOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.project.trim() || text.noProject))).sort(),
    [tasks, text.noProject],
  );
  const filteredTasks = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return tasks.filter((task) => {
      const projectName = task.project.trim() || text.noProject;
      const matchesProject = !projectFilter || projectName === projectFilter;
      const matchesStage =
        !stageFilter || task.stage1 === stageFilter || task.stage2 === stageFilter;
      const matchesMonth = monthFilter === "" || task.releaseMonth === monthFilter;
      const haystack = `${projectName} ${task.taskName} ${task.comment}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      return matchesProject && matchesStage && matchesMonth && matchesSearch;
    });
  }, [monthFilter, projectFilter, searchValue, stageFilter, tasks, text.noProject]);
  const activeTasksCount = useMemo(
    () => filteredTasks.filter((task) => task.active).length,
    [filteredTasks],
  );

  const hasActiveFilters = !!(searchValue.trim() || projectFilter || stageFilter || monthFilter);
  const [toastVisible, setToastVisible] = useState(false);
  const [movedToIdeasToast, setMovedToIdeasToast] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    if (actionsOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [actionsOpen]);

  useEffect(() => {
    if (!hasActiveFilters || filteredTasks.length >= tasks.length) {
      setToastVisible(false);
      return;
    }
    setToastVisible(true);
    const t = setTimeout(() => setToastVisible(false), 3000);
    return () => clearTimeout(t);
  }, [hasActiveFilters, filteredTasks.length, tasks.length]);

  useEffect(() => {
    if (!movedToIdeasToast) return;
    const t = setTimeout(() => setMovedToIdeasToast(null), 3500);
    return () => clearTimeout(t);
  }, [movedToIdeasToast]);

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>{text.tasksTitle}</h2>
        </div>
      </div>

      <div className="tasks-filters tasks-filters--panel">
        <div className="filters-row filters-row-primary">
          <input
            className={`cell-input ${searchValue.trim() ? "filter-active" : ""}`}
            placeholder={text.taskSearchPlaceholder}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <select
            className={`cell-input ${projectFilter ? "filter-active" : ""}`}
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="">{text.allProjects}</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
          <select
            className={`cell-input ${stageFilter ? "filter-active" : ""}`}
            value={stageFilter}
            onChange={(event) => onStageFilterChange(normalizeStage(event.target.value) ?? "")}
          >
            <option value="">{text.allMetrics}</option>
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={`cell-input ${monthFilter ? "filter-active" : ""}`}
            value={monthFilter}
            onChange={(event) =>
              setMonthFilter(event.target.value === "" ? "" : Number(event.target.value))
            }
          >
            <option value="">{text.allMonths}</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {getMonthLabel(locale, i + 1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filters-row filters-row-secondary">
          <button
            className={`ghost-button clear-filters-button ${searchValue.trim() || projectFilter || stageFilter || monthFilter ? "primary-button" : ""}`}
            type="button"
            onClick={() => {
              setSearchValue("");
              onProjectFilterChange("");
              setMonthFilter("");
              onStageFilterChange("");
            }}
          >
            {text.clearFilters}
          </button>
        </div>
      </div>

      <div className="toolbar tasks-toolbar">
        <input
          ref={fileInputRef}
          accept=".xlsx,.xls"
          className="hidden-file-input"
          type="file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            await onImportFile(file);
            event.target.value = "";
          }}
        />
        <input
          ref={scenarioFileInputRef}
          accept=".xlsx,.xls"
          className="hidden-file-input"
          type="file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            await onImportScenario(file);
            event.target.value = "";
          }}
        />

        <div className="toolbar-group">
          <button className="ghost-button" onClick={() => onSetAllActive(true)} type="button">
            {text.selectAll}
          </button>
          <button className="ghost-button" onClick={() => onSetAllActive(false)} type="button">
            {text.deselectAll}
          </button>
        </div>

        <div className="toolbar-group actions-dropdown" ref={actionsRef}>
          <button
            className="primary-button actions-trigger"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActionsOpen((v) => !v);
            }}
          >
            {text.actions}
            <span className="actions-chevron">▼</span>
          </button>
          {actionsOpen ? (
            <div className="actions-menu">
              <button
                type="button"
                className="actions-menu-item"
                onClick={() => {
                  onDownloadScenario();
                  setActionsOpen(false);
                }}
              >
                {text.saveScenario}
              </button>
              <button
                type="button"
                className="actions-menu-item"
                disabled={activeImport !== null}
                onClick={() => {
                  scenarioFileInputRef.current?.click();
                  setActionsOpen(false);
                }}
              >
                {activeImport === "scenario" ? text.importInProgress : text.loadScenario}
              </button>
              <button
                type="button"
                className="actions-menu-item"
                onClick={() => {
                  onDownloadTemplate();
                  setActionsOpen(false);
                }}
              >
                {text.downloadTemplate}
              </button>
              <button
                type="button"
                className="actions-menu-item"
                disabled={activeImport !== null}
                onClick={() => {
                  fileInputRef.current?.click();
                  setActionsOpen(false);
                }}
              >
                {activeImport === "tasks" ? text.importInProgress : text.importFromExcel}
              </button>
              <button
                type="button"
                className="actions-menu-item actions-menu-item-primary"
                onClick={() => {
                  onAdd();
                  setActionsOpen(false);
                }}
              >
                {text.addTask}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {importState ? (
        <div className={`toolbar-status ${importState.type}`}>{importState.message}</div>
      ) : null}

      <div className="filters-summary">
        {text.shownTasks}: {filteredTasks.length} / {tasks.length}
        {projectFilter ? ` • ${text.project}: ${projectFilter}` : ""}
        {stageFilter ? ` • ${text.filterByMetric}: ${stageLabels[stageFilter]}` : ""}
        {monthFilter ? ` • ${text.effectStart}: ${getMonthLabel(locale, monthFilter)}` : ""}
      </div>

      <div className="table-wrap">
        <table className="matrix-table tasks-table">
          <thead>
            <tr>
              <th className="sticky-col sticky-col-0 drag-col" aria-hidden />
              <th className="sticky-col sticky-col-1 checkbox-col">{text.enabled}</th>
              <th className="sticky-col sticky-col-2">{text.project}</th>
              <th className="sticky-col sticky-col-3 wide-sticky">{text.task}</th>
              <th>{text.primaryImpact}</th>
              <th>{text.secondaryImpact}</th>
              <th>{text.effectStart}</th>
              <th>{text.activeMonths}</th>
              <th>{text.standalone}</th>
              <th>{text.incremental}</th>
              <th>{text.valuePerMonth}</th>
              <th>{text.comment}</th>
              <th>{text.priority}</th>
              <th>{text.initiativeStatus}</th>
              <th>{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => {
              const metrics = taskMetrics[task.id];

              return (
                <tr
                  key={task.id}
                  className={`${task.active ? "" : "task-row-inactive"} ${dragOverId === task.id ? "drag-over" : ""}`}
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
                    if (draggedId && draggedId !== task.id) onReorder(draggedId, task.id);
                  }}
                >
                  <td
                    className="sticky-col sticky-col-0 drag-cell"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <span className="drag-handle" aria-hidden>⋮⋮</span>
                  </td>
                  <td className="sticky-col sticky-col-1 checkbox-cell">
                    <input
                      className="task-checkbox"
                      checked={task.active}
                      onChange={(event) => onUpdate(task.id, "active", event.target.checked)}
                      type="checkbox"
                    />
                  </td>
                  <td className="sticky-col sticky-col-2">
                    <input
                      className="cell-input"
                      value={task.project}
                      onChange={(event) => onUpdate(task.id, "project", event.target.value)}
                    />
                  </td>
                  <td className="sticky-col sticky-col-3 wide-sticky">
                    <div className="task-name-cell">
                      <input
                        className="cell-input wide-input"
                        value={task.taskName}
                        onChange={(event) => onUpdate(task.id, "taskName", event.target.value)}
                      />
                    </div>
                  </td>
                  <td>
                    <ImpactEditor locale={locale} index={1} onUpdate={onUpdate} task={task} />
                  </td>
                  <td>
                    <ImpactEditor locale={locale} index={2} onUpdate={onUpdate} task={task} />
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={task.releaseMonth}
                      onChange={(event) => onUpdate(task.id, "releaseMonth", Number(event.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index + 1} value={index + 1}>
                          {getMonthLabel(locale, index + 1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{metrics?.monthsActive ?? 0}</td>
                  <td>{formatCurrency(metrics?.standaloneBase ?? 0)}</td>
                  <td>{formatCurrency(metrics?.incrementalCurrent ?? 0)}</td>
                  <td>{formatCurrency(metrics?.valuePerMonth ?? 0)}</td>
                  <td>
                    <textarea
                      className="cell-input text-area"
                      value={task.comment}
                      onChange={(event) => onUpdate(task.id, "comment", event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="cell-input priority-select"
                      style={PRIORITY_INLINE_STYLES[task.priority]}
                      value={task.priority}
                      onChange={(event) =>
                        onUpdate(task.id, "priority", normalizePriority(event.target.value) ?? "p2")
                      }
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      title={text.roadmapStatusHint}
                      value={task.initiativeStatus}
                      onChange={(event) => {
                        const next = normalizeInitiativeStatus(event.target.value);
                        if (next) {
                          const wasRoadmap = isRoadmapStatus(task.initiativeStatus);
                          const toIdeas = isPreBacklogStatus(next);
                          onUpdate(task.id, "initiativeStatus", next);
                          if (wasRoadmap && toIdeas) {
                            const label = task.taskName.trim() || text.toastTaskUntitled;
                            setMovedToIdeasToast(text.toastTaskMovedToIdeas.replace("{name}", label));
                          }
                        }
                      }}
                    >
                      {ALL_INITIATIVE_STATUSES.map((st: InitiativeStatus) => (
                        <option key={st} value={st}>
                          {INITIATIVE_STATUS_LABELS[locale][st]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="ghost-button" type="button" onClick={() => onDuplicate(task.id)}>
                        {text.duplicate}
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => onRemove(task.id)}>
                        {text.remove}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-col sticky-col-0" />
              <td className="sticky-col sticky-col-1" colSpan={8}>
                {text.totalByTasks}
              </td>
              <td>{formatCurrency(filteredTasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.standaloneBase ?? 0), 0))}</td>
              <td>{formatCurrency(filteredTasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.incrementalCurrent ?? 0), 0))}</td>
              <td>{formatCurrency(filteredTasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.valuePerMonth ?? 0), 0))}</td>
              <td colSpan={3}>{formatNumber(activeTasksCount)} {text.activeTasks}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="toolbar-status">{text.noTasksForFilter}</div>
      ) : null}

      {toastVisible ? (
        <div className={`toast${movedToIdeasToast ? " toast--stacked" : ""}`} role="status">
          {text.tasksFilteredToast}
        </div>
      ) : null}
      {movedToIdeasToast ? (
        <div className="toast" role="status">
          {movedToIdeasToast}
        </div>
      ) : null}
    </section>
  );
}
