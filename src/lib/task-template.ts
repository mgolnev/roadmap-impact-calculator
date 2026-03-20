import * as XLSX from "xlsx";

import { getImpactTypeLabels, getMonthLabel, getPriorityLabels, getStageLabels, getText, IMPACT_TYPE_LABELS, MONTH_LABELS, PRIORITY_LABELS, STAGE_LABELS } from "@/lib/i18n";
import {
  normalizeConfidence,
  normalizeEffort,
  normalizeImpactCategory,
  normalizeInitiativeStatus,
  withInitiativeDefaults,
} from "@/lib/initiative";
import { AdjustableStage, ImpactType, Locale, Priority, Task } from "@/lib/types";

const TEMPLATE_SHEET_NAME: Record<Locale, string> = {
  ru: "Шаблон задач",
  en: "Task template",
};

const GUIDE_SHEET_NAME: Record<Locale, string> = {
  ru: "Как заполнять",
  en: "How to fill",
};

const REFERENCE_SHEET_NAME: Record<Locale, string> = {
  ru: "Справочники",
  en: "Reference",
};

const HEADER_KEYS = [
  "active",
  "project",
  "taskName",
  "initiativeStatus",
  "description",
  "problemStatement",
  "impactCategory",
  "confidence",
  "effort",
  "priority",
  "stage1",
  "impact1Type",
  "impact1Value",
  "stage2",
  "impact2Type",
  "impact2Value",
  "releaseMonth",
  "comment",
] as const;

type TemplateHeaderKey = (typeof HEADER_KEYS)[number];

const HEADER_LABELS: Record<Locale, Record<TemplateHeaderKey, string>> = {
  ru: {
    active: "active",
    project: "project",
    taskName: "task_name",
    initiativeStatus: "initiative_status",
    description: "description",
    problemStatement: "problem_statement",
    impactCategory: "impact_category",
    confidence: "confidence",
    effort: "effort",
    priority: "priority",
    stage1: "stage_1",
    impact1Type: "impact_1_type",
    impact1Value: "impact_1_value",
    stage2: "stage_2",
    impact2Type: "impact_2_type",
    impact2Value: "impact_2_value",
    releaseMonth: "release_month",
    comment: "comment",
  },
  en: {
    active: "active",
    project: "project",
    taskName: "task_name",
    initiativeStatus: "initiative_status",
    description: "description",
    problemStatement: "problem_statement",
    impactCategory: "impact_category",
    confidence: "confidence",
    effort: "effort",
    priority: "priority",
    stage1: "stage_1",
    impact1Type: "impact_1_type",
    impact1Value: "impact_1_value",
    stage2: "stage_2",
    impact2Type: "impact_2_type",
    impact2Value: "impact_2_value",
    releaseMonth: "release_month",
    comment: "comment",
  },
};

const HEADER_ALIASES: Record<TemplateHeaderKey, string[]> = {
  active: ["active", "enabled", "on", "вкл", "включена"],
  project: ["project", "проект"],
  taskName: ["taskname", "task_name", "task", "задача", "task name"],
  initiativeStatus: ["initiativestatus", "initiative_status", "статусинициативы", "status"],
  description: ["description", "описание"],
  problemStatement: ["problemstatement", "problem_statement", "проблема", "problem"],
  impactCategory: ["impactcategory", "impact_category", "типвлияния", "productimpact"],
  confidence: ["confidence", "уверенность"],
  effort: ["effort", "efforts", "размер"],
  priority: ["priority", "prioritet", "приоритет"],
  stage1: ["stage1", "stage_1", "primaryimpactstage", "основнойэтап", "основное влияние"],
  impact1Type: ["impact1type", "impact_1_type", "primaryimpacttype", "основнойтип", "тип1"],
  impact1Value: ["impact1value", "impact_1_value", "primaryimpactvalue", "основноезначение", "значение1"],
  stage2: ["stage2", "stage_2", "secondaryimpactstage", "допэтап", "доп влияние"],
  impact2Type: ["impact2type", "impact_2_type", "secondaryimpacttype", "доптип", "тип2"],
  impact2Value: ["impact2value", "impact_2_value", "secondaryimpactvalue", "допзначение", "значение2"],
  releaseMonth: ["releasemonth", "release_month", "month", "месяцрелиза", "стартэффекта"],
  comment: ["comment", "notes", "комментарий", "гипотеза"],
};

