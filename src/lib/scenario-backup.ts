import * as XLSX from "xlsx";

import { getText } from "@/lib/i18n";
import { buildTaskImportWorkbook, parseTaskImportWorkbook } from "@/lib/task-template";
import { BaselineInput, Locale, Task } from "@/lib/types";

const SCENARIO_SHEET_NAME: Record<Locale, string> = {
  ru: "Сценарий",
  en: "Scenario",
};

const BASELINE_SHEET_NAME: Record<Locale, string> = {
  ru: "База сценария",
  en: "Scenario baseline",
};

const parseNumber = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : null;
};

const parseLocale = (value: unknown): Locale | null => {
  if (value === "ru" || value === "en") {
    return value;
  }

  return null;
};

const getScenarioSheet = (workbook: XLSX.WorkBook, locale: Locale) => {
  const preferredNames = [
    SCENARIO_SHEET_NAME.ru,
    SCENARIO_SHEET_NAME.en,
    locale === "ru" ? SCENARIO_SHEET_NAME.ru : SCENARIO_SHEET_NAME.en,
  ];

  return preferredNames.find((name) => workbook.SheetNames.includes(name));
};

const getBaselineSheet = (workbook: XLSX.WorkBook, locale: Locale) => {
  const preferredNames = [
    BASELINE_SHEET_NAME.ru,
    BASELINE_SHEET_NAME.en,
    locale === "ru" ? BASELINE_SHEET_NAME.ru : BASELINE_SHEET_NAME.en,
  ];

  return preferredNames.find((name) => workbook.SheetNames.includes(name));
};

export const buildScenarioBackupWorkbook = ({
  locale,
  baseline,
  tasks,
  trafficChangePercent,
}: {
  locale: Locale;
  baseline: BaselineInput;
  tasks: Task[];
  trafficChangePercent: number;
}) => {
  const workbook = XLSX.utils.book_new();
  const taskWorkbook = buildTaskImportWorkbook({ locale, tasks });

  const scenarioSheet = XLSX.utils.json_to_sheet([
    {
      version: 1,
      locale,
      trafficChangePercent,
      tasksCount: tasks.length,
    },
  ]);

  const baselineSheet = XLSX.utils.json_to_sheet([
    {
      sessions: baseline.sessions,
      catalogCr: baseline.catalogCr,
      pdpCr: baseline.pdpCr,
      atcCr: baseline.atcCr,
      checkoutCr: baseline.checkoutCr,
      orderCr: baseline.orderCr,
      buyoutRate: baseline.buyoutRate,
      atv: baseline.atv,
      upt: baseline.upt,
    },
  ]);

  scenarioSheet["!cols"] = [12, 12, 22, 12].map((width) => ({ wch: width }));
  baselineSheet["!cols"] = [14, 14, 14, 14, 14, 14, 14, 14, 14].map((width) => ({ wch: width }));

  XLSX.utils.book_append_sheet(workbook, scenarioSheet, SCENARIO_SHEET_NAME[locale]);
  XLSX.utils.book_append_sheet(workbook, baselineSheet, BASELINE_SHEET_NAME[locale]);

  taskWorkbook.SheetNames.forEach((sheetName) => {
    XLSX.utils.book_append_sheet(workbook, taskWorkbook.Sheets[sheetName], sheetName);
  });

  workbook.Props = {
    Title: locale === "ru" ? "Бэкап сценария roadmap" : "Roadmap scenario backup",
    Subject: getText(locale).saveScenario,
  };

  return workbook;
};

export const parseScenarioBackupWorkbook = (
  file: ArrayBuffer,
  fallbackLocale: Locale,
): {
  locale: Locale;
  baseline: BaselineInput;
  tasks: Task[];
  trafficChangePercent: number;
} => {
  const workbook = XLSX.read(file, { type: "array" });
  const scenarioSheetName = getScenarioSheet(workbook, fallbackLocale);

  if (!scenarioSheetName) {
    throw new Error(
      fallbackLocale === "ru"
        ? "В файле не найден лист сценария."
        : "Scenario sheet was not found in the file.",
    );
  }

  const scenarioRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[scenarioSheetName],
    { defval: "", raw: false },
  );
  const scenarioRow = scenarioRows[0];

  if (!scenarioRow) {
    throw new Error(
      fallbackLocale === "ru"
        ? "Лист сценария пустой."
        : "Scenario sheet is empty.",
    );
  }

  const locale = parseLocale(scenarioRow.locale) ?? fallbackLocale;
  const trafficChangePercent = parseNumber(scenarioRow.trafficChangePercent);

  if (trafficChangePercent === null) {
    throw new Error(
      locale === "ru"
        ? "Некорректное значение trafficChangePercent в сценарии."
        : "Invalid trafficChangePercent value in the scenario.",
    );
  }

  const baselineSheetName = getBaselineSheet(workbook, locale);

  if (!baselineSheetName) {
    throw new Error(
      locale === "ru"
        ? "В файле не найден лист базы сценария."
        : "Scenario baseline sheet was not found in the file.",
    );
  }

  const baselineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[baselineSheetName],
    { defval: "", raw: false },
  );
  const baselineRow = baselineRows[0];

  if (!baselineRow) {
    throw new Error(
      locale === "ru"
        ? "Лист базы сценария пустой."
        : "Scenario baseline sheet is empty.",
    );
  }

  const baseline: BaselineInput = {
    sessions: parseNumber(baselineRow.sessions) ?? NaN,
    catalogCr: parseNumber(baselineRow.catalogCr) ?? NaN,
    pdpCr: parseNumber(baselineRow.pdpCr) ?? NaN,
    atcCr: parseNumber(baselineRow.atcCr) ?? NaN,
    checkoutCr: parseNumber(baselineRow.checkoutCr) ?? NaN,
    orderCr: parseNumber(baselineRow.orderCr) ?? NaN,
    buyoutRate: parseNumber(baselineRow.buyoutRate) ?? NaN,
    atv: parseNumber(baselineRow.atv) ?? NaN,
    upt: parseNumber(baselineRow.upt) ?? NaN,
  };

  if (Object.values(baseline).some((value) => !Number.isFinite(value))) {
    throw new Error(
      locale === "ru"
        ? "Не удалось прочитать базу сценария из файла."
        : "Failed to read scenario baseline from the file.",
    );
  }

  const { tasks } = parseTaskImportWorkbook(file, locale);

  return {
    locale,
    baseline,
    tasks,
    trafficChangePercent,
  };
};
