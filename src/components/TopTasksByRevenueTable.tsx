"use client";

import { formatCurrencyMillionsRub } from "@/lib/format";
import { getMonthLabel, getText } from "@/lib/i18n";
import type { TopTasksRevenueBundle } from "@/lib/top-tasks-revenue";
import type { Locale } from "@/lib/types";

type TopTasksByRevenueTableProps = {
  locale: Locale;
  data: TopTasksRevenueBundle;
  /** dashboard — блок на главной; ceo — отчёт для печати */
  variant: "dashboard" | "ceo";
  /** Не дублировать заголовок (если снаружи уже есть заголовок секции, напр. CEO). */
  omitHeading?: boolean;
};

const pctOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

export function TopTasksByRevenueTable({ locale, data, variant, omitHeading }: TopTasksByRevenueTableProps) {
  const text = getText(locale);
  const rootClass = `top-tasks top-revenue-table${variant === "ceo" ? " top-revenue-table--ceo" : ""}`;

  if (data.displayRows.length === 0) {
    return (
      <div className={rootClass}>
        {!omitHeading ? (
          <>
            <div className="top-tasks-header">
              <div className="top-tasks-title">{text.topTasksRevenueTitle}</div>
            </div>
            <div className="top-tasks-subtitle">{text.topTasksRevenueSubtitle}</div>
          </>
        ) : null}
        <p className="toolbar-status">{text.noActiveTasks}</p>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {!omitHeading ? (
        <>
          <div className="top-tasks-header">
            <div className="top-tasks-title">{text.topTasksRevenueTitle}</div>
          </div>
          <div className="top-tasks-subtitle">{text.topTasksRevenueSubtitle}</div>
        </>
      ) : null}
      <div className="table-wrap top-revenue-table__wrap">
        <table className="matrix-table top-revenue-table__grid">
          <thead>
            <tr>
              <th className="top-revenue-table__th-num">#</th>
              <th>{text.topTasksRevenueColTask}</th>
              <th className="top-revenue-table__th-num num">{text.topTasksRevenueColImpact}</th>
              <th>{text.topTasksRevenueColMetric}</th>
              <th className="top-revenue-table__th-timing">{text.topTasksRevenueColTiming}</th>
            </tr>
          </thead>
          <tbody>
            {data.displayRows.map((row, index) => (
              <tr
                key={row.id}
                className={index < 3 ? "top-revenue-table__row--top3" : undefined}
              >
                <td className="top-revenue-table__td-num">{index + 1}</td>
                <td>
                  <div className="top-revenue-table__task-name">{row.taskName}</div>
                  {row.project ? (
                    <div className="top-revenue-table__task-project">{row.project}</div>
                  ) : null}
                </td>
                <td className={`num top-revenue-table__td-impact ${row.incremental >= 0 ? "delta-positive" : "delta-negative"}`}>
                  {formatCurrencyMillionsRub(row.incremental)}
                </td>
                <td className="top-revenue-table__td-metric">
                  {row.impactSummary.split("\n").map((line, i) => (
                    <div key={i} className="top-revenue-table__metric-line">
                      {line}
                    </div>
                  ))}
                </td>
                <td className="top-revenue-table__td-timing">{getMonthLabel(locale, row.releaseMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="top-revenue-table__footer">
        <span>
          {text.topTasksRevenueFooterTop3}{" "}
          <strong>{formatCurrencyMillionsRub(data.sumTop3)}</strong> ({pctOf(data.sumTop3, data.sumTotal)}%)
        </span>
        <span className="top-revenue-table__footer-sep">{text.topTasksRevenueFooterSep}</span>
        <span>
          {text.topTasksRevenueFooterTop10}{" "}
          <strong>{formatCurrencyMillionsRub(data.sumTop10)}</strong> ({pctOf(data.sumTop10, data.sumTotal)}%)
        </span>
        <span className="top-revenue-table__footer-sep">{text.topTasksRevenueFooterSep}</span>
        <span>
          {text.topTasksRevenueFooterTotal}{" "}
          <strong>{formatCurrencyMillionsRub(data.sumTotal)}</strong>
        </span>
      </div>
      <p className="top-revenue-table__legend">{text.topTasksRevenueLegend}</p>
    </div>
  );
}