const PRIORITY_ALIASES: Record<Priority, string[]> = {
  p1: ["p1", "high", "highest", "major", "высокий", "высокийприоритет"],
  p2: ["p2", "medium", "med", "normal", "средний", "среднийприоритет"],
  p3: ["p3", "low", "minor", "низкий", "низкийприоритет"],
};

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\s./\\()%+-]+/g, "")
    .replace(/_/g, "");

const formatTemplateImpactValue = (type: ImpactType | undefined, value: number) => {
  if (type === "relative_percent" || type === "absolute_pp") {
    return value * 100;
  }

  return value;
};

const parseDecimal = (value: string) => {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseBoolean = (value: string) => {
  const normalized = normalizeToken(value);

  if (!normalized) {
    return true;
  }

  if (["true", "1", "yes", "y", "да", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "нет", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

const parseMonth = (value: string) => {
  const numeric = parseDecimal(value);
  if (numeric !== null && numeric >= 1 && numeric <= 12) {
    return Math.round(numeric);
  }

  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }

  for (let index = 0; index < 12; index += 1) {
    if (normalizeToken(MONTH_LABELS.ru[index]) === normalized || normalizeToken(MONTH_LABELS.en[index]) === normalized) {
      return index + 1;
    }
  }

  return null;
};

const STAGE_CODE_LIST = Object.keys(STAGE_LABELS.ru) as AdjustableStage[];
const IMPACT_TYPE_CODE_LIST = Object.keys(IMPACT_TYPE_LABELS.ru) as ImpactType[];
const PRIORITY_CODE_LIST = Object.keys(PRIORITY_LABELS.ru) as Priority[];

const parseStage = (value: string) => {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return undefined;
  }

  for (const stage of STAGE_CODE_LIST) {
    if (
      normalizeToken(stage) === normalized ||
      normalizeToken(STAGE_LABELS.ru[stage]) === normalized ||
      normalizeToken(STAGE_LABELS.en[stage]) === normalized
    ) {
      return stage;
    }
  }

  return null;
};

const parseImpactType = (value: string) => {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return undefined;
  }

  for (const type of IMPACT_TYPE_CODE_LIST) {
    if (
      normalizeToken(type) === normalized ||
      normalizeToken(IMPACT_TYPE_LABELS.ru[type]) === normalized ||
      normalizeToken(IMPACT_TYPE_LABELS.en[type]) === normalized
    ) {
      return type;
    }
  }

  return null;
};

const parsePriority = (value: string) => {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return "p2" as Priority;
  }

  for (const priority of PRIORITY_CODE_LIST) {
    if (
      normalizeToken(priority) === normalized ||
      PRIORITY_ALIASES[priority].includes(normalized) ||
      normalizeToken(PRIORITY_LABELS.ru[priority]) === normalized ||
      normalizeToken(PRIORITY_LABELS.en[priority]) === normalized
    ) {
      return priority;
    }
  }

  return null;
};

const parseImpactValue = (rawValue: string, type: ImpactType | undefined) => {
  if (!type) {
    return 0;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return 0;
  }

  const numeric = parseDecimal(trimmed);
  if (numeric === null) {
    return null;
  }

  if (type === "absolute_value") {
    return numeric;
  }

  if (trimmed.includes("%")) {
    return numeric / 100;
  }

  return numeric / 100;
};

const getColumnMap = (headerRow: string[]) => {
  const mapped = new Map<TemplateHeaderKey, number>();

  headerRow.forEach((header, index) => {
    const normalized = normalizeToken(String(header));

    for (const key of HEADER_KEYS) {
      if (HEADER_ALIASES[key].includes(normalized) || normalizeToken(HEADER_LABELS.ru[key]) === normalized) {
        mapped.set(key, index);
      }
    }
  });

  return mapped;
};

