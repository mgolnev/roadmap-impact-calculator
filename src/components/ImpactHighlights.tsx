"use client";

import { getStageLabels, getText } from "@/lib/i18n";
import { AdjustableStage, AnnualFunnel, FunnelRates, Task } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { Locale } from "@/lib/types";

type ImpactHighlightsProps = {
  locale: Locale;
  tasks: Task[];
  selectedStageFilter: AdjustableStage | "";
  onSelectStageFilter: (stage: AdjustableStage | "") => void;
  trafficChangePercent: number;
  onTrafficChangePercent: (value: number) => void;
  baselineNet: number;
  projectedNet: number;
  baselineGross: number;
  projectedGross: number;
  baselineOrders: number;
  projectedOrders: number;
  baselineAnnual: AnnualFunnel;
  projectedAnnual: AnnualFunnel;
  fullyImplementedAnnual: AnnualFunnel;
  fullyImplementedRates: FunnelRates;
  topTasks: Array<{ projectName: string; value: number; taskCount: number }>;
};

const deltaClass = (current: number, base: number) => {
  const delta = current - base;
  if (delta > 0) return "delta-positive";
  if (delta < 0) return "delta-negative";
  return "";
};

const deltaText = (current: number, base: number, money = false) => {
  const delta = current - base;
  const pct = base > 0 ? delta / base : 0;
  const main = money ? formatCurrency(delta) : formatNumber(delta);
  return `${delta >= 0 ? "+" : ""}${main} (${delta >= 0 ? "+" : ""}${formatPercent(pct)})`;
};

const deltaByFormatter = (
  current: number,
  base: number,
  formatter: (value: number) => string,
) => {
  const delta = current - base;
  return `${delta >= 0 ? "+" : ""}${formatter(delta)}`;
};

