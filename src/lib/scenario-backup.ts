import * as XLSX from "xlsx";

import { isPreBacklogStatus, withInitiativeDefaults } from "@/lib/initiative";
import { getText } from "@/lib/i18n";
import {
  buildTaskImportWorkbook,
  parseTaskImportWorkbook,
  TASK_TEMPLATE_COLUMN_WIDTHS,
  tasksToTemplateExportRows,
} from "@/lib/task-template";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import { emptyPMData, emptyPhases } from "@/store/pm-store";
import {
  BaselineInput,
  Locale,
  PHASE_LIST,
  PhaseName,
  PhaseStatus,
  Task,
  TaskPMData,
  TimelineMode,
} from "@/lib/types";

const SCENARIO_SHEET_NAME: Record<Locale, string> = {
  ru: "Сценарий",
  en: "Scenario",
};

const BASELINE_SHEET_NAME: Record<Locale, string> = {
  ru: "База сценария",
  en: "Scenario baseline",
};

const IDEAS_SHEET_NAME: Record<Locale, string> = {
  ru: "Идеи",
  en: "Ideas",
};

/** Лист PM одинаково для RU/EN — проще искать при ручном просмотре файла. */
const PM_SHEET_NAME = "PM";

const SCENARIO_BACKUP_VERSION = 5;

const PHASE_STATUS_SET = new Set<PhaseStatus>([
  "not_started",
  "in_progress",
  "done",
  "blocked",
  "skipped",
]);

const parsePhaseStatus = (raw: unknown): PhaseStatus => {
  const s = String(raw ?? "").trim() as PhaseStatus;
  return PHASE_STATUS_SET.has(s) ? s : "not_started";
};

const parseBool01 = (raw: unknown): boolean => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "да") return true;
  return false;
};

const pmRowToSheetRow = (taskId: string, pm: TaskPMData): Record<string, string | number> => {
  const row: Record<string, string | number> = {
    task_id: taskId,
    start_date: pm.startDate,
    end_date: pm.endDate,
    manager: pm.manager,
    manager_gj: pm.managerGJ,
    blocker: pm.blocker,
    needs_ab_test: pm.needsAbTest ? 1 : 0,
    dev_cost_hours: pm.devCostHours,
    adjacent_systems: pm.adjacentSystems,
    pm_comment: pm.pmComment,
    jira_epic_url: pm.jiraEpicUrl,
  };
  for (const ph of PHASE_LIST) {
    row[`phase_${ph}`] = pm.phases[ph];
  }
  return row;
};

const parsePmSheetRows = (rows: Record<string, unknown>[]): Record<string, TaskPMData> => {
  const out: Record<string, TaskPMData> = {};
  for (const raw of rows) {
    const taskId = String(raw.task_id ?? raw.taskId ?? "").trim();
    if (!taskId) continue;

    const phases: Record<PhaseName, PhaseStatus> = { ...emptyPhases() };
    for (const ph of PHASE_LIST) {
      const key = `phase_${ph}`;
      phases[ph] = parsePhaseStatus(raw[key]);
    }

    const devH = parseNumber(raw.dev_cost_hours);
    out[taskId] = {
      ...emptyPMData(),
      startDate: String(raw.start_date ?? "").trim(),
      endDate: String(raw.end_date ?? "").trim(),
      manager: String(raw.manager ?? "").trim(),
      managerGJ: String(raw.manager_gj ?? raw.managerGJ ?? "").trim(),
      blocker: String(raw.blocker ?? "").trim(),
      needsAbTest: parseBool01(raw.needs_ab_test),
      devCostHours: devH !== null && devH >= 0 ? devH : 0,
      adjacentSystems: String(raw.adjacent_systems ?? "").trim(),
      pmComment: String(raw.pm_comment ?? "").trim(),
      jiraEpicUrl: String(raw.jira_epic_url ?? "").trim(),
      phases,
    };
  }
  return out;
};

