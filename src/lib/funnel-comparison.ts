import { getStageLabels, getText } from "@/lib/i18n";
import { AnnualFunnel, Locale } from "@/lib/types";

export type FunnelComparisonFormat = "number" | "currency" | "percent";

export type FunnelComparisonRow = {
  metric: string;
  baseline: number;
  afterTasks: number;
  delta: number;
  format: FunnelComparisonFormat;
};

/** Same metrics as AnnualFunnelTable + money/order-unit metrics (Excel + CEO report). */
export const buildAnnualFunnelComparisonRows = (
  locale: Locale,
  text: ReturnType<typeof getText>,
  stageLabels: ReturnType<typeof getStageLabels>,
  baseline: AnnualFunnel,
  projected: AnnualFunnel,
): FunnelComparisonRow[] => {
  const d = (a: number, b: number) => b - a;
  const rows: FunnelComparisonRow[] = [
    { metric: text.sessions, baseline: baseline.sessions, afterTasks: projected.sessions, delta: d(baseline.sessions, projected.sessions), format: "number" },
    { metric: stageLabels.catalog, baseline: baseline.catalog, afterTasks: projected.catalog, delta: d(baseline.catalog, projected.catalog), format: "number" },
    { metric: stageLabels.pdp, baseline: baseline.pdp, afterTasks: projected.pdp, delta: d(baseline.pdp, projected.pdp), format: "number" },
    { metric: stageLabels.atc, baseline: baseline.atc, afterTasks: projected.atc, delta: d(baseline.atc, projected.atc), format: "number" },
    { metric: stageLabels.checkout, baseline: baseline.checkout, afterTasks: projected.checkout, delta: d(baseline.checkout, projected.checkout), format: "number" },
    { metric: text.grossOrders, baseline: baseline.orders, afterTasks: projected.orders, delta: d(baseline.orders, projected.orders), format: "number" },
    { metric: text.grossRevenue, baseline: baseline.grossRevenue, afterTasks: projected.grossRevenue, delta: d(baseline.grossRevenue, projected.grossRevenue), format: "currency" },
    { metric: text.netRevenue, baseline: baseline.netRevenue, afterTasks: projected.netRevenue, delta: d(baseline.netRevenue, projected.netRevenue), format: "currency" },
    { metric: text.buyout, baseline: baseline.buyoutRate, afterTasks: projected.buyoutRate, delta: d(baseline.buyoutRate, projected.buyoutRate), format: "percent" },
    { metric: text.atv, baseline: baseline.atv, afterTasks: projected.atv, delta: d(baseline.atv, projected.atv), format: "currency" },
    { metric: text.upt, baseline: baseline.upt, afterTasks: projected.upt, delta: d(baseline.upt, projected.upt), format: "number" },
    { metric: text.ordersUnits, baseline: baseline.orderUnits, afterTasks: projected.orderUnits, delta: d(baseline.orderUnits, projected.orderUnits), format: "number" },
    { metric: text.asp, baseline: baseline.asp, afterTasks: projected.asp, delta: d(baseline.asp, projected.asp), format: "currency" },
    { metric: `${stageLabels.catalog} CR`, baseline: baseline.rates.catalogCr, afterTasks: projected.rates.catalogCr, delta: d(baseline.rates.catalogCr, projected.rates.catalogCr), format: "percent" },
    { metric: `${stageLabels.pdp} CR`, baseline: baseline.rates.pdpCr, afterTasks: projected.rates.pdpCr, delta: d(baseline.rates.pdpCr, projected.rates.pdpCr), format: "percent" },
    { metric: `${stageLabels.atc} CR`, baseline: baseline.rates.atcCr, afterTasks: projected.rates.atcCr, delta: d(baseline.rates.atcCr, projected.rates.atcCr), format: "percent" },
    { metric: `${stageLabels.checkout} CR`, baseline: baseline.rates.checkoutCr, afterTasks: projected.rates.checkoutCr, delta: d(baseline.rates.checkoutCr, projected.rates.checkoutCr), format: "percent" },
    { metric: `${stageLabels.order} CR`, baseline: baseline.rates.orderCr, afterTasks: projected.rates.orderCr, delta: d(baseline.rates.orderCr, projected.rates.orderCr), format: "percent" },
    {
      metric: locale === "ru" ? "Заказ / Сессии" : "Order / Sessions",
      baseline: baseline.toSessionsRates.orderCr,
      afterTasks: projected.toSessionsRates.orderCr,
      delta: d(baseline.toSessionsRates.orderCr, projected.toSessionsRates.orderCr),
      format: "percent",
    },
  ];
  return rows;
};
