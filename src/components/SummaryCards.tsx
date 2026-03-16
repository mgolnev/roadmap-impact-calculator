"use client";

import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type SummaryCardsProps = {
  baselineNet: number;
  projectedNet: number;
  baselineGross: number;
  projectedGross: number;
  baselineOrders: number;
  projectedOrders: number;
};

const Delta = ({ current, base, money = false }: { current: number; base: number; money?: boolean }) => {
  const delta = current - base;
  const deltaPct = base > 0 ? delta / base : 0;

  return (
    <div className="card delta-card">
      <div className="card-label">Дельта</div>
      <div className="card-value">{money ? formatCurrency(delta) : formatNumber(delta)}</div>
      <div className={`delta-pill ${delta >= 0 ? "positive" : "negative"}`}>
        {delta >= 0 ? "+" : ""}
        {formatPercent(deltaPct, 1)}
      </div>
    </div>
  );
};

export function SummaryCards(props: SummaryCardsProps) {
  return (
    <div className="summary-grid">
      <div className="card">
        <div className="card-label">Baseline Net Revenue</div>
        <div className="card-value">{formatCurrency(props.baselineNet)}</div>
      </div>
      <div className="card">
        <div className="card-label">Новый Net Revenue</div>
        <div className="card-value">{formatCurrency(props.projectedNet)}</div>
      </div>
      <Delta current={props.projectedNet} base={props.baselineNet} money />

      <div className="card">
        <div className="card-label">Baseline Gross Revenue</div>
        <div className="card-value">{formatCurrency(props.baselineGross)}</div>
      </div>
      <div className="card">
        <div className="card-label">Новый Gross Revenue</div>
        <div className="card-value">{formatCurrency(props.projectedGross)}</div>
      </div>
      <Delta current={props.projectedGross} base={props.baselineGross} money />

      <div className="card">
        <div className="card-label">Baseline Orders</div>
        <div className="card-value">{formatNumber(props.baselineOrders)}</div>
      </div>
      <div className="card">
        <div className="card-label">Новые Orders</div>
        <div className="card-value">{formatNumber(props.projectedOrders)}</div>
      </div>
      <Delta current={props.projectedOrders} base={props.baselineOrders} />
    </div>
  );
}