const cellValue = (row: unknown[], columnMap: Map<TemplateHeaderKey, number>, key: TemplateHeaderKey) => {
  const index = columnMap.get(key);
  if (index === undefined) {
    return "";
  }

  return String(row[index] ?? "").trim();
};

const isRowEmpty = (row: unknown[]) => row.every((cell) => String(cell ?? "").trim() === "");

const buildImportRow = (task: Task) => ({
  active: task.active,
  project: task.project,
  task_name: task.taskName,
  initiative_status: task.initiativeStatus,
  description: task.description,
  problem_statement: task.problemStatement,
  impact_category: task.impactCategory,
  confidence: task.confidence,
  effort: task.effort,
  priority: task.priority,
  stage_1: task.stage1 ?? "",
  impact_1_type: task.impact1Type ?? "",
  impact_1_value: formatTemplateImpactValue(task.impact1Type, task.impact1Value),
  stage_2: task.stage2 ?? "",
  impact_2_type: task.impact2Type ?? "",
  impact_2_value: formatTemplateImpactValue(task.impact2Type, task.impact2Value),
  release_month: task.releaseMonth,
  comment: task.comment,
});

export const tasksToTemplateExportRows = (tasks: Task[]) => tasks.map(buildImportRow);

const buildGuideRows = (locale: Locale) => {
  if (locale === "ru") {
    return [
      {
        field: "active",
        required: "нет",
        description: "Включать ли задачу после импорта",
        format: "TRUE / FALSE, 1 / 0, Да / Нет",
        example: "TRUE",
      },
      {
        field: "project",
        required: "да",
        description: "Название проекта или направления",
        format: "текст",
        example: "New Checkout",
      },
      {
        field: "task_name",
        required: "да",
        description: "Название задачи",
        format: "текст",
        example: "Checkout Redesign",
      },
      {
        field: "priority",
        required: "нет",
        description: "Управленческий приоритет задачи",
        format: "p1 / p2 / p3",
        example: "p1",
      },
      {
        field: "stage_1",
        required: "да",
        description: "Первый этап влияния",
        format: "используйте коды из листа Справочники",
        example: "order",
      },
      {
        field: "impact_1_type",
        required: "да",
        description: "Тип первого влияния",
        format: "используйте коды из листа Справочники",
        example: "relative_percent",
      },
      {
        field: "impact_1_value",
        required: "да",
        description: "Значение первого влияния",
        format: "для % и п.п. вводите число как в Excel: 15 = 15%, 2 = 2 п.п.; для absolute_value вводите абсолютное число",
        example: "15",
      },
      {
        field: "stage_2 / impact_2_type / impact_2_value",
        required: "нет",
        description: "Второе влияние задачи",
        format: "заполняется по тем же правилам, что и первое",
        example: "atv / relative_percent / 5",
      },
      {
        field: "release_month",
        required: "да",
        description: "Месяц, с которого задача начинает влиять",
        format: "число от 1 до 12",
        example: "4",
      },
      {
        field: "comment",
        required: "нет",
        description: "Комментарий, гипотеза или источник оценки",
        format: "текст",
        example: "Оценка из продуктовой гипотезы",
      },
      {
        field: "Важно",
        required: "-",
        description: "Импорт заменяет текущий список задач в сервисе новым списком из файла",
        format: "-",
        example: "-",
      },
    ];
  }

  return [
    {
      field: "active",
      required: "no",
      description: "Whether the task should stay enabled after import",
      format: "TRUE / FALSE, 1 / 0, Yes / No",
      example: "TRUE",
    },
    {
      field: "project",
      required: "yes",
      description: "Project or stream name",
      format: "text",
      example: "New Checkout",
    },
    {
      field: "task_name",
      required: "yes",
      description: "Task name",
      format: "text",
      example: "Checkout Redesign",
    },
    {
      field: "priority",
      required: "no",
      description: "Manual task priority",
      format: "p1 / p2 / p3",
      example: "p1",
    },
    {
      field: "stage_1",
      required: "yes",
      description: "Primary impact stage",
      format: "use codes from the Reference sheet",
      example: "order",
    },
    {
      field: "impact_1_type",
      required: "yes",
      description: "Primary impact type",
      format: "use codes from the Reference sheet",
      example: "relative_percent",
    },
    {
      field: "impact_1_value",
      required: "yes",
      description: "Primary impact value",
      format: "for % and p.p., use whole numbers: 15 = 15%, 2 = 2 p.p.; for absolute_value use the raw amount",
      example: "15",
    },
    {
      field: "stage_2 / impact_2_type / impact_2_value",
      required: "no",
      description: "Secondary impact of the task",
      format: "same rules as the primary impact",
      example: "atv / relative_percent / 5",
    },
    {
      field: "release_month",
      required: "yes",
      description: "Month when the task starts affecting the model",
      format: "number from 1 to 12",
      example: "4",
    },
    {
      field: "comment",
      required: "no",
      description: "Comment, assumption, or source",
      format: "text",
      example: "Estimated from product hypothesis",
    },
    {
      field: "Important",
      required: "-",
      description: "Import replaces the current task list in the service with the new list from the file",
      format: "-",
      example: "-",
    },
  ];
};

