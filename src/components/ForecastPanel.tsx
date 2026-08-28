"use client";

import { useMemo } from "react";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import {
  buildAllForecastScenarios,
  computeFactYtdNet,
  computeMonthRevenue,
  computePlanYtdNet,
  ordersFromChannels,
} from "@/lib/forecast/calculations";
import { formatCurrency, formatNumber, formatPercentForLocale } from "@/lib/format";
import { getForecastChannelLabel, getMonthLabel, getText } from "@/lib/i18n";
import {
  BaselineInput,
  ForecastPlan,
  ForecastScenarioId,
  Locale,
  MARKETING_CHANNEL_IDS,
  MarketingChannelId,
  MonthlyFactStatus,
  PlanYear,
  Task,
  TimelineMode,
} from "@/lib/types";

type ForecastPanelProps = {
  locale: Locale;
  planYear: PlanYear;
  baseline: BaselineInput;
  tasks: Task[];
  trafficChangePercent: number;
  timelineMode: TimelineMode;
  forecast: ForecastPlan;
  onSetAnnualNetTarget: (value: number) => void;
  onSetLastFactMonth: (month: number) => void;
  onUpdateMonthlyFact: (
    monthIndex: number,
    patch: Partial<{
      status: MonthlyFactStatus;
      partialDays: number;
      daysInMonth: number;
      atv: number;
      buyoutRate: number;
    }>,
  ) => void;
  onUpdateMonthlyFactChannel: (
    monthIndex: number,
    channelId: MarketingChannelId,
    patch: Partial<{ sessions: number; cr: number }>,
  ) => void;
  onUpdateChannelPlan: (
    channelId: MarketingChannelId,
    patch: Partial<{
      activeFromMonth: number;
      includeInMediaScenario: boolean;
    }>,
  ) => void;
  onUpdateChannelPlanCell: (
    channelId: MarketingChannelId,
    field: "planSessions" | "planCr",
    monthIndex: number,
    value: number,
  ) => void;
};

const SCENARIO_IDS: ForecastScenarioId[] = ["do_nothing", "media", "media_roadmap"];

const parseInputNumber = (raw: string): number => {
  const v = raw.replace(/\s+/g, "").replace(",", ".");
  if (v === "" || v === "-" || v === ".") return NaN;
  return Number(v);
};

/** Numeric cell: commit on blur. */
function NumericCell({
  value,
  onCommit,
  percent,
}: {
  value: number;
  onCommit: (value: number) => void;
  percent?: boolean;
}) {
  return (
    <input
      className="cell-input forecast-cell-input"
      inputMode="decimal"
      type="text"
      defaultValue={
        Number.isFinite(value) && value !== 0 ? String(percent ? value * 100 : Math.round(value)) : ""
      }
      key={`${value}-${percent ? "p" : "n"}`}
      onBlur={(e) => {
        const n = parseInputNumber(e.target.value);
        onCommit(Number.isFinite(n) ? (percent ? n / 100 : n) : 0);
      }}
    />
  );
}

const scenarioLabel = (locale: Locale, id: ForecastScenarioId) => {
  const text = getText(locale);
  if (id === "do_nothing") return text.forecastScenarioDoNothing;
  if (id === "media") return text.forecastScenarioMedia;
  return text.forecastScenarioMediaRoadmap;
};

const statusLabel = (locale: Locale, status: MonthlyFactStatus) => {
  const text = getText(locale);
  if (status === "closed") return text.forecastStatusClosed;
  if (status === "partial") return text.forecastStatusPartial;
  return text.forecastStatusOpen;
};

const renderDelta = (delta: number, locale: Locale) => {
  const prefix = delta > 0 ? "+" : "";
  return (
    <span className={delta >= 0 ? "delta-positive" : "delta-negative"}>
      {prefix}
      {formatCurrency(delta)}
    </span>
  );
};

