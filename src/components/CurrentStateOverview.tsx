"use client";

import { BaselineInput } from "@/lib/types";
import { deriveBaseline } from "@/lib/calculations";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type CurrentStateOverviewProps = {
  baseline: BaselineInput;
};

const FLOW_ITEMS = [
  { key: "sessions", label: "Sessions" },
  { key: "catalog", label: "Catalog" },
  { key: "pdp", label: "PDP" },
  { key: "atc", label: "Add to cart" },
  { key: "checkout", label: "Checkout" },
  { key: "orders", label: "Заказы" },
] as const;

export function CurrentStateOverview({ baseline }: CurrentStateOverviewProps) {
  const derived = deriveBaseline(baseline);

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>Текущая база</h2>
          <p>Сначала видны ключевые показатели по текущему состоянию, от трафика до заказов.</p>
        </div>
      </div>

      <div className="flow-grid">
        {FLOW_ITEMS.map((item) => (
          <div className="flow-card" key={item.key}>
            <span>{item.label}</span>
            <strong>{formatNumber(derived.absolute[item.key])}</strong>
          </div>
        ))}
      </div>

      <div className="insight-grid">
        <div className="insight-card">
          <span>Gross revenue</span>
          <strong>{formatCurrency(derived.grossRevenue)}</strong>
        </div>
        <div className="insight-card">
          <span>Net revenue</span>
          <strong>{formatCurrency(derived.netRevenue)}</strong>
        </div>
        <div className="insight-card">
          <span>% выкупа</span>
          <strong>{formatPercent(baseline.buyoutRate)}</strong>
        </div>
        <div className="insight-card">
          <span>ATV</span>
          <strong>{formatCurrency(baseline.atv)}</strong>
        </div>
        <div className="insight-card">
          <span>UPT</span>
          <strong>{formatNumber(baseline.upt, 2)}</strong>
        </div>
        <div className="insight-card">
          <span>Order / Sessions</span>
          <strong>{formatPercent(derived.absolute.orders / baseline.sessions)}</strong>
        </div>
      </div>
    </section>
  );
}
