"use client";

import { TrafficScenarioKey } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { TRAFFIC_SCENARIOS } from "@/lib/constants";

type ImpactHighlightsProps = {
  scenario: TrafficScenarioKey;
  baselineNet: number;
  projectedNet: number;
  baselineGross: number;
  projectedGross: number;
  baselineOrders: number;
  projectedOrders: number;
  topTasks: Array<{ taskName: string; value: number }>;
};

const deltaText = (current: number, base: number, money = false) => {
  const delta = current - base;
  const pct = base > 0 ? delta / base : 0;
  const main = money ? formatCurrency(delta) : formatNumber(delta);
  return `${delta >= 0 ? "+" : ""}${main} (${delta >= 0 ? "+" : ""}${formatPercent(pct)})`;
};

export function ImpactHighlights(props: ImpactHighlightsProps) {
  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>Что меняют задачи</h2>
          <p>
            Короткий блок для первого прочтения: что получится по текущему сценарию и какие задачи
            дают основной вклад.
          </p>
        </div>
      </div>

      <div className="insight-grid">
        <div className="insight-card accent-card">
          <span>Сценарий трафика</span>
          <strong>{TRAFFIC_SCENARIOS[props.scenario].label}</strong>
        </div>
        <div className="insight-card">
          <span>Net revenue после задач</span>
          <strong>{formatCurrency(props.projectedNet)}</strong>
        </div>
        <div className="insight-card">
          <span>Delta Net revenue</span>
          <strong>{deltaText(props.projectedNet, props.baselineNet, true)}</strong>
        </div>
        <div className="insight-card">
          <span>Gross revenue после задач</span>
          <strong>{formatCurrency(props.projectedGross)}</strong>
        </div>
        <div className="insight-card">
          <span>Delta Gross revenue</span>
          <strong>{deltaText(props.projectedGross, props.baselineGross, true)}</strong>
        </div>
        <div className="insight-card">
          <span>Delta заказов</span>
          <strong>{deltaText(props.projectedOrders, props.baselineOrders)}</strong>
        </div>
      </div>

      <div className="top-tasks">
        <div className="top-tasks-title">Топ задач по вкладу в текущем плане</div>
        <div className="top-tasks-list">
          {props.topTasks.length > 0 ? (
            props.topTasks.map((task, index) => (
              <div className="top-task-item" key={task.taskName}>
                <span>{index + 1}. {task.taskName}</span>
                <strong>{formatCurrency(task.value)}</strong>
              </div>
            ))
          ) : (
            <div className="top-task-item">
              <span>Нет активных задач</span>
              <strong>{formatCurrency(0)}</strong>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