export function ImpactHighlights(props: ImpactHighlightsProps) {
  const text = getText(props.locale);
  const stageLabels = getStageLabels(props.locale);
  const overviewRows = [
    {
      label: text.sessions,
      base: props.baselineAnnual.sessions,
      projected: props.projectedAnnual.sessions,
      format: (value: number) => formatNumber(value),
    },
    {
      label: text.conversionFromSessions,
      base: props.baselineAnnual.toSessionsRates.orderCr,
      projected: props.projectedAnnual.toSessionsRates.orderCr,
      format: (value: number) => formatPercent(value),
    },
    {
      label: text.grossOrders,
      base: props.baselineAnnual.orders,
      projected: props.projectedAnnual.orders,
      format: (value: number) => formatNumber(value),
    },
    {
      label: text.grossRevenue,
      base: props.baselineAnnual.grossRevenue,
      projected: props.projectedAnnual.grossRevenue,
      format: (value: number) => formatCurrency(value),
    },
    {
      label: text.atv,
      base: props.baselineAnnual.atv,
      projected: props.projectedAnnual.atv,
      format: (value: number) => formatCurrency(value),
    },
    {
      label: text.upt,
      base: props.baselineAnnual.upt,
      projected: props.projectedAnnual.upt,
      format: (value: number) => formatNumber(value, 2),
    },
    {
      label: text.asp,
      base: props.baselineAnnual.asp,
      projected: props.projectedAnnual.asp,
      format: (value: number) => formatCurrency(value),
    },
    {
      label: text.buyout,
      base: props.baselineAnnual.buyoutRate,
      projected: props.projectedAnnual.buyoutRate,
      format: (value: number) => formatPercent(value),
    },
    {
      label: text.netRevenue,
      base: props.baselineAnnual.netRevenue,
      projected: props.projectedAnnual.netRevenue,
      format: (value: number) => formatCurrency(value),
    },
  ];
  const getTaskCount = (stage: AdjustableStage) =>
    props.tasks.filter((task) => task.stage1 === stage || task.stage2 === stage).length;

  const conversionRows = [
    {
      label: props.locale === "ru" ? "Сессии / Трафик" : "Sessions / Traffic",
      stage: "traffic" as AdjustableStage,
      base: props.baselineAnnual.sessions,
      full: props.fullyImplementedAnnual.sessions,
      year: props.projectedAnnual.sessions,
      format: (value: number) => formatNumber(value),
    },
    {
      label: props.locale === "ru" ? "Сессии -> Каталог" : "Sessions -> Catalog",
      stage: "catalog" as AdjustableStage,
      base: props.baselineAnnual.rates.catalogCr,
      full: props.fullyImplementedRates.catalogCr,
      year: props.projectedAnnual.rates.catalogCr,
      format: (value: number) => formatPercent(value),
    },
    {
      label: props.locale === "ru" ? "Каталог -> PDP" : "Catalog -> PDP",
      stage: "pdp" as AdjustableStage,
      base: props.baselineAnnual.rates.pdpCr,
      full: props.fullyImplementedRates.pdpCr,
      year: props.projectedAnnual.rates.pdpCr,
      format: (value: number) => formatPercent(value),
    },
    {
      label: props.locale === "ru" ? "PDP -> Добавление в корзину" : "PDP -> Add to cart",
      stage: "atc" as AdjustableStage,
      base: props.baselineAnnual.rates.atcCr,
      full: props.fullyImplementedRates.atcCr,
      year: props.projectedAnnual.rates.atcCr,
      format: (value: number) => formatPercent(value),
    },
    {
      label: props.locale === "ru" ? "Добавление в корзину -> Checkout" : "Add to cart -> Checkout",
      stage: "checkout" as AdjustableStage,
      base: props.baselineAnnual.rates.checkoutCr,
      full: props.fullyImplementedRates.checkoutCr,
      year: props.projectedAnnual.rates.checkoutCr,
      format: (value: number) => formatPercent(value),
    },
    {
      label: props.locale === "ru" ? "Checkout -> Заказ" : "Checkout -> Order",
      stage: "order" as AdjustableStage,
      base: props.baselineAnnual.rates.orderCr,
      full: props.fullyImplementedRates.orderCr,
      year: props.projectedAnnual.rates.orderCr,
      format: (value: number) => formatPercent(value),
    },
    {
      label: stageLabels.atv,
      stage: "atv" as AdjustableStage,
      base: props.baselineAnnual.atv,
      full: props.fullyImplementedAnnual.atv,
      year: props.projectedAnnual.atv,
      format: (value: number) => formatCurrency(value),
    },
    {
      label: stageLabels.upt,
      stage: "upt" as AdjustableStage,
      base: props.baselineAnnual.upt,
      full: props.fullyImplementedAnnual.upt,
      year: props.projectedAnnual.upt,
      format: (value: number) => formatNumber(value, 2),
    },
    {
      label: stageLabels.buyout,
      stage: "buyout" as AdjustableStage,
      base: props.baselineAnnual.buyoutRate,
      full: props.fullyImplementedAnnual.buyoutRate,
      year: props.projectedAnnual.buyoutRate,
      format: (value: number) => formatPercent(value),
    },
  ];

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>{text.impactTitle}</h2>
          <p>
            {text.impactDescription}
          </p>
        </div>
      </div>

      <div className="impact-summary-grid">
        <section className="impact-summary-section">
          <div className="impact-summary-title">{text.scenarioConditions}</div>
          <div className="insight-grid single-column">
            <label className="insight-card accent-card">
              <span>{text.trafficChange}</span>
              <input
                className="cell-input"
                type="number"
                step="0.1"
                value={props.trafficChangePercent}
                onChange={(e) => props.onTrafficChangePercent(Number(e.target.value))}
              />
            </label>
          </div>
        </section>

        <section className="impact-summary-section">
          <div className="impact-summary-title">{text.baseTitle}</div>
          <div className="insight-grid">
            <div className="insight-card">
              <span>{text.baseGrossOrders}</span>
              <strong>{formatNumber(props.baselineOrders)}</strong>
            </div>
            <div className="insight-card">
              <span>{text.baseGrossRevenue}</span>
              <strong>{formatCurrency(props.baselineGross)}</strong>
            </div>
            <div className="insight-card">
              <span>{text.baseNetRevenue}</span>
              <strong>{formatCurrency(props.baselineNet)}</strong>
            </div>
          </div>
        </section>

        <section className="impact-summary-section">
          <div className="impact-summary-title">{text.afterTasksTitle}</div>
          <div className="insight-grid">
            <div className="insight-card">
              <span>{text.ordersAfterTasks}</span>
              <strong>{formatNumber(props.projectedOrders)}</strong>
            </div>
            <div className="insight-card">
              <span>{text.grossRevenueAfterTasks}</span>
              <strong>{formatCurrency(props.projectedGross)}</strong>
            </div>
            <div className="insight-card">
              <span>{text.netRevenueAfterTasks}</span>
              <strong>{formatCurrency(props.projectedNet)}</strong>
            </div>
          </div>
        </section>

        <section className="impact-summary-section">
          <div className="impact-summary-title">{text.deltaToBaseTitle}</div>
          <div className="insight-grid">
            <div className={`insight-card ${deltaClass(props.projectedOrders, props.baselineOrders)}`}>
              <span>{text.deltaOrders}</span>
              <strong>{deltaText(props.projectedOrders, props.baselineOrders)}</strong>
            </div>
            <div className={`insight-card ${deltaClass(props.projectedGross, props.baselineGross)}`}>
              <span>{text.deltaGrossRevenue}</span>
              <strong>{deltaText(props.projectedGross, props.baselineGross, true)}</strong>
            </div>
            <div className={`insight-card ${deltaClass(props.projectedNet, props.baselineNet)}`}>
              <span>{text.deltaNetRevenue}</span>
              <strong>{deltaText(props.projectedNet, props.baselineNet, true)}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="top-tasks">
        <div className="top-tasks-title">{text.asIsToBeTitle}</div>
        <div className="table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>{text.metric}</th>
                <th>{text.asIs}</th>
                <th>{text.toBe}</th>
                <th>{text.delta}</th>
              </tr>
            </thead>
            <tbody>
              {overviewRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.format(row.base)}</td>
                  <td>{row.format(row.projected)}</td>
                  <td className={deltaClass(row.projected, row.base)}>
                    {deltaByFormatter(row.projected, row.base, row.format)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="top-tasks">
        <div className="top-tasks-header">
          <div className="top-tasks-title">
            {text.topTasksTitle} ({props.topTasks.reduce((acc, task) => acc + task.taskCount, 0)} {text.tasksShort})
          </div>
        </div>
        <div className="top-tasks-subtitle">{text.topTasksHint}</div>
        <div className="top-tasks-list">
          {props.topTasks.length > 0 ? (
            props.topTasks.map((task, index) => (
              <div className="top-task-item" key={task.projectName}>
                <span>
                  <span className="top-task-rank">{index + 1}</span>
                  {task.projectName} ({task.taskCount} {text.tasksShort})
                </span>
                <strong className={task.value >= 0 ? "delta-positive" : "delta-negative"}>{formatCurrency(task.value)}</strong>
              </div>
            ))
          ) : (
            <div className="top-task-item">
              <span>{text.noActiveTasks}</span>
              <strong>{formatCurrency(0)}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="top-tasks">
        <div className="top-tasks-header">
          <div className="top-tasks-title">{text.allMetricsImpactTitle}</div>
          {props.selectedStageFilter ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => props.onSelectStageFilter("")}
            >
              {text.clearFilters}
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>{text.stage}</th>
                <th>{text.base}</th>
                <th>{text.fullyImplemented}</th>
                <th>{text.annualAverage}</th>
                <th>{text.stepChange}</th>
                <th>{text.annualChange}</th>
              </tr>
            </thead>
            <tbody>
              {conversionRows.map((row) => {
                const taskCount = getTaskCount(row.stage);

                return (
                  <tr key={row.label}>
                    <td>
                      <div className="metric-filter-cell">
                        <span>{row.label}</span>
                        <button
                          className={`metric-filter-button ${props.selectedStageFilter === row.stage ? "active" : ""}`}
                          type="button"
                          onClick={() => props.onSelectStageFilter(row.stage)}
                        >
                          ({taskCount})
                        </button>
                      </div>
                    </td>
                    <td>{row.format(row.base)}</td>
                    <td>{row.format(row.full)}</td>
                    <td>{row.format(row.year)}</td>
                    <td className={deltaClass(row.full, row.base)}>
                      {deltaByFormatter(row.full, row.base, row.format)}
                    </td>
                    <td className={deltaClass(row.year, row.base)}>
                      {deltaByFormatter(row.year, row.base, row.format)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
