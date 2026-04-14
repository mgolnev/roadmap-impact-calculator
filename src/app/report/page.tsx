"use client";

import Link from "next/link";
import { useMemo } from "react";

import "./ceo-report.css";

import { CeoExecutiveRankingBlock } from "@/components/CeoExecutiveRankingBlock";
import { buildAnnualFunnelComparisonRows, type FunnelComparisonRow } from "@/lib/funnel-comparison";
import { formatCurrency, formatNumber, formatPercent, formatPercentForLocale } from "@/lib/format";
import { getText, getStageLabels } from "@/lib/i18n";
import { buildTopProjectsRevenueBundle } from "@/lib/top-projects-revenue";
import { buildTopTasksRevenueBundle } from "@/lib/top-tasks-revenue";
import { getTaskValueMetrics, getTrafficMultiplier, simulateScenario } from "@/lib/calculations";
import { taskCountsTowardPlan } from "@/lib/initiative";
import { useCalculatorStore } from "@/store/calculator-store";

const formatCell = (row: FunnelComparisonRow, value: number) => {
  if (row.format === "currency") return formatCurrency(value);
  if (row.format === "percent") return formatPercent(value, 2);
  if (row.metric.toLowerCase().includes("upt")) return formatNumber(value, 2);
  return formatNumber(value, 0);
};

const formatDeltaCell = (row: FunnelComparisonRow, delta: number) => {
  const prefix = delta > 0 ? "+" : "";
  if (row.format === "currency") return prefix + formatCurrency(delta);
  if (row.format === "percent") return prefix + formatPercent(delta, 2);
  if (row.metric.toLowerCase().includes("upt")) return prefix + formatNumber(delta, 2);
  return prefix + formatNumber(delta, 0);
};

