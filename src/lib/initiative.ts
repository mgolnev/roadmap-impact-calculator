import {
  IdeaCandidateFlag,
  IdeaFirstPassVerdict,
  IdeaRelevance,
  IdeaTriageSizing,
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

const TRIAGE_SET = new Set<IdeaTriageSizing>(["unset", "needs_estimate", "minor_fix"]);
const RELEVANCE_SET = new Set<IdeaRelevance>(["unset", "current", "stale", "unclear"]);
const CANDIDATE_SET = new Set<IdeaCandidateFlag>(["unset", "yes", "no"]);
const FIRST_PASS_SET = new Set<IdeaFirstPassVerdict>(["not_seen", "parking", "candidate", "trash"]);

function normalizeIdeaTriageSizingLegacy(raw: string | IdeaTriageSizing | undefined): IdeaTriageSizing {
  if (raw && TRIAGE_SET.has(raw as IdeaTriageSizing)) return raw as IdeaTriageSizing;
  return "unset";
}

function normalizeIdeaRelevanceLegacy(raw: string | IdeaRelevance | undefined): IdeaRelevance {
  if (raw && RELEVANCE_SET.has(raw as IdeaRelevance)) return raw as IdeaRelevance;
  return "unset";
}

function normalizeIdeaCandidateFlagLegacy(
  raw: string | IdeaCandidateFlag | undefined,
): IdeaCandidateFlag {
  if (raw && CANDIDATE_SET.has(raw as IdeaCandidateFlag)) return raw as IdeaCandidateFlag;
  return "unset";
}

/** Миграция старых трёх полей → один вердикт (до первого сохранения с `ideaFirstPass`). */
export function migrateLegacyFirstPass(task: Task): IdeaFirstPassVerdict {
  const rel = normalizeIdeaRelevanceLegacy(task.ideaRelevance);
  const cand = normalizeIdeaCandidateFlagLegacy(task.ideaCandidateFlag);
  const tri = normalizeIdeaTriageSizingLegacy(task.ideaTriageSizing);
  if (rel === "stale") return "trash";
  if (cand === "yes") return "candidate";
  if (rel === "current" || rel === "unclear" || tri !== "unset") return "parking";
  return "not_seen";
}

export function normalizeIdeaFirstPass(raw: string | IdeaFirstPassVerdict | undefined): IdeaFirstPassVerdict {
  if (raw && FIRST_PASS_SET.has(raw as IdeaFirstPassVerdict)) return raw as IdeaFirstPassVerdict;
  return "not_seen";
}

/** Текущий вердикт первого прохода: явное поле или миграция с прежних полей. */
export function getIdeaFirstPass(task: Task): IdeaFirstPassVerdict {
  const v = task.ideaFirstPass;
  if (v && FIRST_PASS_SET.has(v)) return v;
  return migrateLegacyFirstPass(task);
}

/** Порядок в списке: не смотрел → кандидат → парковка → мусор. */
export const IDEA_FIRST_PASS_SORT_ORDER: Record<IdeaFirstPassVerdict, number> = {
  not_seen: 0,
  candidate: 1,
  parking: 2,
  trash: 3,
};

export const withInitiativeDefaults = (task: Task): Task => {
  const releaseMonth = task.releaseMonth ?? 1;
  return {
    ...task,
    releaseMonth,
    devCommittedReleaseMonth: task.devCommittedReleaseMonth ?? releaseMonth,
    initiativeStatus: task.initiativeStatus ?? DEFAULT_INITIATIVE_STATUS,
    description: task.description ?? "",
    problemStatement: task.problemStatement ?? "",
    confidence: task.confidence ?? "medium",
    effort: task.effort ?? "m",
    impactCategory: task.impactCategory ?? "conversion",
    ...(task.ideaFirstPass !== undefined
      ? { ideaFirstPass: normalizeIdeaFirstPass(task.ideaFirstPass) }
      : {}),
    ...(task.ideaTriageSizing !== undefined
      ? { ideaTriageSizing: normalizeIdeaTriageSizingLegacy(task.ideaTriageSizing) }
      : {}),
    ...(task.ideaRelevance !== undefined
      ? { ideaRelevance: normalizeIdeaRelevanceLegacy(task.ideaRelevance) }
      : {}),
    ...(task.ideaCandidateFlag !== undefined
      ? { ideaCandidateFlag: normalizeIdeaCandidateFlagLegacy(task.ideaCandidateFlag) }
      : {}),
  };
};

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
  const {
    ideaFirstPass: _fp,
    ideaTriageSizing: _triage,
    ideaRelevance: _rel,
    ideaCandidateFlag: _cand,
    ...ideaRest
  } = idea;
  const fromBody = mergeIdeaProblemAndDescription(idea.problemStatement, idea.description);
  const existingComment = idea.comment?.trim() ?? "";
  const combinedComment =
    existingComment && fromBody ? `${existingComment}\n\n${fromBody}` : existingComment || fromBody;

  return {
    ...ideaRest,
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

  const {
    ideaTriageSizing: _ts,
    ideaRelevance: _rel,
    ideaCandidateFlag: _cf,
    ideaFirstPass: _fp,
    ...taskRest
  } = task;

  return {
    ...taskRest,
    problemStatement,
    description: "",
    comment: "",
    ideaFirstPass: "not_seen",
  };
}
