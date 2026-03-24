import { formatNumber, formatPercent } from "@/lib/format";
import { getStageLabels } from "@/lib/i18n";
import type { AdjustableStage, ImpactType, Locale, Task } from "@/lib/types";

const ppLabel = (locale: Locale) => (locale === "ru" ? "п.п." : "p.p.");

/**
 * Одна строка описания влияния: полное имя этапа + понятная формулировка типа изменения.
 */
const oneLineReadable = (
  stage: AdjustableStage | undefined,
  type: ImpactType | undefined,
  value: number,
  locale: Locale,
): string => {
  if (!stage || !type) return "";
  const stageLabel = getStageLabels(locale)[stage];

  if (type === "relative_percent") {
    const pct = formatPercent(value, 1);
    if (stage === "traffic") {
      return locale === "ru" ? `${stageLabel}: ${pct}` : `${stageLabel}: ${pct}`;
    }
    if (stage === "atv") {
      return locale === "ru" ? `${stageLabel}: ${pct}` : `${stageLabel}: ${pct}`;
    }
    if (stage === "buyout") {
      return locale === "ru" ? `${stageLabel}: ${pct}` : `${stageLabel}: ${pct}`;
    }
    if (stage === "upt") {
      return locale === "ru" ? `${stageLabel}: ${pct}` : `${stageLabel}: ${pct}`;
    }
    return locale === "ru"
      ? `${stageLabel}: ${pct} к конверсии шага`
      : `${stageLabel}: ${pct} to step conversion`;
  }

  if (type === "absolute_pp") {
    const n = formatNumber(Math.abs(value) * 100, 1);
    const sign = value >= 0 ? "+" : "−";
    const body = `${sign}${n} ${ppLabel(locale)}`;
    if (stage === "traffic" || stage === "atv" || stage === "buyout" || stage === "upt") {
      return locale === "ru" ? `${stageLabel}: ${body}` : `${stageLabel}: ${body}`;
    }
    return locale === "ru"
      ? `${stageLabel}: ${body} к конверсии шага`
      : `${stageLabel}: ${body} to step conversion`;
  }

  const sign = value >= 0 ? "+" : "−";
  const num = `${sign}${formatNumber(Math.abs(value), 2)}`;
  return locale === "ru" ? `${stageLabel}: ${num}` : `${stageLabel}: ${num}`;
};

/** Несколько строк: основное и доп. влияние. */
export const formatTaskImpactLines = (task: Task, locale: Locale): string[] => {
  const first = oneLineReadable(task.stage1, task.impact1Type, task.impact1Value, locale);
  const second =
    task.stage2 && task.impact2Type
      ? oneLineReadable(task.stage2, task.impact2Type, task.impact2Value, locale)
      : "";
  return [first, second].filter(Boolean);
};

/** Склейка для экспорта / простого текста. */
export const formatTaskImpactSummary = (task: Task, locale: Locale): string =>
  formatTaskImpactLines(task, locale).join("\n");