const buildReferenceRows = (locale: Locale) => {
  const stageLabels = getStageLabels(locale);
  const impactLabels = getImpactTypeLabels(locale);
  const priorityLabels = getPriorityLabels(locale);

  return [
    ...STAGE_CODE_LIST.map((stage) => ({
      group: locale === "ru" ? "stage code" : "stage code",
      code: stage,
      label: stageLabels[stage],
      note: locale === "ru" ? "Этап влияния" : "Impact stage",
    })),
    ...IMPACT_TYPE_CODE_LIST.map((type) => ({
      group: locale === "ru" ? "impact type" : "impact type",
      code: type,
      label: impactLabels[type],
      note:
        type === "relative_percent"
          ? locale === "ru"
            ? "15 = 15%"
            : "15 = 15%"
          : type === "absolute_pp"
            ? locale === "ru"
              ? "2 = 2 п.п."
              : "2 = 2 p.p."
            : locale === "ru"
              ? "Абсолютное значение"
              : "Absolute value",
    })),
    ...PRIORITY_CODE_LIST.map((priority) => ({
      group: locale === "ru" ? "priority" : "priority",
      code: priority,
      label: priorityLabels[priority],
      note: locale === "ru" ? "Ручной приоритет" : "Manual priority",
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      group: locale === "ru" ? "month" : "month",
      code: String(index + 1),
      label: getMonthLabel(locale, index + 1),
      note: locale === "ru" ? "Месяц релиза" : "Release month",
    })),
  ];
};

const applyColumnWidths = (sheet: XLSX.WorkSheet, widths: number[]) => {
  sheet["!cols"] = widths.map((width) => ({ wch: width }));
};

/** Ширины колонок листа шаблона задач (roadmap / идеи). */
export const TASK_TEMPLATE_COLUMN_WIDTHS = [
  10, 20, 28, 24, 28, 28, 18, 12, 8, 14, 16, 20, 16, 16, 20, 16, 14, 40,
];

