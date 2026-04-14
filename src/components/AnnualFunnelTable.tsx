"use client";

import { getText } from "@/lib/i18n";
import { AnnualFunnel } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { Locale } from "@/lib/types";

type AnnualFunnelTableProps = {
  locale: Locale;
  baseline: AnnualFunnel;
  projected: AnnualFunnel;
};

const renderDelta = (projected: number, baseline: number, formatter: (value: number) => string) => {
  const delta = projected - baseline;
  const prefix = delta >= 0 ? "+" : "";
  return `${prefix}${formatter(delta)}`;
};

export function AnnualFunnelTable({ locale, baseline, projected }: AnnualFunnelTableProps) {
  const text = getText(locale);
  return (
    <>
      <div className="table-wrap">
        <table className="matrix-table wide">
          <thead>
            <tr>
              <th>{text.metric}</th>
              <th>{text.base}</th>
              <th>{text.afterTasks}</th>
              <th>{text.delta}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sessions</td>
              <td>{formatNumber(baseline.sessions)}</td>
              <td>{formatNumber(projected.sessions)}</td>
              <td>{renderDelta(projected.sessions, baseline.sessions, formatNumber)}</td>
            </tr>
            <tr>
              <td>Catalog</td>
              <td>{formatNumber(baseline.catalog)}</td>
              <td>{formatNumber(projected.catalog)}</td>
              <td>{renderDelta(projected.catalog, baseline.catalog, formatNumber)}</td>
            </tr>
            <tr>
              <td>PDP</td>
              <td>{formatNumber(baseline.pdp)}</td>
              <td>{formatNumber(projected.pdp)}</td>
              <td>{renderDelta(projected.pdp, baseline.pdp, formatNumber)}</td>
            </tr>
            <tr>
              <td>Add to cart</td>
              <td>{formatNumber(baseline.atc)}</td>
              <td>{formatNumber(projected.atc)}</td>
              <td>{renderDelta(projected.atc, baseline.atc, formatNumber)}</td>
            </tr>
            <tr>
              <td>Checkout</td>
              <td>{formatNumber(baseline.checkout)}</td>
              <td>{formatNumber(projected.checkout)}</td>
              <td>{renderDelta(projected.checkout, baseline.checkout, formatNumber)}</td>
            </tr>
            <tr>
              <td>Orders</td>
              <td>{formatNumber(baseline.orders)}</td>
              <td>{formatNumber(projected.orders)}</td>
              <td>{renderDelta(projected.orders, baseline.orders, formatNumber)}</td>
            </tr>
            <tr>
              <td>Gross revenue</td>
              <td>{formatCurrency(baseline.grossRevenue)}</td>
              <td>{formatCurrency(projected.grossRevenue)}</td>
              <td>{renderDelta(projected.grossRevenue, baseline.grossRevenue, formatCurrency)}</td>
            </tr>
            <tr>
              <td>Net revenue</td>
              <td>{formatCurrency(baseline.netRevenue)}</td>
              <td>{formatCurrency(projected.netRevenue)}</td>
              <td>{renderDelta(projected.netRevenue, baseline.netRevenue, formatCurrency)}</td>
            </tr>
            <tr>
              <td>Catalog CR</td>
              <td>{formatPercent(baseline.rates.catalogCr)}</td>
              <td>{formatPercent(projected.rates.catalogCr)}</td>
              <td>{renderDelta(projected.rates.catalogCr, baseline.rates.catalogCr, (value) => formatPercent(value))}</td>
            </tr>
            <tr>
              <td>PDP CR</td>
              <td>{formatPercent(baseline.rates.pdpCr)}</td>
              <td>{formatPercent(projected.rates.pdpCr)}</td>
              <td>{renderDelta(projected.rates.pdpCr, baseline.rates.pdpCr, (value) => formatPercent(value))}</td>
            </tr>
            <tr>
              <td>ATC CR</td>
              <td>{formatPercent(baseline.rates.atcCr)}</td>
              <td>{formatPercent(projected.rates.atcCr)}</td>
              <td>{renderDelta(projected.rates.atcCr, baseline.rates.atcCr, (value) => formatPercent(value))}</td>
            </tr>
            <tr>
              <td>Checkout CR</td>
              <td>{formatPercent(baseline.rates.checkoutCr)}</td>
              <td>{formatPercent(projected.rates.checkoutCr)}</td>
              <td>{renderDelta(projected.rates.checkoutCr, baseline.rates.checkoutCr, (value) => formatPercent(value))}</td>
            </tr>
            <tr>
              <td>Order CR</td>
              <td>{formatPercent(baseline.rates.orderCr)}</td>
              <td>{formatPercent(projected.rates.orderCr)}</td>
              <td>{renderDelta(projected.rates.orderCr, baseline.rates.orderCr, (value) => formatPercent(value))}</td>
            </tr>
            <tr>
              <td>Order / Sessions</td>
              <td>{formatPercent(baseline.toSessionsRates.orderCr)}</td>
              <td>{formatPercent(projected.toSessionsRates.orderCr)}</td>
              <td>
                {renderDelta(
                  projected.toSessionsRates.orderCr,
                  baseline.toSessionsRates.orderCr,
                  (value) => formatPercent(value),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
