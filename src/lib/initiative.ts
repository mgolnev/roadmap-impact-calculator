import {
  InitiativeConfidence,
  InitiativeEffort,
  InitiativeImpactCategory,
  InitiativeStatus,
  Task,
} from "@/lib/types";

export const PRE_BACKLOG_STATUSES: InitiativeStatus[] = ["draft", "hypothesis"];
export const ROADMAP_STATUSES: InitiativeStatus[] = ["planned", "in_progress", "released"];

export const ALL_INITIATIVE_STATUSES: InitiativeStatus[] = [
  ...PRE_BACKLOG_STATUSES,
  ...ROADMAP_STATUSES,
];

const STATUS_ALIASES: Record<string, InitiativeStatus> = {
  inprogress: "in_progress",
  done: "released",
};

export const normalizeInitiativeStatus = (raw: string): InitiativeStatus | undefined => {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((ALL_INITIATIVE_STATUSES as string[]).includes(t)) {
    return t as InitiativeStatus;
  }
  const compact = raw.trim().toLowerCase().replace(/\s+/g, "");
  return STATUS_ALIASES[compact];
};

export const isPreBacklogStatus = (status: InitiativeStatus | undefined): boolean =>
  status !== undefined && PRE_BACKLOG_STATUSES.includes(status);

export const isRoadmapStatus = (status: InitiativeStatus | undefined): boolean =>
  status !== undefined && ROADMAP_STATUSES.includes(status);

/** Участвует в годовой модели и в плановом вкладе (net revenue). */
export const taskCountsTowardPlan = (task: Task): boolean =>
  task.active && isRoadmapStatus(task.initiativeStatus);

export const DEFAULT_INITIATIVE_STATUS: InitiativeStatus = "planned";

const CONFIDENCE_SET = new Set<InitiativeConfidence>(["low", "medium", "high"]);
const EFFORT_SET = new Set<InitiativeEffort>(["s", "m", "l"]);
export const normalizeConfidence = (raw: string): InitiativeConfidence | undefined => {
  const t = raw.trim().toLowerCase();
  if (CONFIDENCE_SET.has(t as InitiativeConfidence)) return t as InitiativeConfidence;
  if (t === "средняя") return "medium";
  if (t === "низкая") return "low";
  if (t === "высокая") return "high";
  return undefined;
};

export const normalizeEffort = (raw: string): InitiativeEffort | undefined => {
  const t = raw.trim().toLowerCase();
  if (EFFORT_SET.has(t as InitiativeEffort)) return t as InitiativeEffort;
  return undefined;
};

export const normalizeImpactCategory = (raw: string): InitiativeImpactCategory | undefined => {
  const t = raw.trim().toLowerCase().replace(/[\s/]+/g, "_");
  const allowed: InitiativeImpactCategory[] = [
    "conversion",
    "aov_upt",
    "retention",
    "net_cr_cancellations",
  ];
  return allowed.includes(t as InitiativeImpactCategory) ? (t as InitiativeImpactCategory) : undefined;
};

export const withInitiativeDefaults = (task: Task): Task => ({
  ...task,
  initiativeStatus: task.initiativeStatus ?? DEFAULT_INITIATIVE_STATUS,
  description: task.description ?? "",
  problemStatement: task.problemStatement ?? "",
  confidence: task.confidence ?? "medium",
  effort: task.effort ?? "m",
  impactCategory: task.impactCategory ?? "conversion",
});

/** Склейка полей проблемы и описания (как в форме идей). */
export function mergeIdeaProblemAndDescription(
  problemStatement: string | undefined,
  description: string | undefined,
): string {
  const p = problemStatement?.trim() ?? "";
  const d = description?.trim() ?? "";
  if (p && d) return `${p}\n\n${d}`;
  return p || d;
}

/**
 * Задача после переноса из pre-backlog в roadmap: формулировка проблемы/описания
 * попадает в «Комментарий / гипотеза»; problemStatement и description очищаются.
 */
export function buildPromotedRoadmapTaskFromIdea(idea: Task): Task {
  const fromBody = mergeIdeaProblemAndDescription(idea.problemStatement, idea.description);
  const existingComment = idea.comment?.trim() ?? "";
  const combinedComment =
    existingComment && fromBody ? `${existingComment}\n\n${fromBody}` : existingComment || fromBody;

  return {
    ...idea,
    initiativeStatus: "planned",
    active: true,
    comment: combinedComment,
    problemStatement: "",
    description: "",
  };
}

/**
 * Задача после возврата из roadmap в идеи: текст из comment и из problem/description
 * собирается в problemStatement (поле «Какую проблему решаем»); comment очищается.
 */
export function buildDemotedIdeaTaskFromRoadmapTask(task: Task): Task {
  const fromComment = task.comment?.trim() ?? "";
  const fromProblemFields = mergeIdeaProblemAndDescription(
    task.problemStatement,
    task.description,
  ).trim();
  const problemStatement =
    fromComment && fromProblemFields
      ? `${fromComment}\n\n${fromProblemFields}`
      : fromComment || fromProblemFields;

  return {
    ...task,
    problemStatement,
    description: "",
    comment: "",
  };
}
