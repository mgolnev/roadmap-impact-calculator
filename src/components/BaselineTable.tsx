"use client";

import { useMemo, useState } from "react";

import { deriveBaseline, getBaseRates } from "@/lib/calculations";
import { getStageLabels, getText } from "@/lib/i18n";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { BaselineInput, Locale } from "@/lib/types";

type BaselineTableProps = {
  baseline: BaselineInput;
  locale: Locale;
  onChange: <K extends keyof BaselineInput>(key: K, value: number) => void;
  onReset: () => void;
};

const CR_FIELDS: Array<{ key: keyof BaselineInput; stage: "catalog" | "pdp" | "atc" | "checkout" | "order" }> = [
  { key: "catalogCr", stage: "catalog" },
  { key: "pdpCr", stage: "pdp" },
  { key: "atcCr", stage: "atc" },
  { key: "checkoutCr", stage: "checkout" },
  { key: "orderCr", stage: "order" },
];

const FINANCIAL_FIELDS: Array<{ key: keyof BaselineInput; textKey: "buyout" | "atv" | "upt"; step?: number }> = [
  { key: "buyoutRate", textKey: "buyout", step: 0.001 },
  { key: "atv", textKey: "atv", step: 1 },
  { key: "upt", textKey: "upt", step: 0.01 },
];

const formatEditableNumber = (value: number, maximumFractionDigits = 2) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("ru-RU", {
    useGrouping: false,
    maximumFractionDigits,
  }).format(value);
};

const parseEditableNumber = (value: string) => {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");

  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function EditableNumberInput({
  value,
  onCommit,
  maximumFractionDigits = 2,
}: {
  value: number;
  onCommit: (value: number) => void;
  maximumFractionDigits?: number;
}) {
  const [draft, setDraft] = useState(() => formatEditableNumber(value, maximumFractionDigits));
  const [isFocused, setIsFocused] = useState(false);

  const commitValue = () => {
    const parsed = parseEditableNumber(draft);

    if (parsed === null) {
      setDraft(formatEditableNumber(value, maximumFractionDigits));
      return;
    }

    onCommit(parsed);
    setDraft(formatEditableNumber(parsed, maximumFractionDigits));
  };

  return (
    <input
      className="cell-input baseline-cell-input"
      inputMode="decimal"
      type="text"
      value={isFocused ? draft : formatEditableNumber(value, maximumFractionDigits)}
      onFocus={() => {
        setDraft(formatEditableNumber(value, maximumFractionDigits));
        setIsFocused(true);
      }}
      onBlur={() => {
        setIsFocused(false);
        commitValue();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function BaselineTable({ baseline, locale, onChange, onReset }: BaselineTableProps) {
  const derived = deriveBaseline(baseline);
  const rates = getBaseRates(baseline);
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);
  const percentValues = useMemo(
    () => ({
      catalogCr: baseline.catalogCr * 100,
      pdpCr: baseline.pdpCr * 100,
      atcCr: baseline.atcCr * 100,
      checkoutCr: baseline.checkoutCr * 100,
      orderCr: baseline.orderCr * 100,
      buyoutRate: baseline.buyoutRate * 100,
    }),
    [baseline],
  );

  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h2>{text.baselineTitle}</h2>
          <p>
            {text.baselineDescription}
          </p>
        </div>
        <button className="ghost-button" onClick={onReset} type="button">
          {text.resetDefaults}
        </button>
      </div>

      <div className="table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>{text.metric}</th>
              <th>{stageLabels.catalog}</th>
              <th>{stageLabels.pdp}</th>
              <th>{stageLabels.atc}</th>
              <th>{stageLabels.checkout}</th>
              <th>{stageLabels.order}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{text.conversionPrev}</td>
              {CR_FIELDS.map((field) => (
                <td key={field.key}>
                  <EditableNumberInput
                    value={percentValues[field.key as keyof typeof percentValues]}
                    maximumFractionDigits={2}
                    onCommit={(nextValue) => onChange(field.key, nextValue / 100)}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td>{text.funnelValue}</td>
              <td>{formatNumber(derived.absolute.catalog)}</td>
              <td>{formatNumber(derived.absolute.pdp)}</td>
              <td>{formatNumber(derived.absolute.atc)}</td>
              <td>{formatNumber(derived.absolute.checkout)}</td>
              <td>{formatNumber(derived.absolute.orders)}</td>
            </tr>
            <tr>
              <td>{text.conversionToSessions}</td>
              <td>{formatPercent(rates.catalogCr)}</td>
              <td>{formatPercent(derived.absolute.pdp / baseline.sessions)}</td>
              <td>{formatPercent(derived.absolute.atc / baseline.sessions)}</td>
              <td>{formatPercent(derived.absolute.checkout / baseline.sessions)}</td>
              <td>{formatPercent(derived.absolute.orders / baseline.sessions)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="baseline-grid compact baseline-grid-subdued">
        <label className="field-card">
          <span>{text.sessions}</span>
          <EditableNumberInput
            value={baseline.sessions}
            maximumFractionDigits={0}
            onCommit={(nextValue) => onChange("sessions", nextValue)}
          />
        </label>
        {FINANCIAL_FIELDS.map((field) => (
          <label className="field-card" key={field.key}>
            <span>{text[field.textKey]}</span>
            <EditableNumberInput
              value={
                field.key === "buyoutRate"
                  ? percentValues.buyoutRate
                  : (baseline[field.key] as number)
              }
              maximumFractionDigits={field.key === "buyoutRate" ? 2 : field.key === "upt" ? 2 : 0}
              onCommit={(nextValue) =>
                onChange(
                  field.key,
                  field.key === "buyoutRate" ? nextValue / 100 : nextValue,
                )
              }
            />
          </label>
        ))}
        <div className="field-card read-only">
          <span>{text.grossRevenue}</span>
          <strong>{formatCurrency(derived.grossRevenue)}</strong>
        </div>
        <div className="field-card read-only">
          <span>{text.grossOrders}</span>
          <strong>{formatNumber(derived.absolute.orders)}</strong>
        </div>
        <div className="field-card read-only">
          <span>{text.asp}</span>
          <strong>{formatCurrency(derived.asp)}</strong>
        </div>
        <div className="field-card read-only">
          <span>{text.netRevenue}</span>
          <strong>{formatCurrency(derived.netRevenue)}</strong>
        </div>
      </div>
    </section>
  );
}
