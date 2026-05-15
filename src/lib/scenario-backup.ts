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
  PlanYear,
  PhaseName,
  PhaseStatus,
  SharedRoadmapPayload,
  Task,
  TaskPMData,
  TimelineMode,
  YearPlan,
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
const MULTI_YEAR_SHEET_NAME = "MultiYear";

const SCENARIO_BACKUP_VERSION = 6;

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
  activeYear = 2026,
  yearPlans,
  baseline,
  tasks,
  ideas = [],
  trafficChangePercent,
  timelineMode = "plan",
  pmData = {},
  pmDataByYear,
}: {
  locale: Locale;
  activeYear?: PlanYear;
  yearPlans?: Record<PlanYear, YearPlan>;
  baseline: BaselineInput;
  tasks: Task[];
  ideas?: Task[];
  trafficChangePercent: number;
  timelineMode?: TimelineMode;
  pmData?: Record<string, TaskPMData>;
  pmDataByYear?: Record<PlanYear, Record<string, TaskPMData>>;
}) => {
  const workbook = XLSX.utils.book_new();
  const taskWorkbook = buildTaskImportWorkbook({ locale, tasks });
  const payload: SharedRoadmapPayload = {
    activeYear,
    sharedIdeas: ideas,
    yearPlans: {
      2026: {
        ...(yearPlans?.[2026] ?? {
          baseline,
          tasks,
          trafficChangePercent,
          timelineMode,
          pmData,
        }),
        pmData: pmDataByYear?.[2026] ?? yearPlans?.[2026]?.pmData ?? (activeYear === 2026 ? pmData : {}),
      },
      2027: {
        ...(yearPlans?.[2027] ?? {
          baseline,
          tasks: [],
          trafficChangePercent: 0,
          timelineMode: "plan" as TimelineMode,
          pmData: {},
        }),
        pmData: pmDataByYear?.[2027] ?? yearPlans?.[2027]?.pmData ?? (activeYear === 2027 ? pmData : {}),
      },
    },
    locale,
    _writeMode: "full",
  };

  const scenarioSheet = XLSX.utils.json_to_sheet([
    {
      version: SCENARIO_BACKUP_VERSION,
      locale,
      activeYear,
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
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{ payload_json: JSON.stringify(payload) }]),
    MULTI_YEAR_SHEET_NAME,
  );

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
  activeYear: PlanYear;
  yearPlans: Record<PlanYear, YearPlan>;
  locale: Locale;
  baseline: BaselineInput;
  tasks: Task[];
  ideas: Task[];
  trafficChangePercent: number;
  timelineMode: TimelineMode;
  pmData: Record<string, TaskPMData>;
} => {
  const workbook = XLSX.read(file, { type: "array" });
  if (workbook.SheetNames.includes(MULTI_YEAR_SHEET_NAME)) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[MULTI_YEAR_SHEET_NAME],
      { defval: "", raw: false },
    );
    const payloadJson = String(rows[0]?.payload_json ?? "").trim();
    if (payloadJson) {
      const parsed = JSON.parse(payloadJson) as SharedRoadmapPayload;
      const activeYear: PlanYear = parsed.activeYear === 2027 ? 2027 : 2026;
      const normalizePlan = (plan: YearPlan | undefined): YearPlan => ({
        baseline: {
          ...(plan?.baseline ?? {
            sessions: 0,
            catalogCr: 0,
            pdpCr: 0,
            atcCr: 0,
            checkoutCr: 0,
            orderCr: 0,
            buyoutRate: 0,
            atv: 0,
            upt: 0,
            seasonalityWeights: undefined,
          }),
          seasonalityWeights: normalizeSeasonalityWeights(plan?.baseline.seasonalityWeights),
        },
        tasks: (plan?.tasks ?? []).map((t) => withInitiativeDefaults(t)),
        trafficChangePercent: plan?.trafficChangePercent ?? 0,
        timelineMode: plan?.timelineMode === "dev_committed" ? "dev_committed" : "plan",
        pmData: mergePmDataForImportedTasks(plan?.tasks ?? [], plan?.pmData ?? {}),
      });
      const yearPlans: Record<PlanYear, YearPlan> = {
        2026: normalizePlan(parsed.yearPlans[2026]),
        2027: normalizePlan(parsed.yearPlans[2027]),
      };
      return {
        activeYear,
        yearPlans,
        locale: parsed.locale ?? fallbackLocale,
        baseline: yearPlans[activeYear].baseline,
        tasks: yearPlans[activeYear].tasks,
        ideas: (parsed.sharedIdeas ?? []).map((t) => withInitiativeDefaults(t)),
        trafficChangePercent: yearPlans[activeYear].trafficChangePercent,
        timelineMode: yearPlans[activeYear].timelineMode ?? "plan",
        pmData: yearPlans[activeYear].pmData,
      };
    }
  }

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
  const activeYear: PlanYear = String(scenarioRow.activeYear ?? "").trim() === "2027" ? 2027 : 2026;
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

  const activeYearPlan: YearPlan = {
    baseline,
    tasks,
    trafficChangePercent,
    timelineMode,
    pmData: mergePmDataForImportedTasks(tasks, importedPm),
  };
  const yearPlans: Record<PlanYear, YearPlan> = {
    2026: activeYear === 2026 ? activeYearPlan : {
      baseline,
      tasks: [],
      trafficChangePercent: 0,
      timelineMode: "plan",
      pmData: {},
    },
    2027: activeYear === 2027 ? activeYearPlan : {
      baseline,
      tasks: [],
      trafficChangePercent: 0,
      timelineMode: "plan",
      pmData: {},
    },
  };

  return {
    activeYear,
    yearPlans,
    locale,
    baseline,
    tasks,
    ideas,
    trafficChangePercent,
    timelineMode,
    pmData: activeYearPlan.pmData,
  };
};
