"use client";

import { useMemo, useRef, useState } from "react";

import { formatCurrency, formatNumber } from "@/lib/format";
import { getImpactTypeLabels, getMonthLabel, getPriorityLabels, getStageLabels, getText } from "@/lib/i18n";
import { AdjustableStage, ImpactType, Locale, Priority, Task, TaskValueMetrics } from "@/lib/types";
import { normalizeImpactType, normalizePriority, normalizeStage } from "@/store/calculator-store";

type TasksTableProps = {
  locale: Locale;
  tasks: Task[];
  taskMetrics: Record<string, TaskValueMetrics>;
  importState: { type: "success" | "error"; message: string } | null;
  activeImport: "tasks" | "scenario" | null;
  stageFilter: AdjustableStage | "";
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onStageFilterChange: (stage: AdjustableStage | "") => void;
  onSetAllActive: (active: boolean) => void;
  onAdd: () => void;
  onDownloadScenario: () => void;
  onImportScenario: (file: File) => Promise<void>;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => Promise<void>;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
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
  onUpdate,
  onStageFilterChange,
  onSetAllActive,
  onAdd,
  onDownloadScenario,
  onImportScenario,
  onDownloadTemplate,
  onImportFile,
  onRemove,
  onDuplicate,
}: TasksTableProps) {
  const [searchValue, setSearchValue] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
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
      const haystack = `${projectName} ${task.taskName} ${task.comment}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      return matchesProject && matchesStage && matchesSearch;
    });
  }, [projectFilter, searchValue, stageFilter, tasks, text.noProject]);
  const activeTasksCount = useMemo(
    () => filteredTasks.filter((task) => task.active).length,
    [filteredTasks],
  );

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>{text.tasksTitle}</h2>
        </div>
      </div>

      <div className="tasks-filters">
        <div className="filters-row filters-row-primary">
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
        </div>

        <div className="filters-row filters-row-secondary">
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

        <span className="toolbar-divider" />

        <div className="toolbar-group">
          <button className="ghost-button" onClick={onDownloadScenario} type="button">
            {text.saveScenario}
          </button>
          <button
            className="ghost-button"
            onClick={() => scenarioFileInputRef.current?.click()}
            disabled={activeImport !== null}
            type="button"
          >
            {activeImport === "scenario" ? text.importInProgress : text.loadScenario}
          </button>
          <button className="ghost-button" onClick={onDownloadTemplate} type="button">
            {text.downloadTemplate}
          </button>
          <button
            className="ghost-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={activeImport !== null}
            type="button"
          >
            {activeImport === "tasks" ? text.importInProgress : text.importFromExcel}
          </button>
        </div>

        <span className="toolbar-divider" />

        <button className="primary-button" onClick={onAdd} type="button">
          {text.addTask}
        </button>
      </div>

      {importState ? (
        <div className={`toolbar-status ${importState.type}`}>{importState.message}</div>
      ) : null}

      <div className="filters-summary">
        {text.shownTasks}: {filteredTasks.length} / {tasks.length}
        {stageFilter ? ` • ${text.filterByMetric}: ${stageLabels[stageFilter]}` : ""}
      </div>

      <div className="table-wrap">
        <table className="matrix-table tasks-table">
          <thead>
            <tr>
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
              <th>{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => {
              const metrics = taskMetrics[task.id];

              return (
                <tr key={task.id} className={task.active ? "" : "task-row-inactive"}>
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
              <td className="sticky-col sticky-col-1" colSpan={8}>
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

      {filteredTasks.length === 0 ? (
        <div className="toolbar-status">{text.noTasksForFilter}</div>
      ) : null}
    </section>
  );
}
