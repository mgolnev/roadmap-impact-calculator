"use client";

import { getText } from "@/lib/i18n";
import { AnnualFunnel, FunnelRates } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { Locale } from "@/lib/types";

type ImpactHighlightsProps = {
  locale: Locale;
  trafficChangePercent: number;
  baselineNet: number;
  projectedNet: number;
  baselineGross: number;
  projectedGross: number;
  baselineOrders: number;
  projectedOrders: number;
  baselineAnnual: AnnualFunnel;
  projectedAnnual: AnnualFunnel;
  fullyImplementedRates: FunnelRates;
  fullyImplementedOrderToSessions: number;
  topTasks: Array<{ projectName: string; value: number; taskCount: number }>;
};

const deltaText = (current: number, base: number, money = false) => {
  const delta = current - base;
  const pct = base > 0 ? delta / base : 0;
  const main = money ? formatCurrency(delta) : formatNumber(delta);
  return `${delta >= 0 ? "+" : ""}${main} (${delta >= 0 ? "+" : ""}${formatPercent(pct)})`;
};

export function ImpactHighlights(props: ImpactHighlightsProps) {
  const text = getText(props.locale);
  const conversionRows = [
    {
      label: props.locale === "ru" ? "Сессии -> Каталог" : "Sessions -> Catalog",
      base: props.baselineAnnual.rates.catalogCr,
      full: props.fullyImplementedRates.catalogCr,
      year: props.projectedAnnual.rates.catalogCr,
    },
    {
      label: props.locale === "ru" ? "Каталог -> PDP" : "Catalog -> PDP",
      base: props.baselineAnnual.rates.pdpCr,
      full: props.fullyImplementedRates.pdpCr,
      year: props.projectedAnnual.rates.pdpCr,
    },
    {
      label: props.locale === "ru" ? "PDP -> Добавление в корзину" : "PDP -> Add to cart",
      base: props.baselineAnnual.rates.atcCr,
      full: props.fullyImplementedRates.atcCr,
      year: props.projectedAnnual.rates.atcCr,
    },
    {
      label: props.locale === "ru" ? "Добавление в корзину -> Checkout" : "Add to cart -> Checkout",
      base: props.baselineAnnual.rates.checkoutCr,
      full: props.fullyImplementedRates.checkoutCr,
      year: props.projectedAnnual.rates.checkoutCr,
    },
    {
      label: props.locale === "ru" ? "Checkout -> Заказ" : "Checkout -> Order",
      base: props.baselineAnnual.rates.orderCr,
      full: props.fullyImplementedRates.orderCr,
      year: props.projectedAnnual.rates.orderCr,
    },
    {
      label: props.locale === "ru" ? "Заказ / Сессии" : "Order / Sessions",
      base: props.baselineAnnual.toSessionsRates.orderCr,
      full: props.fullyImplementedOrderToSessions,
      year: props.projectedAnnual.toSessionsRates.orderCr,
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

      <div className="insight-grid">
        <div className="insight-card accent-card">
          <span>{text.trafficChange}</span>
          <strong>{`${props.trafficChangePercent >= 0 ? "+" : ""}${formatPercent(
            props.trafficChangePercent / 100,
          )}`}</strong>
        </div>
        <div className="insight-card">
          <span>{text.netRevenueAfterTasks}</span>
          <strong>{formatCurrency(props.projectedNet)}</strong>
        </div>
        <div className="insight-card">
          <span>{text.deltaNetRevenue}</span>
          <strong>{deltaText(props.projectedNet, props.baselineNet, true)}</strong>
        </div>
        <div className="insight-card">
          <span>{text.grossRevenueAfterTasks}</span>
          <strong>{formatCurrency(props.projectedGross)}</strong>
        </div>
        <div className="insight-card">
          <span>{text.deltaGrossRevenue}</span>
          <strong>{deltaText(props.projectedGross, props.baselineGross, true)}</strong>
        </div>
        <div className="insight-card">
          <span>{text.deltaOrders}</span>
          <strong>{deltaText(props.projectedOrders, props.baselineOrders)}</strong>
        </div>
      </div>

      <div className="top-tasks">
        <div className="top-tasks-title">{text.topTasksTitle}</div>
        <div className="top-tasks-list">
          {props.topTasks.length > 0 ? (
            props.topTasks.map((task, index) => (
              <div className="top-task-item" key={task.projectName}>
                <span>
                  {index + 1}. {task.projectName} ({task.taskCount} {text.tasksShort})
                </span>
                <strong>{formatCurrency(task.value)}</strong>
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
        <div className="top-tasks-title">{text.impactFunnelTitle}</div>
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
                const fullDelta = row.full - row.base;
                const yearDelta = row.year - row.base;

                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatPercent(row.base)}</td>
                    <td>{formatPercent(row.full)}</td>
                    <td>{formatPercent(row.year)}</td>
                    <td>
                      {fullDelta >= 0 ? "+" : ""}
                      {formatPercent(fullDelta)}
                    </td>
                    <td>
                      {yearDelta >= 0 ? "+" : ""}
                      {formatPercent(yearDelta)}
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
