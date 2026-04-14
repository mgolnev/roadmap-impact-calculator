"use client";

import { getMonthLabel, getText } from "@/lib/i18n";
import { MonthlyRow } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { Locale } from "@/lib/types";

type MonthlyModelTableProps = {
  locale: Locale;
  rows: MonthlyRow[];
};

export function MonthlyModelTable({ locale, rows }: MonthlyModelTableProps) {
  const text = getText(locale);
  return (
    <>
      <div className="table-wrap">
        <table className="matrix-table wide">
          <thead>
            <tr>
              <th>{text.month}</th>
              <th>{text.sessions}</th>
              <th>Catalog</th>
              <th>PDP</th>
              <th>ATC</th>
              <th>Checkout</th>
              <th>Orders</th>
              <th>{text.atv}</th>
              <th>{text.buyout}</th>
              <th>{text.grossRevenue}</th>
              <th>{text.netRevenue}</th>
              <th>{text.activeTasksCount}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td>{getMonthLabel(locale, row.month)}</td>
                <td>{formatNumber(row.sessions)}</td>
                <td>{formatNumber(row.catalog)}</td>
                <td>{formatNumber(row.pdp)}</td>
                <td>{formatNumber(row.atc)}</td>
                <td>{formatNumber(row.checkout)}</td>
                <td>{formatNumber(row.orders)}</td>
                <td>{formatCurrency(row.atv)}</td>
                <td>{formatPercent(row.buyoutRate)}</td>
                <td>{formatCurrency(row.grossRevenue)}</td>
                <td>{formatCurrency(row.netRevenue)}</td>
                <td>{row.activeTaskIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
