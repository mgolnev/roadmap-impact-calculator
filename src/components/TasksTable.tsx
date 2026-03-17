"use client";

import { useMemo, useRef, useState } from "react";

import { formatCurrency, formatNumber } from "@/lib/format";
import { getImpactTypeLabels, getMonthLabel, getStageLabels, getText } from "@/lib/i18n";
import { AdjustableStage, Locale, Task, TaskValueMetrics } from "@/lib/types";
import { normalizeImpactType, normalizeStage } from "@/store/calculator-store";

type TasksTableProps = {
  locale: Locale;
  tasks: Task[];
  taskMetrics: Record<string, TaskValueMetrics>;
  importState: { type: "success" | "error"; message: string } | null;
  isImporting: boolean;
  stageFilter: AdjustableStage | "";
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onStageFilterChange: (stage: AdjustableStage | "") => void;
  onSetAllActive: (active: boolean) => void;
  onAdd: () => void;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => Promise<void>;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
};

const getImpactLabel = (
  locale: Locale,
  stage?: Task["stage1"],
  type?: Task["impact1Type"],
  value = 0,
) => {
  const stageLabels = getStageLabels(locale);
  const text = getText(locale);
  if (!stage || !type) {
    return text.notSet;
  }

  const displayValue =
    type === "relative_percent" || type === "absolute_pp" ? value * 100 : value;
  const suffix = type === "absolute_pp" ? " п.п." : type === "absolute_value" ? "" : "%";

  return `${stageLabels[stage]}: ${displayValue.toFixed(type === "absolute_value" ? 0 : 1)}${suffix}`;
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

function EditableImpactInput({
  type,
  value,
  onCommit,
}: {
  type: Task["impact1Type"] | Task["impact2Type"];
  value: number;
  onCommit: (value: number) => void;
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
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ImpactEditor({
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
      <select
        className="cell-input"
        value={typeValue ?? ""}
        onChange={(event) => onUpdate(task.id, typeKey, normalizeImpactType(event.target.value))}
      >
        <option value="">{text.typePlaceholder}</option>
        {impactOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <EditableImpactInput
        type={typeValue}
        value={impactValue}
        onCommit={(nextValue) => onUpdate(task.id, valueKey, nextValue)}
      />
    </div>
  );
}

export function TasksTable({
  locale,
  tasks,
  taskMetrics,
  importState,
  isImporting,
  stageFilter,
  onUpdate,
  onStageFilterChange,
  onSetAllActive,
  onAdd,
  onDownloadTemplate,
  onImportFile,
  onRemove,
  onDuplicate,
}: TasksTableProps) {
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);
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
      const haystack = `${projectName} ${task.taskName} ${task.comment}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      return matchesProject && matchesStage && matchesSearch;
    });
  }, [projectFilter, searchValue, stageFilter, tasks, text.noProject]);
  const activeTasksCount = useMemo(
    () => filteredTasks.filter((task) => task.active).length,
    [filteredTasks],
  );
  const projectGroups = useMemo(() => {
    const groups: Array<{
      project: string;
      tasks: Task[];
      standalone: number;
      incremental: number;
      activeCount: number;
    }> = [];
    const map = new Map<string, number>();

    filteredTasks.forEach((task) => {
      const key = task.project.trim() || text.noProject;
      const existingIndex = map.get(key);

      if (existingIndex === undefined) {
        map.set(key, groups.length);
        groups.push({
          project: key,
          tasks: [task],
          standalone: taskMetrics[task.id]?.standaloneBase ?? 0,
          incremental: taskMetrics[task.id]?.incrementalCurrent ?? 0,
          activeCount: task.active ? 1 : 0,
        });
        return;
      }

      const group = groups[existingIndex];
      group.tasks.push(task);
      group.standalone += taskMetrics[task.id]?.standaloneBase ?? 0;
      group.incremental += taskMetrics[task.id]?.incrementalCurrent ?? 0;
      group.activeCount += task.active ? 1 : 0;
    });

    return groups;
  }, [filteredTasks, taskMetrics, text.noProject]);

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>{text.tasksTitle}</h2>
          <p>{text.tasksDescription}</p>
        </div>
        <div className="toolbar">
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
          <button
            className="ghost-button"
            onClick={() => setIsDetailedView((value) => !value)}
            type="button"
          >
            {isDetailedView ? text.simpleView : text.detailedView}
          </button>
          <button className="ghost-button" onClick={() => onSetAllActive(true)} type="button">
            {text.selectAll}
          </button>
          <button className="ghost-button" onClick={() => onSetAllActive(false)} type="button">
            {text.deselectAll}
          </button>
          <button className="ghost-button" onClick={onDownloadTemplate} type="button">
            {text.downloadTemplate}
          </button>
          <button
            className="ghost-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            type="button"
          >
            {isImporting ? text.importInProgress : text.importFromExcel}
          </button>
          <button className="primary-button" onClick={onAdd} type="button">
            {text.addTask}
          </button>
        </div>
      </div>

      {importState ? (
        <div className={`toolbar-status ${importState.type}`}>{importState.message}</div>
      ) : null}

      <div className="filters-row">
        <input
          className="cell-input"
          placeholder={text.taskSearchPlaceholder}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
        <select
          className="cell-input"
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
          className="cell-input"
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
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setSearchValue("");
            setProjectFilter("");
            onStageFilterChange("");
          }}
        >
          {text.clearFilters}
        </button>
      </div>

      <div className="filters-summary">
        {text.shownTasks}: {filteredTasks.length} / {tasks.length}
        {stageFilter ? ` • ${text.filterByMetric}: ${stageLabels[stageFilter]}` : ""}
      </div>

      {isDetailedView ? (
        <div className="table-wrap">
          <table className="matrix-table tasks-table">
            <thead>
              <tr>
                <th className="sticky-col sticky-col-1">{text.enabled}</th>
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
                <th>{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const metrics = taskMetrics[task.id];

                return (
                  <tr key={task.id}>
                    <td className="sticky-col sticky-col-1">
                      <input
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
                <td className="sticky-col sticky-col-1" colSpan={7}>
                  {text.totalByTasks}
                </td>
                <td>{formatCurrency(filteredTasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.standaloneBase ?? 0), 0))}</td>
                <td>{formatCurrency(filteredTasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.incrementalCurrent ?? 0), 0))}</td>
                <td>{formatCurrency(filteredTasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.valuePerMonth ?? 0), 0))}</td>
                <td colSpan={2}>{formatNumber(activeTasksCount)} {text.activeTasks}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="project-groups">
          {projectGroups.length > 0 ? (
            projectGroups.map((group) => (
            <details className="project-group" key={group.project} open>
              <summary className="project-group-header">
                <div>
                  <div className="project-group-title">{group.project}</div>
                  <div className="project-group-subtitle">
                    {group.activeCount} / {group.tasks.length} {text.activeTasks}
                  </div>
                </div>
                <div className="project-group-metrics">
                  <div>
                    <span>{text.projectMetricsStandalone}</span>
                    <strong>{formatCurrency(group.standalone)}</strong>
                  </div>
                  <div>
                    <span>{text.projectMetricsIncremental}</span>
                    <strong>{formatCurrency(group.incremental)}</strong>
                  </div>
                </div>
              </summary>

              <div className="project-task-list">
                {group.tasks.map((task) => {
                  const metrics = taskMetrics[task.id];

                  return (
                    <div className="project-task-card" key={task.id}>
                      <div className="project-task-main">
                        <label className="task-toggle">
                          <input
                            checked={task.active}
                            onChange={(event) => onUpdate(task.id, "active", event.target.checked)}
                            type="checkbox"
                          />
                          <span>{text.enabled}</span>
                        </label>
                        <input
                          className="cell-input"
                          value={task.taskName}
                          onChange={(event) => onUpdate(task.id, "taskName", event.target.value)}
                        />
                      </div>

                      <div className="project-task-grid">
                        <div className="project-task-metric">
                          <span>{text.primaryImpact}</span>
                          <strong>{getImpactLabel(locale, task.stage1, task.impact1Type, task.impact1Value)}</strong>
                        </div>
                        <div className="project-task-metric">
                          <span>{text.secondaryImpact}</span>
                          <strong>{getImpactLabel(locale, task.stage2, task.impact2Type, task.impact2Value)}</strong>
                        </div>
                        <div className="project-task-metric">
                          <span>{text.projectTaskStart}</span>
                          <strong>{getMonthLabel(locale, task.releaseMonth)}</strong>
                        </div>
                        <div className="project-task-metric">
                          <span>{text.projectTaskContribution}</span>
                          <strong>{formatCurrency(metrics?.incrementalCurrent ?? 0)}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
            ))
          ) : (
            <div className="toolbar-status">{text.noTasksForFilter}</div>
          )}
        </div>
      )}
    </section>
  );
}
