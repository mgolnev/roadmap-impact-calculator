"use client";

import { useMemo, useState } from "react";

import { IMPACT_TYPE_LABELS, MONTH_LABELS, STAGE_LABELS } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Task, TaskValueMetrics } from "@/lib/types";
import { normalizeImpactType, normalizeStage } from "@/store/calculator-store";

type TasksTableProps = {
  tasks: Task[];
  taskMetrics: Record<string, TaskValueMetrics>;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
};

const stageOptions = Object.entries(STAGE_LABELS);
const impactOptions = Object.entries(IMPACT_TYPE_LABELS);

function ImpactEditor({
  task,
  index,
  onUpdate,
}: {
  task: Task;
  index: 1 | 2;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
}) {
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
        <option value="">Этап</option>
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
        <option value="">Тип</option>
        {impactOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        className="cell-input small-input"
        type="number"
        step="0.001"
        value={impactValue}
        onChange={(event) => onUpdate(task.id, valueKey, Number(event.target.value))}
      />
    </div>
  );
}

export function TasksTable({
  tasks,
  taskMetrics,
  onUpdate,
  onAdd,
  onRemove,
  onDuplicate,
}: TasksTableProps) {
  const [isDetailedView, setIsDetailedView] = useState(false);
  const activeTasksCount = useMemo(() => tasks.filter((task) => task.active).length, [tasks]);

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>Задачи roadmap</h2>
          <p>
            Список предзаполнен по PDF. Здесь должно быть понятно: какая задача, на какой этап
            влияет, с какого месяца начинает работать и какую ценность дает по году.
          </p>
        </div>
        <div className="toolbar">
          <button
            className="ghost-button"
            onClick={() => setIsDetailedView((value) => !value)}
            type="button"
          >
            {isDetailedView ? "Простой вид" : "Детальный вид"}
          </button>
          <button className="primary-button" onClick={onAdd} type="button">
            Добавить задачу
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="matrix-table tasks-table">
          <thead>
            <tr>
              <th className="sticky-col sticky-col-1">Вкл.</th>
              {isDetailedView && <th className="sticky-col sticky-col-2">Поток</th>}
              <th className={`sticky-col ${isDetailedView ? "sticky-col-3" : "sticky-col-2 wide-sticky"}`}>
                Задача
              </th>
              <th>Основное влияние</th>
              <th>Доп. влияние</th>
              <th>Старт эффекта</th>
              <th>Мес. влияния</th>
              <th>Ценность отдельно</th>
              <th>Вклад в текущем плане</th>
              <th>Ценность до конца года / мес.</th>
              <th>Ценность при +15%</th>
              <th>Ценность при +20%</th>
              <th>Ценность при +30%</th>
              {isDetailedView && <th>Комментарий / гипотеза</th>}
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
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
                  {isDetailedView && (
                    <td className="sticky-col sticky-col-2">
                      <input
                        className="cell-input"
                        value={task.stream}
                        onChange={(event) => onUpdate(task.id, "stream", event.target.value)}
                      />
                    </td>
                  )}
                  <td className={`sticky-col ${isDetailedView ? "sticky-col-3" : "sticky-col-2 wide-sticky"}`}>
                    <div className="task-name-cell">
                      <input
                        className="cell-input wide-input"
                        value={task.taskName}
                        onChange={(event) => onUpdate(task.id, "taskName", event.target.value)}
                      />
                      {!isDetailedView && <span className="task-subtitle">{task.stream}</span>}
                    </div>
                  </td>
                  <td>
                    <ImpactEditor index={1} onUpdate={onUpdate} task={task} />
                  </td>
                  <td>
                    <ImpactEditor index={2} onUpdate={onUpdate} task={task} />
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={task.releaseMonth}
                      onChange={(event) => onUpdate(task.id, "releaseMonth", Number(event.target.value))}
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={label} value={index + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{metrics?.monthsActive ?? 0}</td>
                  <td>{formatCurrency(metrics?.standaloneBase ?? 0)}</td>
                  <td>{formatCurrency(metrics?.incrementalCurrent ?? 0)}</td>
                  <td>{formatCurrency(metrics?.valuePerMonth ?? 0)}</td>
                  <td>{formatCurrency(metrics?.standalone15 ?? 0)}</td>
                  <td>{formatCurrency(metrics?.standalone20 ?? 0)}</td>
                  <td>{formatCurrency(metrics?.standalone30 ?? 0)}</td>
                  {isDetailedView && (
                    <td>
                      <textarea
                        className="cell-input text-area"
                        value={task.comment}
                        onChange={(event) => onUpdate(task.id, "comment", event.target.value)}
                      />
                    </td>
                  )}
                  <td>
                    <div className="actions">
                      <button className="ghost-button" type="button" onClick={() => onDuplicate(task.id)}>
                        Дубль
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => onRemove(task.id)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-col sticky-col-1" colSpan={isDetailedView ? 7 : 6}>
                Итого по задачам
              </td>
              <td>{formatCurrency(tasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.standaloneBase ?? 0), 0))}</td>
              <td>{formatCurrency(tasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.incrementalCurrent ?? 0), 0))}</td>
              <td>{formatCurrency(tasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.valuePerMonth ?? 0), 0))}</td>
              <td>{formatCurrency(tasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.standalone15 ?? 0), 0))}</td>
              <td>{formatCurrency(tasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.standalone20 ?? 0), 0))}</td>
              <td>{formatCurrency(tasks.reduce((acc, task) => acc + (taskMetrics[task.id]?.standalone30 ?? 0), 0))}</td>
              <td colSpan={isDetailedView ? 2 : 1}>{formatNumber(activeTasksCount)} активных задач</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
