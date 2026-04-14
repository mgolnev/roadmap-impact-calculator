"use client";

import { useEffect, useState } from "react";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { getMonthLabel, getText } from "@/lib/i18n";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import { Locale } from "@/lib/types";

type SeasonalityWeightsPanelProps = {
  locale: Locale;
  weights: number[];
  onCommit: (next: number[]) => void;
  onResetEqual: () => void;
};

const toDraft = (w: number[]) => w.map((x) => Math.round(x * 10000) / 100);

export function SeasonalityWeightsPanel({
  locale,
  weights,
  onCommit,
  onResetEqual,
}: SeasonalityWeightsPanelProps) {
  const text = getText(locale);
  const [draft, setDraft] = useState(() => toDraft(weights));

  useEffect(() => {
    setDraft(toDraft(weights));
  }, [weights]);

  const rawSum = draft.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);

  return (
    <CollapsibleSection
      className="seasonality-card"
      title={text.seasonalityTitle}
      description={<p className="seasonality-hint">{text.seasonalityHint}</p>}
      headerAside={
        <button className="ghost-button" type="button" onClick={() => onResetEqual()}>
          {text.seasonalityResetEqual}
        </button>
      }
    >
      <div className="seasonality-grid-scroll">
        <div className="seasonality-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <label key={i} className="seasonality-cell">
              <span className="seasonality-month">{getMonthLabel(locale, i + 1)}</span>
              <div className="seasonality-input-row">
                <input
                  className="cell-input seasonality-input"
                  inputMode="decimal"
                  type="text"
                  value={Number.isFinite(draft[i]) ? String(draft[i]) : ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\s+/g, "").replace(",", ".");
                    const next = [...draft];
                    if (v === "" || v === "-" || v === ".") {
                      next[i] = NaN;
                      setDraft(next);
                      return;
                    }
                    const n = Number(v);
                    next[i] = Number.isFinite(n) ? n : NaN;
                    setDraft(next);
                  }}
                  onBlur={() => {
                    const raw = draft.map((p) => (Number.isFinite(p) ? Math.max(0, p) : 0));
                    onCommit(normalizeSeasonalityWeights(raw));
                  }}
                />
              </div>
            </label>
          ))}
        </div>
      </div>
      <p className="seasonality-sum">
        {text.seasonalitySum}: {rawSum.toFixed(2)} — {text.seasonalitySumHint}
      </p>
    </CollapsibleSection>
  );
}
