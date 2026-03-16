"use client";

import { MonthlyRow } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type MonthlyModelTableProps = {
  rows: MonthlyRow[];
};

export function MonthlyModelTable({ rows }: MonthlyModelTableProps) {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Помесячная модель 2026</h2>
          <p>Задача влияет только с месяца релиза и до конца года.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="matrix-table wide">
          <thead>
            <tr>
              <th>Месяц</th>
              <th>Sessions</th>
              <th>Catalog</th>
              <th>PDP</th>
              <th>ATC</th>
              <th>Checkout</th>
              <th>Orders</th>
              <th>ATV</th>
              <th>Buyout</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Активные задачи</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td>{row.monthLabel}</td>
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
