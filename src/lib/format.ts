export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);

export const formatPercent = (value: number, digits = 1) =>
  `${formatNumber(value * 100, digits)}%`;

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

/** Компактно для топ-таблиц: ₽123M при |value| ≥ 1M, иначе обычная сумма. */
export const formatCurrencyMillionsRub = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const v = Math.abs(value);
  if (v < 1_000_000) return formatCurrency(value);
  const m = v / 1_000_000;
  const s = m >= 10 ? String(Math.round(m)) : String(Math.round(m * 10) / 10).replace(/\.0$/, "");
  return `${sign}₽${s}M`;
};

export const formatImpactValue = (value: number, type?: string) => {
  if (!type) {
    return "—";
  }

  if (type === "relative_percent" || type === "absolute_pp") {
    return formatPercent(value, 1);
  }

  return formatNumber(value, 2);
};
