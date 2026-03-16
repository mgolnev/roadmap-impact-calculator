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

export const formatImpactValue = (value: number, type?: string) => {
  if (!type) {
    return "—";
  }

  if (type === "relative_percent" || type === "absolute_pp") {
    return formatPercent(value, 1);
  }

  return formatNumber(value, 2);
};