export const buildTaskImportWorkbook = ({
  locale,
  tasks,
}: {
  locale: Locale;
  tasks: Task[];
}) => {
  const workbook = XLSX.utils.book_new();
  const text = getText(locale);
  const templateRows = (tasks.length > 0 ? tasks : [
    withInitiativeDefaults({
      id: "template",
      active: true,
      project: locale === "ru" ? "Новый проект" : "New project",
      taskName: locale === "ru" ? "Новая задача" : "New task",
      priority: "p2",
      stage1: "order",
      impact1Type: "relative_percent",
      impact1Value: 0.1,
      stage2: undefined,
      impact2Type: undefined,
      impact2Value: 0,
      releaseMonth: 4,
      comment: locale === "ru" ? "Пример строки" : "Example row",
    } as Task),
  ]).map(buildImportRow);

  const templateSheet = XLSX.utils.json_to_sheet(templateRows);
  const guideSheet = XLSX.utils.json_to_sheet(buildGuideRows(locale));
  const referenceSheet = XLSX.utils.json_to_sheet(buildReferenceRows(locale));

  applyColumnWidths(templateSheet, TASK_TEMPLATE_COLUMN_WIDTHS);
  applyColumnWidths(guideSheet, [28, 12, 70, 60, 28]);
  applyColumnWidths(referenceSheet, [16, 22, 28, 28]);

  XLSX.utils.book_append_sheet(workbook, templateSheet, TEMPLATE_SHEET_NAME[locale]);
  XLSX.utils.book_append_sheet(workbook, guideSheet, GUIDE_SHEET_NAME[locale]);
  XLSX.utils.book_append_sheet(workbook, referenceSheet, REFERENCE_SHEET_NAME[locale]);

  workbook.Props = {
    Title: locale === "ru" ? "Шаблон импорта задач roadmap" : "Roadmap task import template",
    Subject: text.tasksTitle,
  };

  return workbook;
};

