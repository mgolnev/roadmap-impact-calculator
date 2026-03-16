"use client";

import { deriveBaseline, getBaseRates } from "@/lib/calculations";
import { BaselineInput } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type BaselineTableProps = {
  baseline: BaselineInput;
  onChange: <K extends keyof BaselineInput>(key: K, value: number) => void;
  onReset: () => void;
};

const FUNNEL_FIELDS: Array<{ key: keyof BaselineInput; label: string; step?: number }> = [
  { key: "sessions", label: "Sessions" },
  { key: "catalog", label: "Catalog" },
  { key: "pdp", label: "PDP" },
  { key: "atc", label: "Add to cart" },
  { key: "checkout", label: "Checkout" },
  { key: "orders", label: "Order" },
];

const FINANCIAL_FIELDS: Array<{ key: keyof BaselineInput; label: string; step?: number }> = [
  { key: "buyoutRate", label: "Buyout %", step: 0.001 },
  { key: "atv", label: "ATV", step: 1 },
  { key: "upt", label: "UPT", step: 0.01 },
];

export function BaselineTable({ baseline, onChange, onReset }: BaselineTableProps) {
  const derived = deriveBaseline(baseline);
  const rates = getBaseRates(baseline);

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>База воронки</h2>
          <p>
            Начинаем с трафика и заканчиваем заказом. Введенные значения сохраняются автоматически.
          </p>
        </div>
        <button className="ghost-button" onClick={onReset} type="button">
          Вернуть дефолтные значения
        </button>
      </div>

      <div className="table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Метрика</th>
              <th>Sessions</th>
              <th>Catalog</th>
              <th>PDP</th>
              <th>Add to cart</th>
              <th>Checkout</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Текущая воронка</td>
              {FUNNEL_FIELDS.map((field) => (
                <td key={field.key}>
                  <input
                    className="cell-input baseline-cell-input"
                    type="number"
                    step={field.step ?? 1}
                    value={baseline[field.key]}
                    onChange={(event) => onChange(field.key, Number(event.target.value))}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td>Конверсия к предыдущему шагу</td>
              <td>—</td>
              <td>{formatPercent(rates.catalogCr)}</td>
              <td>{formatPercent(rates.pdpCr)}</td>
              <td>{formatPercent(rates.atcCr)}</td>
              <td>{formatPercent(rates.checkoutCr)}</td>
              <td>{formatPercent(rates.orderCr)}</td>
            </tr>
            <tr>
              <td>Конверсия к сессиям</td>
              <td>{formatPercent(1)}</td>
              <td>{formatPercent(baseline.catalog / baseline.sessions)}</td>
              <td>{formatPercent(baseline.pdp / baseline.sessions)}</td>
              <td>{formatPercent(baseline.atc / baseline.sessions)}</td>
              <td>{formatPercent(baseline.checkout / baseline.sessions)}</td>
              <td>{formatPercent(baseline.orders / baseline.sessions)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="baseline-grid compact">
        {FINANCIAL_FIELDS.map((field) => (
          <label className="field-card" key={field.key}>
            <span>{field.label}</span>
            <input
              type="number"
              step={field.step ?? 1}
              value={baseline[field.key]}
              onChange={(event) => onChange(field.key, Number(event.target.value))}
            />
          </label>
        ))}
        <div className="field-card read-only">
          <span>Gross revenue</span>
          <strong>{formatCurrency(derived.grossRevenue)}</strong>
        </div>
        <div className="field-card read-only">
          <span>Orders units</span>
          <strong>{formatNumber(derived.orderUnits)}</strong>
        </div>
        <div className="field-card read-only">
          <span>ASP</span>
          <strong>{formatCurrency(derived.asp)}</strong>
        </div>
        <div className="field-card read-only">
          <span>Net revenue</span>
          <strong>{formatCurrency(derived.netRevenue)}</strong>
        </div>
      </div>
    </section>
  );
}