export default function CeoReportPage() {
  const { baseline, tasks, ideas, trafficChangePercent, locale, timelineMode } = useCalculatorStore();
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);

  const allForMetrics = useMemo(() => [...ideas, ...tasks], [ideas, tasks]);

  const baselineSimulation = useMemo(
    () =>
      simulateScenario(baseline, [], getTrafficMultiplier(trafficChangePercent), { timelineMode }),
    [baseline, trafficChangePercent, timelineMode],
  );
  const projectedSimulation = useMemo(
    () =>
      simulateScenario(baseline, tasks, getTrafficMultiplier(trafficChangePercent), { timelineMode }),
    [baseline, trafficChangePercent, tasks, timelineMode],
  );
  const taskMetrics = useMemo(
    () => getTaskValueMetrics(baseline, allForMetrics, trafficChangePercent, { timelineMode }),
    [allForMetrics, baseline, trafficChangePercent, timelineMode],
  );

  const funnelRows = useMemo(
    () =>
      buildAnnualFunnelComparisonRows(
        locale,
        text,
        stageLabels,
        baselineSimulation.annual,
        projectedSimulation.annual,
      ),
    [baselineSimulation.annual, locale, projectedSimulation.annual, stageLabels, text],
  );

  const topTasksRevenue = useMemo(
    () =>
      buildTopTasksRevenueBundle(tasks, taskMetrics, locale, taskCountsTowardPlan, timelineMode),
    [locale, taskMetrics, tasks, timelineMode],
  );

  const topProjectsRevenue = useMemo(() => {
    const noProject = locale === "ru" ? "Без проекта" : "No project";
    return buildTopProjectsRevenueBundle(
      tasks,
      taskMetrics,
      locale,
      noProject,
      taskCountsTowardPlan,
      timelineMode,
    );
  }, [locale, taskMetrics, tasks, timelineMode]);

  const crImpactFooterLine = useMemo(() => {
    const t = getText(locale);
    const base = baselineSimulation.annual.toSessionsRates.orderCr;
    const after = projectedSimulation.annual.toSessionsRates.orderCr;
    const deltaRel = base > 0 ? Math.round(((after - base) / base) * 100) : 0;
    const deltaPct = deltaRel >= 0 ? `+${deltaRel}` : String(deltaRel);
    const core = t.ceoExecutiveCrLine
      .replace("{base}", formatPercentForLocale(base, 2, locale))
      .replace("{after}", formatPercentForLocale(after, 2, locale))
      .replace("{deltaPct}", deltaPct);
    return `${core} ${t.topTasksRevenueFooterSep} ${t.ceoExecutiveMetricLegend}`;
  }, [
    locale,
    baselineSimulation.annual.toSessionsRates.orderCr,
    projectedSimulation.annual.toSessionsRates.orderCr,
  ]);

  const baseNet = baselineSimulation.annual.netRevenue;
  const projNet = projectedSimulation.annual.netRevenue;
  const deltaNet = projNet - baseNet;
  const baseGross = baselineSimulation.annual.grossRevenue;
  const projGross = projectedSimulation.annual.grossRevenue;
  const deltaGross = projGross - baseGross;
  const baseOrders = baselineSimulation.annual.orders;
  const projOrders = projectedSimulation.annual.orders;
  const deltaOrders = projOrders - baseOrders;

  const activeCount = tasks.filter((t) => taskCountsTowardPlan(t)).length;
  const generated = new Date().toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const printReport = () => {
    window.print();
  };

  return (
    <div className="ceo-report">
      <div className="ceo-report__toolbar no-print">
        <Link className="ghost-button" href="/">
          {text.ceoReportBack}
        </Link>
        <button className="primary-button" type="button" onClick={printReport}>
          {text.ceoReportPrint}
        </button>
      </div>

      <p className="ceo-report__brand">Roadmap Impact Calculator 2026</p>
      <h1>{text.ceoReportTitle}</h1>
      <p className="ceo-report__meta">
        {text.ceoReportGenerated}: {generated}
      </p>
      <p className="ceo-report__lead">{text.ceoReportSubtitle}</p>

      <section className="ceo-report__section">
        <h2>{text.ceoReportSummary}</h2>
        <div className="ceo-report__kpis">
          <div className="ceo-report__kpi">
            <div className="ceo-report__kpi-label">{text.netRevenue}</div>
            <div className="ceo-report__kpi-value">{formatCurrency(projNet)}</div>
            <div className={`ceo-report__kpi-sub ${deltaNet >= 0 ? "delta-pos" : "delta-neg"}`}>
              Δ {formatCurrency(deltaNet)} {text.deltaToBaseTitle.toLowerCase()}
            </div>
          </div>
          <div className="ceo-report__kpi">
            <div className="ceo-report__kpi-label">{text.grossRevenue}</div>
            <div className="ceo-report__kpi-value">{formatCurrency(projGross)}</div>
            <div className={`ceo-report__kpi-sub ${deltaGross >= 0 ? "delta-pos" : "delta-neg"}`}>
              Δ {formatCurrency(deltaGross)}
            </div>
          </div>
          <div className="ceo-report__kpi">
            <div className="ceo-report__kpi-label">{text.grossOrders}</div>
            <div className="ceo-report__kpi-value">{formatNumber(projOrders, 0)}</div>
            <div className={`ceo-report__kpi-sub ${deltaOrders >= 0 ? "delta-pos" : "delta-neg"}`}>
              Δ {formatNumber(deltaOrders, 0)}
            </div>
          </div>
          <div className="ceo-report__kpi">
            <div className="ceo-report__kpi-label">{text.ceoReportTrafficNote}</div>
            <div className="ceo-report__kpi-value">{formatPercent(trafficChangePercent / 100, 0)}</div>
            <div className="ceo-report__kpi-sub">
              {text.sessions}: {formatNumber(projectedSimulation.annual.sessions, 0)}
            </div>
          </div>
          <div className="ceo-report__kpi">
            <div className="ceo-report__kpi-label">{text.ceoReportActiveTasksLabel}</div>
            <div className="ceo-report__kpi-value">{activeCount}</div>
            <div className="ceo-report__kpi-sub">
              {text.ceoReportTotalTasksLabel}: {tasks.length}
            </div>
          </div>
        </div>
      </section>

      <section className="ceo-report__section">
        <h2>{text.ceoReportFunnel}</h2>
        <div className="ceo-report__table-wrap">
          <table>
            <thead>
              <tr>
                <th>{text.ceoReportColMetric}</th>
                <th className="num">{text.ceoReportColBase}</th>
                <th className="num">{text.ceoReportColAfter}</th>
                <th className="num">{text.ceoReportColDelta}</th>
              </tr>
            </thead>
            <tbody>
              {funnelRows.map((row) => (
                <tr key={row.metric}>
                  <td>{row.metric}</td>
                  <td className="num">{formatCell(row, row.baseline)}</td>
                  <td className="num">{formatCell(row, row.afterTasks)}</td>
                  <td className={`num ${row.delta >= 0 ? "delta-pos" : "delta-neg"}`}>
                    {formatDeltaCell(row, row.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ceo-report__section ceo-report__section--executive-appendix">
        <CeoExecutiveRankingBlock
          locale={locale}
          data={topTasksRevenue}
          mode="tasks"
          crImpactFooterLine={crImpactFooterLine}
        />
        <CeoExecutiveRankingBlock
          locale={locale}
          data={topProjectsRevenue}
          mode="projects"
          crImpactFooterLine={crImpactFooterLine}
        />
      </section>
    </div>
  );
}