export function ForecastPanel({
  locale,
  planYear,
  baseline,
  tasks,
  trafficChangePercent,
  timelineMode,
  forecast,
  onSetAnnualNetTarget,
  onSetLastFactMonth,
  onUpdateMonthlyFact,
  onUpdateMonthlyFactChannel,
  onUpdateChannelPlan,
  onUpdateChannelPlanCell,
}: ForecastPanelProps) {
  const text = getText(locale);

  const scenarios = useMemo(
    () =>
      buildAllForecastScenarios(forecast, baseline.seasonalityWeights, {
        baseline,
        tasks,
        trafficChangePercent,
        timelineMode,
      }),
    [forecast, baseline, tasks, trafficChangePercent, timelineMode],
  );

  const ytdFact = useMemo(() => computeFactYtdNet(forecast), [forecast]);
  const ytdPlan = useMemo(
    () => computePlanYtdNet(forecast, baseline.seasonalityWeights),
    [forecast, baseline.seasonalityWeights],
  );

  return (
    <>
      <section className="section-card forecast-hero">
        <p className="hero-eyebrow">{text.tabForecast}</p>
        <h2 className="hero-title">{text.forecastTitle.replace("2026", String(planYear))}</h2>
        <p className="hero-description">{text.forecastDescription}</p>

        <div className="forecast-controls">
          <label className="forecast-control">
            <span>{text.forecastAnnualTarget}</span>
            <NumericCell value={forecast.annualNetTarget} onCommit={onSetAnnualNetTarget} />
          </label>
          <label className="forecast-control">
            <span>{text.forecastLastFactMonth}</span>
            <select
              value={forecast.lastFactMonth}
              onChange={(e) => onSetLastFactMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {getMonthLabel(locale, i + 1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="forecast-kpi-grid">
          <div className="forecast-kpi">
            <span className="forecast-kpi-label">{text.forecastYtdFact}</span>
            <strong>{formatCurrency(ytdFact)}</strong>
            {renderDelta(ytdFact - ytdPlan, locale)}
          </div>
          <div className="forecast-kpi">
            <span className="forecast-kpi-label">{text.forecastYtdPlan}</span>
            <strong>{formatCurrency(ytdPlan)}</strong>
          </div>
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="forecast-kpi forecast-kpi-scenario">
              <span className="forecast-kpi-label">{scenarioLabel(locale, scenario.id)}</span>
              <strong>{formatCurrency(scenario.annualNetRevenue)}</strong>
              <span className="forecast-kpi-deltas">
                {text.forecastDeltaToPlan}: {renderDelta(scenario.deltaToPlan, locale)}
                {scenario.id !== "do_nothing" ? (
                  <>
                    {" · "}
                    {text.forecastDeltaToDoNothing}: {renderDelta(scenario.deltaToDoNothing, locale)}
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      <CollapsibleSection
        defaultOpen
        title={text.forecastFactTableTitle}
        description={<p className="forecast-hint">{text.forecastFactTableHint}</p>}
      >
        <div className="table-scroll">
          <table className="data-table forecast-table">
            <thead>
              <tr>
                <th rowSpan={2}>{text.forecastColMonth}</th>
                <th rowSpan={2}>{text.forecastColStatus}</th>
                {MARKETING_CHANNEL_IDS.map((id) => (
                  <th key={id} colSpan={2} className="forecast-channel-header">
                    {getForecastChannelLabel(locale, id)}
                  </th>
                ))}
                <th rowSpan={2}>{text.forecastColOrders}</th>
                <th rowSpan={2}>{text.forecastColAtv}</th>
                <th rowSpan={2}>{text.forecastColBuyout}</th>
                <th rowSpan={2}>{text.forecastColNet}</th>
              </tr>
              <tr>
                {MARKETING_CHANNEL_IDS.flatMap((id) => [
                  <th key={`${id}-s`}>{text.forecastColSessions}</th>,
                  <th key={`${id}-c`}>{text.forecastColCr}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {forecast.monthlyFacts.map((fact, monthIndex) => {
                const month = monthIndex + 1;
                const isFactRow = month <= forecast.lastFactMonth;
                const orders = ordersFromChannels(fact.channels);
                const net = computeMonthRevenue(orders, fact.atv, fact.buyoutRate).netRevenue;

                return (
                  <tr key={month} className={isFactRow ? "forecast-row-fact" : "forecast-row-open"}>
                    <td>{getMonthLabel(locale, month)}</td>
                    <td>
                      {isFactRow ? (
                        <select
                          className="forecast-status-select"
                          value={fact.status}
                          onChange={(e) =>
                            onUpdateMonthlyFact(monthIndex, {
                              status: e.target.value as MonthlyFactStatus,
                            })
                          }
                        >
                          <option value="closed">{text.forecastStatusClosed}</option>
                          <option value="partial">{text.forecastStatusPartial}</option>
                          <option value="open">{text.forecastStatusOpen}</option>
                        </select>
                      ) : (
                        statusLabel(locale, "open")
                      )}
                      {fact.status === "partial" && isFactRow ? (
                        <div className="forecast-partial-days">
                          <label>
                            {text.forecastPartialDays}
                            <NumericCell
                              value={fact.partialDays ?? 0}
                              onCommit={(v) => onUpdateMonthlyFact(monthIndex, { partialDays: v })}
                            />
                          </label>
                          <label>
                            {text.forecastDaysInMonth}
                            <NumericCell
                              value={fact.daysInMonth ?? 0}
                              onCommit={(v) => onUpdateMonthlyFact(monthIndex, { daysInMonth: v })}
                            />
                          </label>
                        </div>
                      ) : null}
                    </td>
                    {MARKETING_CHANNEL_IDS.flatMap((channelId) => {
                      const ch = fact.channels[channelId] ?? { sessions: 0, cr: 0 };
                      return [
                        <td key={`${channelId}-s`}>
                          {isFactRow && fact.status !== "open" ? (
                            <NumericCell
                              value={ch.sessions}
                              onCommit={(v) =>
                                onUpdateMonthlyFactChannel(monthIndex, channelId, { sessions: v })
                              }
                            />
                          ) : (
                            formatNumber(ch.sessions)
                          )}
                        </td>,
                        <td key={`${channelId}-c`}>
                          {isFactRow && fact.status !== "open" ? (
                            <NumericCell
                              value={ch.cr}
                              percent
                              onCommit={(v) =>
                                onUpdateMonthlyFactChannel(monthIndex, channelId, { cr: v })
                              }
                            />
                          ) : (
                            formatPercentForLocale(ch.cr, 2, locale)
                          )}
                        </td>,
                      ];
                    })}
                    <td>{formatNumber(orders)}</td>
                    <td>
                      {isFactRow && fact.status !== "open" ? (
                        <NumericCell
                          value={fact.atv}
                          onCommit={(v) => onUpdateMonthlyFact(monthIndex, { atv: v })}
                        />
                      ) : (
                        formatCurrency(fact.atv)
                      )}
                    </td>
                    <td>
                      {isFactRow && fact.status !== "open" ? (
                        <NumericCell
                          value={fact.buyoutRate}
                          percent
                          onCommit={(v) => onUpdateMonthlyFact(monthIndex, { buyoutRate: v })}
                        />
                      ) : (
                        formatPercentForLocale(fact.buyoutRate, 1, locale)
                      )}
                    </td>
                    <td>
                      <strong>{formatCurrency(net)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        defaultOpen={false}
        title={text.forecastChannelPlanTitle}
        description={<p className="forecast-hint">{text.forecastChannelPlanHint}</p>}
      >
        {forecast.channels.map((channel) => (
          <div key={channel.id} className="forecast-channel-block">
            <div className="forecast-channel-header-row">
              <h3>{getForecastChannelLabel(locale, channel.id)}</h3>
              <label className="forecast-channel-meta">
                {text.forecastActiveFrom}
                <select
                  value={channel.activeFromMonth}
                  onChange={(e) =>
                    onUpdateChannelPlan(channel.id, {
                      activeFromMonth: Number(e.target.value),
                    })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthLabel(locale, i + 1)}
                    </option>
                  ))}
                </select>
              </label>
              {channel.id !== "organic" ? (
                <label className="forecast-channel-meta forecast-checkbox">
                  <input
                    type="checkbox"
                    checked={channel.includeInMediaScenario}
                    onChange={(e) =>
                      onUpdateChannelPlan(channel.id, {
                        includeInMediaScenario: e.target.checked,
                      })
                    }
                  />
                  {text.forecastInMediaScenario}
                </label>
              ) : null}
            </div>
            <div className="table-scroll">
              <table className="data-table forecast-table forecast-channel-table">
                <thead>
                  <tr>
                    <th>{text.metric}</th>
                    {Array.from({ length: 12 }, (_, i) => (
                      <th key={i}>{getMonthLabel(locale, i + 1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{text.forecastColSessions}</td>
                    {channel.planSessions.map((value, monthIndex) => (
                      <td key={monthIndex}>
                        <NumericCell
                          value={value}
                          onCommit={(v) =>
                            onUpdateChannelPlanCell(channel.id, "planSessions", monthIndex, v)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>{text.forecastColCr}</td>
                    {channel.planCr.map((value, monthIndex) => (
                      <td key={monthIndex}>
                        <NumericCell
                          value={value}
                          percent
                          onCommit={(v) =>
                            onUpdateChannelPlanCell(channel.id, "planCr", monthIndex, v)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        defaultOpen
        title={text.forecastScenarioCompareTitle}
        description={<p className="forecast-hint">{text.forecastAnnualNet}</p>}
      >
        <div className="table-scroll">
          <table className="data-table forecast-table">
            <thead>
              <tr>
                <th>{text.forecastColMonth}</th>
                <th>{text.forecastColPlanNet}</th>
                {SCENARIO_IDS.map((id) => (
                  <th key={id}>{scenarioLabel(locale, id)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, monthIndex) => {
                const month = monthIndex + 1;
                const planNet =
                  scenarios[0]?.months[monthIndex]?.planNetRevenue ?? 0;
                return (
                  <tr key={month}>
                    <td>{getMonthLabel(locale, month)}</td>
                    <td>{formatCurrency(planNet)}</td>
                    {SCENARIO_IDS.map((id) => {
                      const row = scenarios.find((s) => s.id === id)?.months[monthIndex];
                      return (
                        <td key={id} className={row?.source === "fact" ? "forecast-cell-fact" : ""}>
                          {formatCurrency(row?.netRevenue ?? 0)}
                          <span className="forecast-source-tag">
                            {row?.source === "fact"
                              ? text.forecastSourceFact
                              : text.forecastSourceForecast}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="forecast-total-row">
                <td>
                  <strong>{text.forecastAnnualNet}</strong>
                </td>
                <td>
                  <strong>{formatCurrency(scenarios[0]?.annualPlanNetRevenue ?? 0)}</strong>
                </td>
                {SCENARIO_IDS.map((id) => {
                  const scenario = scenarios.find((s) => s.id === id);
                  return (
                    <td key={id}>
                      <strong>{formatCurrency(scenario?.annualNetRevenue ?? 0)}</strong>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </>
  );
}
