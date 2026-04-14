"use client";

import { formatCurrencyMillionsRub } from "@/lib/format";
import { getMonthLabel, getText } from "@/lib/i18n";
import type { TopTasksRevenueBundle } from "@/lib/top-tasks-revenue";
import type { Locale } from "@/lib/types";

const pctOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

type CeoExecutiveRankingBlockProps = {
  locale: Locale;
  data: TopTasksRevenueBundle;
  mode: "tasks" | "projects";
  /** Одна строка: CR Impact + легенда (уже с « | BO = … »). */
  crImpactFooterLine: string;
};

export function CeoExecutiveRankingBlock({
  locale,
  data,
  mode,
  crImpactFooterLine,
}: CeoExecutiveRankingBlockProps) {
  const text = getText(locale);
  const title =
    mode === "tasks" ? text.ceoExecutiveTopTasksTitle : text.ceoExecutiveTopProjectTitle;
  const subtitle =
    mode === "tasks" ? text.ceoExecutiveTopTasksSubtitle : text.ceoExecutiveTopProjectSubtitle;

  if (data.displayRows.length === 0) {
    return (
      <div className="ceo-impact-table">
        <h3 className="ceo-impact-table__title">{title}</h3>
        <p className="ceo-impact-table__subtitle">{subtitle}</p>
        <p className="ceo-impact-table__empty">{text.noActiveTasks}</p>
      </div>
    );
  }

  return (
    <div className="ceo-impact-table">
      <h3 className="ceo-impact-table__title">{title}</h3>
      <p className="ceo-impact-table__subtitle">{subtitle}</p>
      <div className="ceo-impact-table__wrap">
        <table className="ceo-impact-table__grid">
          <thead>
            <tr>
              <th className="ceo-impact-table__th-rank">#</th>
              <th className="ceo-impact-table__th-task">
                {mode === "tasks" ? text.ceoExecutiveColTask : text.ceoExecutiveColProjectName}
              </th>
              <th className="ceo-impact-table__th-impact num">{text.ceoExecutiveColImpact}</th>
              <th className="ceo-impact-table__th-cr">{text.ceoExecutiveColCrDelta}</th>
              <th className="ceo-impact-table__th-timing num">{text.ceoExecutiveColTiming}</th>
            </tr>
          </thead>
          <tbody>
            {data.displayRows.map((row, index) => (
              <tr key={row.id} className={index < 3 ? "ceo-impact-table__row--top3" : undefined}>
                <td
                  className={`ceo-impact-table__td-rank ${index < 3 ? "ceo-impact-table__td-rank--top3" : ""}`}
                >
                  {index + 1}
                </td>
                <td className="ceo-impact-table__td-task">
                  <div className="ceo-impact-table__task-name">{row.taskName}</div>
                  {mode === "tasks" && row.project ? (
                    <div className="ceo-impact-table__task-project">{row.project}</div>
                  ) : null}
                </td>
                <td
                  className={`ceo-impact-table__td-impact num ${row.incremental >= 0 ? "ceo-impact-table__metric-pos" : "ceo-impact-table__metric-neg"}`}
                >
                  {formatCurrencyMillionsRub(row.incremental)}
                </td>
                <td
                  className={`ceo-impact-table__td-cr ceo-impact-table__cr-delta ${locale === "ru" ? "ceo-impact-table__cr-delta--verbose" : ""}`}
                >
                  {(
                    locale === "ru"
                      ? row.impactCeoVerbose || row.impactCeoCompact || row.impactSummary
                      : row.impactCeoCompact || row.impactSummary
                  )
                    .split("\n")
                    .map((line, i) => (
                    <div key={i} className="ceo-impact-table__cr-line">
                      {line}
                    </div>
                  ))}
                </td>
                <td className="ceo-impact-table__td-timing num">
                  {getMonthLabel(locale, row.releaseMonth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ceo-impact-table__footer">
        <p className="ceo-impact-table__footer-summary">
          <span>
            {text.topTasksRevenueFooterTop3}{" "}
            <strong>{formatCurrencyMillionsRub(data.sumTop3)}</strong> (
            {pctOf(data.sumTop3, data.sumTotal)}%)
          </span>
          <span className="ceo-impact-table__footer-sep">{text.topTasksRevenueFooterSep}</span>
          <span>
            {text.topTasksRevenueFooterTop10}{" "}
            <strong>{formatCurrencyMillionsRub(data.sumTop10)}</strong> (
            {pctOf(data.sumTop10, data.sumTotal)}%)
          </span>
          <span className="ceo-impact-table__footer-sep">{text.topTasksRevenueFooterSep}</span>
          <span>
            {text.ceoExecutiveFooterRoadmap}{" "}
            <strong>{formatCurrencyMillionsRub(data.sumTotal)}</strong>{" "}
            {text.ceoExecutiveFooterIncremental}
          </span>
        </p>
        <p className="ceo-impact-table__footer-detail">{crImpactFooterLine}</p>
      </div>
    </div>
  );
}