export const parseTaskImportWorkbook = (
  file: ArrayBuffer,
  locale: Locale,
  options?: { sheetName?: string },
): { tasks: Task[]; warnings: string[] } => {
  const workbook = XLSX.read(file, { type: "array" });
  const preferredNames = [
    TEMPLATE_SHEET_NAME.ru,
    TEMPLATE_SHEET_NAME.en,
    locale === "ru" ? "Задачи" : "Tasks",
  ];
  const sheetName =
    options?.sheetName ??
    preferredNames.find((name) => workbook.SheetNames.includes(name)) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(locale === "ru" ? "В файле не найден ни один лист." : "No sheets found in the file.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const firstNonEmptyRow = rows.findIndex((row) => !isRowEmpty(row));

  if (firstNonEmptyRow === -1) {
    throw new Error(locale === "ru" ? "Лист с задачами пустой." : "The task sheet is empty.");
  }

  const headerRow = rows[firstNonEmptyRow].map((cell) => String(cell ?? ""));
  const columnMap = getColumnMap(headerRow);
  const requiredColumns: TemplateHeaderKey[] = ["project", "taskName", "stage1", "impact1Type", "impact1Value", "releaseMonth"];
  const missingColumns = requiredColumns.filter((column) => !columnMap.has(column));

  if (missingColumns.length > 0) {
    throw new Error(
      locale === "ru"
        ? `В шаблоне не хватает колонок: ${missingColumns.join(", ")}`
        : `Missing required columns in the template: ${missingColumns.join(", ")}`,
    );
  }

  const tasks: Task[] = [];
  const errors: string[] = [];

  rows.slice(firstNonEmptyRow + 1).forEach((row, rowIndex) => {
    if (isRowEmpty(row)) {
      return;
    }

    const lineNumber = firstNonEmptyRow + rowIndex + 2;
    const project = cellValue(row, columnMap, "project");
    const taskName = cellValue(row, columnMap, "taskName");
    const priorityRaw = cellValue(row, columnMap, "priority");
    const stage1Raw = cellValue(row, columnMap, "stage1");
    const impact1TypeRaw = cellValue(row, columnMap, "impact1Type");
    const impact1ValueRaw = cellValue(row, columnMap, "impact1Value");
    const stage2Raw = cellValue(row, columnMap, "stage2");
    const impact2TypeRaw = cellValue(row, columnMap, "impact2Type");
    const impact2ValueRaw = cellValue(row, columnMap, "impact2Value");
    const releaseMonthRaw = cellValue(row, columnMap, "releaseMonth");
    const activeRaw = cellValue(row, columnMap, "active");
    const comment = cellValue(row, columnMap, "comment");

    if (!taskName) {
      errors.push(locale === "ru" ? `Строка ${lineNumber}: не заполнено task_name.` : `Row ${lineNumber}: task_name is required.`);
      return;
    }

    const priority = parsePriority(priorityRaw);
    if (priority === null) {
      errors.push(locale === "ru" ? `Строка ${lineNumber}: неверный priority.` : `Row ${lineNumber}: invalid priority.`);
      return;
    }

    const stage1 = parseStage(stage1Raw);
    if (stage1 === null || stage1 === undefined) {
      errors.push(locale === "ru" ? `Строка ${lineNumber}: неверный stage_1.` : `Row ${lineNumber}: invalid stage_1.`);
      return;
    }

    const impact1Type = parseImpactType(impact1TypeRaw);
    if (impact1Type === null || impact1Type === undefined) {
      errors.push(
        locale === "ru"
          ? `Строка ${lineNumber}: неверный impact_1_type.`
          : `Row ${lineNumber}: invalid impact_1_type.`,
      );
      return;
    }

    const impact1Value = parseImpactValue(impact1ValueRaw, impact1Type);
    if (impact1Value === null) {
      errors.push(
        locale === "ru"
          ? `Строка ${lineNumber}: неверный impact_1_value.`
          : `Row ${lineNumber}: invalid impact_1_value.`,
      );
      return;
    }

    const stage2 = parseStage(stage2Raw);
    if (stage2 === null) {
      errors.push(locale === "ru" ? `Строка ${lineNumber}: неверный stage_2.` : `Row ${lineNumber}: invalid stage_2.`);
      return;
    }

    const impact2Type = parseImpactType(impact2TypeRaw);
    if (impact2Type === null) {
      errors.push(
        locale === "ru"
          ? `Строка ${lineNumber}: неверный impact_2_type.`
          : `Row ${lineNumber}: invalid impact_2_type.`,
      );
      return;
    }

    if ((stage2 && !impact2Type) || (!stage2 && impact2Type)) {
      errors.push(
        locale === "ru"
          ? `Строка ${lineNumber}: для второго влияния заполните stage_2 и impact_2_type вместе.`
          : `Row ${lineNumber}: stage_2 and impact_2_type must be filled together.`,
      );
      return;
    }

    const impact2Value = parseImpactValue(impact2ValueRaw, impact2Type);
    if (impact2Value === null) {
      errors.push(
        locale === "ru"
          ? `Строка ${lineNumber}: неверный impact_2_value.`
          : `Row ${lineNumber}: invalid impact_2_value.`,
      );
      return;
    }

    const releaseMonth = parseMonth(releaseMonthRaw);
    if (releaseMonth === null) {
      errors.push(
        locale === "ru"
          ? `Строка ${lineNumber}: release_month должен быть числом от 1 до 12.`
          : `Row ${lineNumber}: release_month must be a number from 1 to 12.`,
      );
      return;
    }

    const active = parseBoolean(activeRaw);
    if (active === null) {
      errors.push(locale === "ru" ? `Строка ${lineNumber}: неверное значение active.` : `Row ${lineNumber}: invalid active value.`);
      return;
    }

    tasks.push(
      withInitiativeDefaults({
        id: `task-import-${Date.now()}-${rowIndex}`,
        active,
        project: project || (locale === "ru" ? "Без проекта" : "No project"),
        taskName,
        priority,
        initiativeStatus:
          normalizeInitiativeStatus(cellValue(row, columnMap, "initiativeStatus")) ?? "planned",
        description: cellValue(row, columnMap, "description"),
        problemStatement: cellValue(row, columnMap, "problemStatement"),
        impactCategory:
          normalizeImpactCategory(cellValue(row, columnMap, "impactCategory")) ?? "conversion",
        confidence: normalizeConfidence(cellValue(row, columnMap, "confidence")) ?? "medium",
        effort: normalizeEffort(cellValue(row, columnMap, "effort")) ?? "m",
        stage1,
        impact1Type,
        impact1Value,
        stage2: stage2 ?? undefined,
        impact2Type: impact2Type ?? undefined,
        impact2Value: impact2Type ? impact2Value ?? 0 : 0,
        releaseMonth,
        comment,
      } as Task),
    );
  });

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  if (tasks.length === 0) {
    throw new Error(locale === "ru" ? "В файле нет задач для импорта." : "There are no tasks to import in the file.");
  }

  return { tasks, warnings: [] };
};