/** PM-строки только для id из списка задач; лишние ключи из файла отбрасываются. */
export const mergePmDataForImportedTasks = (
  tasks: Task[],
  importedPm: Record<string, TaskPMData>,
): Record<string, TaskPMData> => {
  const ids = new Set(tasks.map((t) => t.id));
  const out: Record<string, TaskPMData> = {};
  for (const id of ids) {
    const row = importedPm[id];
    out[id] = row
      ? {
          ...emptyPMData(),
          ...row,
          phases: { ...emptyPhases(), ...row.phases },
        }
      : emptyPMData();
  }
  return out;
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
  ideas = [],
  trafficChangePercent,
  timelineMode = "plan",
  pmData = {},
}: {
  locale: Locale;
  baseline: BaselineInput;
  tasks: Task[];
  ideas?: Task[];
  trafficChangePercent: number;
  timelineMode?: TimelineMode;
  pmData?: Record<string, TaskPMData>;
}) => {
  const workbook = XLSX.utils.book_new();
  const taskWorkbook = buildTaskImportWorkbook({ locale, tasks });

  const scenarioSheet = XLSX.utils.json_to_sheet([
    {
      version: SCENARIO_BACKUP_VERSION,
      locale,
      trafficChangePercent,
      timelineMode,
      tasksCount: tasks.length,
      ideasCount: ideas.length,
    },
  ]);

  const sw = normalizeSeasonalityWeights(baseline.seasonalityWeights);
  const baselineRow: Record<string, string | number> = {
    sessions: baseline.sessions,
    catalogCr: baseline.catalogCr,
    pdpCr: baseline.pdpCr,
    atcCr: baseline.atcCr,
    checkoutCr: baseline.checkoutCr,
    orderCr: baseline.orderCr,
    buyoutRate: baseline.buyoutRate,
    atv: baseline.atv,
    upt: baseline.upt,
  };
  for (let i = 0; i < 12; i++) {
    baselineRow[`seasonality_${i + 1}`] = Math.round(sw[i] * 10000) / 100;
  }

  const baselineSheet = XLSX.utils.json_to_sheet([baselineRow]);

  scenarioSheet["!cols"] = [12, 12, 22, 12].map((width) => ({ wch: width }));
  baselineSheet["!cols"] = Array.from({ length: 21 }, () => ({ wch: 10 }));

  XLSX.utils.book_append_sheet(workbook, scenarioSheet, SCENARIO_SHEET_NAME[locale]);
  XLSX.utils.book_append_sheet(workbook, baselineSheet, BASELINE_SHEET_NAME[locale]);

  taskWorkbook.SheetNames.forEach((sheetName) => {
    XLSX.utils.book_append_sheet(workbook, taskWorkbook.Sheets[sheetName], sheetName);
  });

  if (ideas.length > 0) {
    const ideasSheet = XLSX.utils.json_to_sheet(tasksToTemplateExportRows(ideas));
    ideasSheet["!cols"] = TASK_TEMPLATE_COLUMN_WIDTHS.map((width) => ({ wch: width }));
    XLSX.utils.book_append_sheet(workbook, ideasSheet, IDEAS_SHEET_NAME[locale]);
  }

  if (tasks.length > 0) {
    const pmRows = tasks.map((t) => pmRowToSheetRow(t.id, pmData[t.id] ?? emptyPMData()));
    const pmSheet = XLSX.utils.json_to_sheet(pmRows);
    pmSheet["!cols"] = [
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 28 },
      { wch: 36 },
      ...PHASE_LIST.map(() => ({ wch: 12 })),
    ];
    XLSX.utils.book_append_sheet(workbook, pmSheet, PM_SHEET_NAME);
  }

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
  ideas: Task[];
  trafficChangePercent: number;
  timelineMode: TimelineMode;
  pmData: Record<string, TaskPMData>;
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
  const timelineRaw = String(scenarioRow.timelineMode ?? "").trim();
  const timelineMode: TimelineMode =
    timelineRaw === "dev_committed" ? "dev_committed" : "plan";

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

  const rawSeason: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const p = parseNumber(baselineRow[`seasonality_${i}`]);
    rawSeason.push(p !== null && p > 0 ? p : 0);
  }
  const hasSeasonCols = rawSeason.some((v) => v > 0);

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
    seasonalityWeights: normalizeSeasonalityWeights(hasSeasonCols ? rawSeason : undefined),
  };

  const numericCheck = (
    ["sessions", "catalogCr", "pdpCr", "atcCr", "checkoutCr", "orderCr", "buyoutRate", "atv", "upt"] as const
  ).map((k) => baseline[k]);

  if (numericCheck.some((value) => !Number.isFinite(value))) {
    throw new Error(
      locale === "ru"
        ? "Не удалось прочитать базу сценария из файла."
        : "Failed to read scenario baseline from the file.",
    );
  }

  const { tasks } = parseTaskImportWorkbook(file, locale);

  const ideasPreferred = [IDEAS_SHEET_NAME.ru, IDEAS_SHEET_NAME.en];
  const ideasSheetName = ideasPreferred.find((name) => workbook.SheetNames.includes(name));
  let ideas: Task[] = [];
  if (ideasSheetName) {
    const parsedIdeas = parseTaskImportWorkbook(file, locale, { sheetName: ideasSheetName });
    ideas = parsedIdeas.tasks.map((t) => {
      const normalized = withInitiativeDefaults(t);
      return {
        ...normalized,
        initiativeStatus: isPreBacklogStatus(normalized.initiativeStatus)
          ? normalized.initiativeStatus
          : "hypothesis",
      };
    });
  }

  let importedPm: Record<string, TaskPMData> = {};
  if (workbook.SheetNames.includes(PM_SHEET_NAME)) {
    const pmRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[PM_SHEET_NAME],
      { defval: "", raw: false },
    );
    importedPm = parsePmSheetRows(pmRows);
  }

  return {
    locale,
    baseline,
    tasks,
    ideas,
    trafficChangePercent,
    timelineMode,
    pmData: mergePmDataForImportedTasks(tasks, importedPm),
  };
};
