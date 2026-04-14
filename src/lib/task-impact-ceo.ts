import { formatPercentForLocale } from "@/lib/format";
import { getStageLabels } from "@/lib/i18n";
import type { AdjustableStage, ImpactType, Locale, Task } from "@/lib/types";

/** Сокращения как в легенде CEO: BO, C/O, ATC, Trf, AOV, Cat … */
const STAGE_TO_ACRONYM: Record<AdjustableStage, string> = {
  catalog: "Cat",
  pdp: "PDP",
  atc: "ATC",
  checkout: "C/O",
  order: "Ord",
  traffic: "Trf",
  atv: "AOV",
  buyout: "BO",
  upt: "UPT",
};

const numLocale = (locale: Locale) => (locale === "en" ? "en-GB" : "ru-RU");

function formatSignedPercent(value: number, locale: Locale): string {
  const pct = value * 100;
  const isInt = Math.abs(pct - Math.round(pct)) < 1e-6;
  const digits = isInt ? 0 : 1;
  const n = new Intl.NumberFormat(numLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Math.abs(pct));
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${n}%`;
}

function formatSignedPp(value: number, locale: Locale): string {
  const ppVal = Math.abs(value) * 100;
  const isInt = Math.abs(ppVal - Math.round(ppVal)) < 1e-6;
  const digits = isInt ? 0 : 1;
  const n = new Intl.NumberFormat(numLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ppVal);
  const sign = value >= 0 ? "+" : "−";
  const unit = locale === "ru" ? "п.п." : "pp";
  // EN: +7pp BO; RU: +7,0 п.п. BO
  const core = locale === "ru" ? `${sign}${n} ${unit}` : `${sign}${n}${unit}`;
  return core;
}

/**
 * Одна метрика в стиле слайда CEO: «+10% C/O», «+7pp BO» (числа с учётом локали).
 */
function oneImpactCeoCompact(
  stage: AdjustableStage | undefined,
  type: ImpactType | undefined,
  value: number,
  locale: Locale,
): string {
  if (!stage || !type) return "";
  const tag = STAGE_TO_ACRONYM[stage] ?? stage;

  const withTag = (core: string) => `${core} ${tag}`;

  if (type === "relative_percent") {
    return withTag(formatSignedPercent(value, locale));
  }
  if (type === "absolute_pp") {
    return withTag(formatSignedPp(value, locale));
  }
  const sign = value >= 0 ? "+" : "−";
  const n = new Intl.NumberFormat(numLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return withTag(`${sign}${n}`);
}

export function formatTaskImpactCeoCompactLines(task: Task, locale: Locale): string[] {
  const first = oneImpactCeoCompact(task.stage1, task.impact1Type, task.impact1Value, locale);
  const second =
    task.stage2 && task.impact2Type
      ? oneImpactCeoCompact(task.stage2, task.impact2Type, task.impact2Value, locale)
      : "";
  return [first, second].filter(Boolean);
}

export function formatTaskImpactCeoCompactSummary(task: Task, locale: Locale): string {
  return formatTaskImpactCeoCompactLines(task, locale).join("\n");
}

const isAuxStage = (stage: AdjustableStage) =>
  stage === "traffic" || stage === "atv" || stage === "buyout" || stage === "upt";

/**
 * Развёрнутые строки как на референсе-списке: «Checkout: 10,0% to step conversion», «Buyout %: +7,0 п.п.».
 */
function oneImpactCeoVerbose(
  stage: AdjustableStage | undefined,
  type: ImpactType | undefined,
  value: number,
  locale: Locale,
): string {
  if (!stage || !type) return "";
  const stageLabel = getStageLabels(locale)[stage];

  if (type === "relative_percent") {
    const pct = formatPercentForLocale(value, 1, locale);
    if (isAuxStage(stage)) {
      return `${stageLabel}: ${pct}`;
    }
    const suffix = locale === "ru" ? "к конверсии шага" : "to step conversion";
    return `${stageLabel}: ${pct} ${suffix}`;
  }

  if (type === "absolute_pp") {
    const loc = numLocale(locale);
    const n = new Intl.NumberFormat(loc, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(value) * 100);
    const sign = value >= 0 ? "+" : "−";
    const pp = locale === "ru" ? "п.п." : "p.p.";
    const body = `${sign}${n} ${pp}`;
    if (isAuxStage(stage)) {
      return `${stageLabel}: ${body}`;
    }
    const suffix = locale === "ru" ? "к конверсии шага" : "to step conversion";
    return `${stageLabel}: ${body} ${suffix}`;
  }

  const sign = value >= 0 ? "+" : "−";
  const n = new Intl.NumberFormat(numLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${stageLabel}: ${sign}${n}`;
}

export function formatTaskImpactCeoVerboseLines(task: Task, locale: Locale): string[] {
  const first = oneImpactCeoVerbose(task.stage1, task.impact1Type, task.impact1Value, locale);
  const second =
    task.stage2 && task.impact2Type
      ? oneImpactCeoVerbose(task.stage2, task.impact2Type, task.impact2Value, locale)
      : "";
  return [first, second].filter(Boolean);
}

export function formatTaskImpactCeoVerboseSummary(task: Task, locale: Locale): string {
  return formatTaskImpactCeoVerboseLines(task, locale).join("\n");
}
