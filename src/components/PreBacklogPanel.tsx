"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { formatCurrency } from "@/lib/format";
import {
  getMonthLabel,
  getStageLabels,
  getText,
  IMPACT_CATEGORY_LABELS,
  INITIATIVE_CONFIDENCE_LABELS,
  INITIATIVE_EFFORT_LABELS,
  INITIATIVE_STATUS_LABELS,
} from "@/lib/i18n";
import { getTaskValueMetrics } from "@/lib/calculations";
import { PRE_BACKLOG_STATUSES } from "@/lib/initiative";
import { effectiveReleaseMonth } from "@/lib/timeline";
import {
  AdjustableStage,
  BaselineInput,
  ImpactType,
  InitiativeConfidence,
  InitiativeEffort,
  InitiativeImpactCategory,
  InitiativeStatus,
  Locale,
  Task,
  TaskValueMetrics,
} from "@/lib/types";
import { normalizeImpactType, normalizeStage, useCalculatorStore } from "@/store/calculator-store";

import { EditableImpactInput } from "./TasksTable";

type IdeaSortMode = "none" | "standalone_desc" | "standalone_asc";

const SHORT_IMPACT_TYPE_LABELS: Record<Locale, Record<ImpactType, string>> = {
  ru: { relative_percent: "%", absolute_pp: "п.п.", absolute_value: "abs" },
  en: { relative_percent: "%", absolute_pp: "p.p.", absolute_value: "abs" },
};

type IdeaDraft = {
  taskName: string;
  project: string;
  problemStatement: string;
  initiativeStatus: InitiativeStatus;
  impactCategory: InitiativeImpactCategory;
  confidence: InitiativeConfidence;
  effort: InitiativeEffort;
  stage1: AdjustableStage | undefined;
  impact1Type: ImpactType | undefined;
  impact1Value: number;
  stage2: AdjustableStage | undefined;
  impact2Type: ImpactType | undefined;
  impact2Value: number;
  releaseMonth: number;
};

const initialDraft = (locale: Locale): IdeaDraft => ({
  taskName: "",
  project: locale === "ru" ? "Идеи" : "Ideas",
  problemStatement: "",
  initiativeStatus: "draft",
  impactCategory: "conversion",
  confidence: "low",
  effort: "m",
  stage1: "order",
  impact1Type: "relative_percent",
  impact1Value: 0,
  stage2: undefined,
  impact2Type: undefined,
  impact2Value: 0,
  releaseMonth: 1,
});

/** Объединение «проблема» и «описание» для отображения/редактирования одним полем. */
function mergeIdeaProblemBody(problemStatement: string | undefined, description: string | undefined): string {
  const p = problemStatement?.trim() ?? "";
  const d = description?.trim() ?? "";
  if (p && d) return `${p}\n\n${d}`;
  return p || d;
}

/** При открытии редактора идей: вся формулировка в problemStatement, description очищается. */
function normalizeIdeaTaskForEditor(task: Task): Task {
  const merged = mergeIdeaProblemBody(task.problemStatement, task.description);
  return { ...task, problemStatement: merged, description: "" };
}

/** Сжатый текст для свёрнутой карточки: сначала формулировка проблемы, иначе описание. */
function ideaCollapsedSummaryText(task: Task): string {
  const merged = mergeIdeaProblemBody(task.problemStatement, task.description);
  if (merged) return merged;
  return "";
}

function taskSnapshot(task: Task): string {
  const keys = Object.keys(task).sort() as (keyof Task)[];
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    ordered[String(k)] = task[k];
  }
  return JSON.stringify(ordered);
}

function flushIdeaChangesToStore(
  draft: Task,
  original: Task,
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void,
) {
  (Object.keys(draft) as (keyof Task)[]).forEach((key) => {
    if (draft[key] !== original[key]) {
      onUpdate(draft.id, key, draft[key]);
    }
  });
}

const draftToTask = (draft: IdeaDraft, locale: Locale): Task => ({
  id: `idea-${Date.now()}`,
  project: draft.project.trim() || (locale === "ru" ? "Идеи" : "Ideas"),
  taskName: draft.taskName.trim(),
  priority: "p3",
  initiativeStatus: draft.initiativeStatus,
  description: "",
  problemStatement: draft.problemStatement.trim(),
  impactCategory: draft.impactCategory,
  confidence: draft.confidence,
  effort: draft.effort,
  stage1: draft.stage1,
  impact1Type: draft.impact1Type,
  impact1Value: draft.impact1Value,
  stage2: draft.stage2,
  impact2Type: draft.impact2Type,
  impact2Value: draft.impact2Value,
  releaseMonth: draft.releaseMonth,
  devCommittedReleaseMonth: draft.releaseMonth,
  active: true,
  comment: "",
});

/** Стабильный id для live-превью потенциала в форме «Новая идея» (не совпадает с реальными id). */
const IDEA_DRAFT_PREVIEW_TASK_ID = "__pre_backlog_new_idea_preview__";

function draftToPreviewTask(draft: IdeaDraft, locale: Locale): Task {
  return {
    id: IDEA_DRAFT_PREVIEW_TASK_ID,
    project: draft.project.trim() || (locale === "ru" ? "Идеи" : "Ideas"),
    taskName: draft.taskName.trim() || "—",
    priority: "p3",
    initiativeStatus: draft.initiativeStatus,
    description: "",
    problemStatement: draft.problemStatement.trim(),
    impactCategory: draft.impactCategory,
    confidence: draft.confidence,
    effort: draft.effort,
    stage1: draft.stage1,
    impact1Type: draft.impact1Type,
    impact1Value: draft.impact1Value,
    stage2: draft.stage2,
    impact2Type: draft.impact2Type,
    impact2Value: draft.impact2Value,
    releaseMonth: draft.releaseMonth,
    devCommittedReleaseMonth: draft.releaseMonth,
    active: true,
    comment: "",
  };
}

/** Одна строка «этап + значение + тип» — общая разметка для новой идеи и редактирования. */
function PreBacklogIdeaImpactInline({
  locale,
  stageLabels,
  text,
  stageValue,
  impactType,
  impactValue,
  impactSlot,
  onStageChange,
  onImpactTypeChange,
  onImpactValueCommit,
  impactLiveCommit = true,
}: {
  locale: Locale;
  stageLabels: ReturnType<typeof getStageLabels>;
  text: Pick<ReturnType<typeof getText>, "stagePlaceholder" | "typePlaceholder">;
  stageValue: AdjustableStage | undefined;
  impactType: ImpactType | undefined;
  impactValue: number;
  impactSlot: 1 | 2;
  onStageChange: (stage: AdjustableStage | undefined) => void;
  onImpactTypeChange: (nextType: ImpactType | undefined) => void;
  onImpactValueCommit: (v: number) => void;
  /** Сразу прокидывать число в стейт при вводе (пересчёт потенциала без ожидания blur). */
  impactLiveCommit?: boolean;
}) {
  return (
    <div className="pre-backlog-impact-inline">
      <select
        className="cell-input"
        value={stageValue ?? ""}
        onChange={(e) => onStageChange(normalizeStage(e.target.value))}
      >
        <option value="">{text.stagePlaceholder}</option>
        {Object.entries(stageLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <EditableImpactInput
        key={`pre-backlog-impact-${impactSlot}-${impactType ?? "none"}`}
        type={impactType}
        value={impactValue}
        liveCommit={impactLiveCommit}
        onCommit={onImpactValueCommit}
      />
      <select
        className="cell-input impact-type-select"
        value={impactType ?? ""}
        onChange={(e) => onImpactTypeChange(normalizeImpactType(e.target.value))}
      >
        <option value="">{text.typePlaceholder}</option>
        {(Object.keys(SHORT_IMPACT_TYPE_LABELS[locale]) as ImpactType[]).map((value) => (
          <option key={value} value={value}>
            {SHORT_IMPACT_TYPE_LABELS[locale][value]}
          </option>
        ))}
      </select>
    </div>
  );
}

type PreBacklogPanelProps = {
  locale: Locale;
  baseline: BaselineInput;
  /** Задачи основного roadmap (вкладка «Бизнес») — как в расчёте метрик на главной. */
  roadmapTasks: Task[];
  trafficChangePercent: number;
  initiatives: Task[];
  taskMetrics: Record<string, TaskValueMetrics>;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onSaveIdea: (task: Task) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPromoteToRoadmap: (id: string) => void;
};

export function PreBacklogPanel({
  locale,
  baseline,
  roadmapTasks,
  trafficChangePercent,
  initiatives,
  taskMetrics,
  onUpdate,
  onSaveIdea,
  onRemove,
  onDuplicate,
  onPromoteToRoadmap,
}: PreBacklogPanelProps) {
  const timelineMode = useCalculatorStore((s) => s.timelineMode);
  const text = getText(locale);
  const stageLabels = getStageLabels(locale);
  const categoryLabels = IMPACT_CATEGORY_LABELS[locale];
  const confidenceLabels = INITIATIVE_CONFIDENCE_LABELS[locale];
  const effortLabels = INITIATIVE_EFFORT_LABELS[locale];
  const statusLabels = INITIATIVE_STATUS_LABELS[locale];

  const [draft, setDraft] = useState<IdeaDraft>(() => initialDraft(locale));
  const [nameError, setNameError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ideaEditDraft, setIdeaEditDraft] = useState<Task | null>(null);
  const ideaEditBaselineRef = useRef<string>("");

  const [searchValue, setSearchValue] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<AdjustableStage | "">("");
  const [monthFilter, setMonthFilter] = useState<number | "">("");
  const [filtersToastVisible, setFiltersToastVisible] = useState(false);
  const [roadmapTransferToast, setRoadmapTransferToast] = useState<string | null>(null);
  const [ideaSortMode, setIdeaSortMode] = useState<IdeaSortMode>("none");
  const [newIdeaFormOpen, setNewIdeaFormOpen] = useState(false);

  const projectOptions = useMemo(
    () => Array.from(new Set(initiatives.map((task) => task.project.trim() || text.noProject))).sort(),
    [initiatives, text.noProject],
  );

  const filteredInitiatives = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return initiatives.filter((task) => {
      const projectName = task.project.trim() || text.noProject;
      const matchesProject = !projectFilter || projectName === projectFilter;
      const matchesStage =
        !stageFilter || task.stage1 === stageFilter || task.stage2 === stageFilter;
      const matchesMonth =
        monthFilter === "" || effectiveReleaseMonth(task, timelineMode) === monthFilter;
      const haystack =
        `${projectName} ${task.taskName} ${task.comment} ${task.problemStatement} ${task.description}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      return matchesProject && matchesStage && matchesMonth && matchesSearch;
    });
  }, [initiatives, monthFilter, projectFilter, searchValue, stageFilter, text.noProject, timelineMode]);

  const hasActiveIdeaFilters = !!(
    searchValue.trim() ||
    projectFilter ||
    stageFilter ||
    monthFilter
  );

  const sortedFilteredInitiatives = useMemo(() => {
    const list = [...filteredInitiatives];
    const standalone = (id: string) => taskMetrics[id]?.standaloneBase ?? 0;
    if (ideaSortMode === "standalone_desc") {
      list.sort((a, b) => {
        const d = standalone(b.id) - standalone(a.id);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
    } else if (ideaSortMode === "standalone_asc") {
      list.sort((a, b) => {
        const d = standalone(a.id) - standalone(b.id);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
    }
    return list;
  }, [filteredInitiatives, ideaSortMode, taskMetrics]);

  /** Live «Потенциал (Net Δ, одиночно)» для черновика новой идеи — тот же расчёт, что у сохранённых. */
  const newIdeaPreviewMetrics = useMemo((): TaskValueMetrics | null => {
    if (!newIdeaFormOpen) return null;
    const previewTask = draftToPreviewTask(draft, locale);
    const allForPreview = [...initiatives, previewTask, ...roadmapTasks];
    const map = getTaskValueMetrics(baseline, allForPreview, trafficChangePercent, { timelineMode });
    return map[IDEA_DRAFT_PREVIEW_TASK_ID] ?? null;
  }, [baseline, draft, initiatives, locale, newIdeaFormOpen, roadmapTasks, trafficChangePercent, timelineMode]);

  /** Потенциал с учётом несохранённого черновика в развёрнутой карточке (store ещё со старыми значениями). */
  const expandedLiveMetrics = useMemo((): TaskValueMetrics | null => {
    if (!ideaEditDraft || expandedId !== ideaEditDraft.id) return null;
    const mergedInitiatives = initiatives.map((i) => (i.id === ideaEditDraft.id ? ideaEditDraft : i));
    const map = getTaskValueMetrics(
      baseline,
      [...mergedInitiatives, ...roadmapTasks],
      trafficChangePercent,
      { timelineMode },
    );
    return map[ideaEditDraft.id] ?? null;
  }, [baseline, expandedId, ideaEditDraft, initiatives, roadmapTasks, trafficChangePercent, timelineMode]);

  const resetDraft = useCallback(() => {
    setDraft(initialDraft(locale));
    setNameError(false);
  }, [locale]);

  const handleSaveIdea = () => {
    if (!draft.taskName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    onSaveIdea(draftToTask(draft, locale));
    resetDraft();
    setNewIdeaFormOpen(false);
  };

  const openIdeaEditor = useCallback((task: Task) => {
    setExpandedId(task.id);
    const normalized = normalizeIdeaTaskForEditor(task);
    setIdeaEditDraft(normalized);
    ideaEditBaselineRef.current = taskSnapshot(normalized);
  }, []);

  const closeIdeaEditor = useCallback(() => {
    setExpandedId(null);
    setIdeaEditDraft(null);
    ideaEditBaselineRef.current = "";
  }, []);

  const handleCancelIdeaEdit = useCallback(() => {
    if (!ideaEditDraft) {
      closeIdeaEditor();
      return;
    }
    if (taskSnapshot(ideaEditDraft) !== ideaEditBaselineRef.current) {
      const ok = typeof window !== "undefined" && window.confirm(getText(locale).preBacklogDiscardConfirm);
      if (!ok) return;
    }
    closeIdeaEditor();
  }, [closeIdeaEditor, ideaEditDraft, locale]);

  const handleSaveIdeaEdits = useCallback(() => {
    if (!ideaEditDraft) return;
    const original = initiatives.find((i) => i.id === ideaEditDraft.id);
    if (!original) {
      closeIdeaEditor();
      return;
    }
    flushIdeaChangesToStore(ideaEditDraft, original, onUpdate);
    closeIdeaEditor();
  }, [closeIdeaEditor, ideaEditDraft, initiatives, onUpdate]);

  const updateIdeaEditDraft = useCallback(<K extends keyof Task>(id: string, key: K, value: Task[K]) => {
    setIdeaEditDraft((d) => (d && d.id === id ? { ...d, [key]: value } : d));
  }, []);

  const updateIdeaMergedProblemBody = useCallback((id: string, value: string) => {
    setIdeaEditDraft((d) =>
      d && d.id === id ? { ...d, problemStatement: value, description: "" } : d,
    );
  }, []);

  useEffect(() => {
    if (!roadmapTransferToast) return;
    const timer = setTimeout(() => setRoadmapTransferToast(null), 3500);
    return () => clearTimeout(timer);
  }, [roadmapTransferToast]);

  const notifyMovedToRoadmap = useCallback(
    (taskName: string) => {
      const t = getText(locale);
      const label = taskName.trim() || t.toastTaskUntitled;
      setRoadmapTransferToast(t.toastTaskMovedToRoadmap.replace("{name}", label));
    },
    [locale],
  );

  const handlePromoteFromExpanded = useCallback(() => {
    if (!ideaEditDraft) return;
    const original = initiatives.find((i) => i.id === ideaEditDraft.id);
    if (original) {
      flushIdeaChangesToStore(ideaEditDraft, original, onUpdate);
    }
    const title = ideaEditDraft.taskName;
    onPromoteToRoadmap(ideaEditDraft.id);
    notifyMovedToRoadmap(title);
    closeIdeaEditor();
  }, [closeIdeaEditor, ideaEditDraft, initiatives, notifyMovedToRoadmap, onPromoteToRoadmap, onUpdate]);

  const handleDuplicateExpanded = useCallback(() => {
    if (!ideaEditDraft) return;
    const original = initiatives.find((i) => i.id === ideaEditDraft.id);
    if (original) {
      flushIdeaChangesToStore(ideaEditDraft, original, onUpdate);
    }
    onDuplicate(ideaEditDraft.id);
    closeIdeaEditor();
  }, [closeIdeaEditor, ideaEditDraft, initiatives, onDuplicate, onUpdate]);

  const handleRemoveExpanded = useCallback(() => {
    if (!ideaEditDraft) return;
    onRemove(ideaEditDraft.id);
    closeIdeaEditor();
  }, [closeIdeaEditor, ideaEditDraft, onRemove]);

  useEffect(() => {
    if (!expandedId) return;
    if (!initiatives.some((i) => i.id === expandedId)) {
      closeIdeaEditor();
    }
  }, [closeIdeaEditor, expandedId, initiatives]);

  useEffect(() => {
    if (!hasActiveIdeaFilters || filteredInitiatives.length >= initiatives.length) {
      setFiltersToastVisible(false);
      return;
    }
    setFiltersToastVisible(true);
    const timer = setTimeout(() => setFiltersToastVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [filteredInitiatives.length, hasActiveIdeaFilters, initiatives.length]);

  useEffect(() => {
    if (!expandedId) return;
    if (!filteredInitiatives.some((i) => i.id === expandedId)) {
      closeIdeaEditor();
    }
  }, [closeIdeaEditor, expandedId, filteredInitiatives]);

  const onExpandAreaKeyDown = (e: React.KeyboardEvent, task: Task) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openIdeaEditor(task);
    }
  };

  return (
    <CollapsibleSection
      className="pre-backlog-panel"
      title={text.preBacklogTitle}
      description={
        <>
          <p>{text.preBacklogDescription}</p>
          <p className="pre-backlog-note">{text.preBacklogPlanNote}</p>
        </>
      }
    >
      {!newIdeaFormOpen ? (
        <div className="pre-backlog-new-idea-collapsed">
          <button
            className="primary-button"
            type="button"
            onClick={() => setNewIdeaFormOpen(true)}
          >
            {text.preBacklogAddIdeaButton}
          </button>
        </div>
      ) : (
      <div className="pre-backlog-compact-card">
        <div className="pre-backlog-compact-heading-row">
          <h3 className="pre-backlog-compact-title">{text.preBacklogNewDraftTitle}</h3>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setNewIdeaFormOpen(false)}
          >
            {text.preBacklogCollapseNewForm}
          </button>
        </div>
        <div className="pre-backlog-compact-split">
          <div className="pre-backlog-compact-area pre-backlog-compact-area--task">
            <div className="pre-backlog-compact-task-stack">
              <label className="pre-backlog-compact-field pre-backlog-compact-field--task-full">
                <span>
                  {text.task} <span className="required-star">*</span>
                </span>
                <input
                  className={`cell-input ${nameError ? "cell-input-error" : ""}`}
                  value={draft.taskName}
                  placeholder={locale === "ru" ? "Короткое название" : "Short title"}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, taskName: e.target.value }));
                    if (nameError) setNameError(false);
                  }}
                />
                {nameError ? <span className="field-error">{text.preBacklogNameRequired}</span> : null}
              </label>
              <div className="pre-backlog-compact-task-meta-row">
                <label className="pre-backlog-compact-field">
                  <span>{text.project}</span>
                  <input
                    className="cell-input"
                    value={draft.project}
                    onChange={(e) => setDraft((d) => ({ ...d, project: e.target.value }))}
                  />
                </label>
                <label className="pre-backlog-compact-field">
                  <span>{text.initiativeStatus}</span>
                  <select
                    className="cell-input"
                    value={draft.initiativeStatus}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, initiativeStatus: e.target.value as InitiativeStatus }))
                    }
                  >
                    {PRE_BACKLOG_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {statusLabels[st]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div className="pre-backlog-compact-area pre-backlog-compact-area--primary-impact">
            <div className="pre-backlog-compact-impact">
              <span>{text.primaryImpact}</span>
              <PreBacklogIdeaImpactInline
                locale={locale}
                stageLabels={stageLabels}
                text={text}
                stageValue={draft.stage1}
                impactType={draft.impact1Type}
                impactValue={draft.impact1Value}
                impactSlot={1}
                onStageChange={(stage) => setDraft((d) => ({ ...d, stage1: stage }))}
                onImpactTypeChange={(nextType) => setDraft((d) => ({ ...d, impact1Type: nextType }))}
                onImpactValueCommit={(next) => setDraft((d) => ({ ...d, impact1Value: next }))}
              />
            </div>
          </div>
          <label className="pre-backlog-compact-area pre-backlog-compact-area--problem pre-backlog-compact-field pre-backlog-compact-field--idea-problem-merged">
            <span>{text.ideaProblemWeSolve}</span>
            <textarea
              className="cell-input text-area text-area-compact pre-backlog-compact-problem-textarea"
              rows={3}
              value={draft.problemStatement}
              onChange={(e) => setDraft((d) => ({ ...d, problemStatement: e.target.value }))}
            />
          </label>
          <div className="pre-backlog-compact-area pre-backlog-compact-area--secondary-impact">
            <div className="pre-backlog-compact-impact">
              <span>{text.secondaryImpact}</span>
              <PreBacklogIdeaImpactInline
                locale={locale}
                stageLabels={stageLabels}
                text={text}
                stageValue={draft.stage2}
                impactType={draft.impact2Type}
                impactValue={draft.impact2Value}
                impactSlot={2}
                onStageChange={(stage) => setDraft((d) => ({ ...d, stage2: stage }))}
                onImpactTypeChange={(nextType) => setDraft((d) => ({ ...d, impact2Type: nextType }))}
                onImpactValueCommit={(next) => setDraft((d) => ({ ...d, impact2Value: next }))}
              />
            </div>
          </div>
          <div className="pre-backlog-compact-area pre-backlog-compact-area--params">
            <div className="pre-backlog-compact-row pre-backlog-compact-row--params pre-backlog-compact-row--params-in-col">
              <label className="pre-backlog-compact-field">
                <span>{text.impactCategory}</span>
                <select
                  className="cell-input"
                  value={draft.impactCategory}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, impactCategory: e.target.value as InitiativeImpactCategory }))
                  }
                >
                  {(Object.keys(categoryLabels) as InitiativeImpactCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {categoryLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pre-backlog-compact-field">
                <span>{text.confidence}</span>
                <select
                  className="cell-input"
                  value={draft.confidence}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, confidence: e.target.value as InitiativeConfidence }))
                  }
                >
                  {(Object.keys(confidenceLabels) as InitiativeConfidence[]).map((key) => (
                    <option key={key} value={key}>
                      {confidenceLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pre-backlog-compact-field">
                <span>{text.effort}</span>
                <select
                  className="cell-input"
                  value={draft.effort}
                  onChange={(e) => setDraft((d) => ({ ...d, effort: e.target.value as InitiativeEffort }))}
                >
                  {(Object.keys(effortLabels) as InitiativeEffort[]).map((key) => (
                    <option key={key} value={key}>
                      {effortLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pre-backlog-compact-field">
                <span>{text.effectStart}</span>
                <select
                  className="cell-input"
                  value={draft.releaseMonth}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, releaseMonth: Number(e.target.value) }))
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthLabel(locale, i + 1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="pre-backlog-compact-actions">
          <button className="primary-button" type="button" onClick={handleSaveIdea}>
            {text.preBacklogSaveIdea}
          </button>
          <div className="pre-backlog-field pre-backlog-potential pre-backlog-potential--compact-preview">
            <span>{text.preBacklogPotentialNet}</span>
            <strong>{formatCurrency(newIdeaPreviewMetrics?.standaloneBase ?? 0)}</strong>
          </div>
        </div>
      </div>
      )}

      <h3 className="pre-backlog-saved-heading">{text.preBacklogSavedListTitle}</h3>
      {initiatives.length > 0 ? (
        <p className="pre-backlog-list-hint">{text.preBacklogEditHint}</p>
      ) : null}

      {initiatives.length === 0 ? (
        <p className="toolbar-status">{text.preBacklogEmpty}</p>
      ) : (
        <>
          <div className="tasks-filters tasks-filters--panel">
            <div className="filters-row filters-row-primary">
              <input
                className={`cell-input ${searchValue.trim() ? "filter-active" : ""}`}
                placeholder={text.taskSearchPlaceholder}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <select
                className={`cell-input ${projectFilter ? "filter-active" : ""}`}
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              >
                <option value="">{text.allProjects}</option>
                {projectOptions.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
              <select
                className={`cell-input ${stageFilter ? "filter-active" : ""}`}
                value={stageFilter}
                onChange={(event) => setStageFilter(normalizeStage(event.target.value) ?? "")}
              >
                <option value="">{text.allMetrics}</option>
                {Object.entries(stageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className={`cell-input ${monthFilter ? "filter-active" : ""}`}
                value={monthFilter}
                onChange={(event) =>
                  setMonthFilter(event.target.value === "" ? "" : Number(event.target.value))
                }
              >
                <option value="">{text.allMonths}</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthLabel(locale, i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="filters-row filters-row-secondary pre-backlog-filters__secondary">
              <select
                className={`cell-input ${ideaSortMode !== "none" ? "filter-active" : ""}`}
                value={ideaSortMode}
                onChange={(event) => setIdeaSortMode(event.target.value as IdeaSortMode)}
                aria-label={text.sortBy}
              >
                <option value="none">{text.noSorting}</option>
                <option value="standalone_desc">{text.preBacklogSortStandaloneDesc}</option>
                <option value="standalone_asc">{text.preBacklogSortStandaloneAsc}</option>
              </select>
              <button
                className={`ghost-button clear-filters-button ${hasActiveIdeaFilters ? "primary-button" : ""}`}
                type="button"
                onClick={() => {
                  setSearchValue("");
                  setProjectFilter("");
                  setMonthFilter("");
                  setStageFilter("");
                }}
              >
                {text.clearFilters}
              </button>
            </div>
          </div>

          {filteredInitiatives.length === 0 ? (
            <div className="toolbar-status">{text.noTasksForFilter}</div>
          ) : (
            <div className="pre-backlog-list">
              {sortedFilteredInitiatives.map((task) => {
            const metrics = taskMetrics[task.id];
            const expanded = expandedId === task.id;
            const summaryText = ideaCollapsedSummaryText(task);

            if (!expanded) {
              return (
                <div key={task.id} className="pre-backlog-row">
                  <div
                    className="pre-backlog-row__hit"
                    role="button"
                    tabIndex={0}
                    onClick={() => openIdeaEditor(task)}
                    onKeyDown={(e) => onExpandAreaKeyDown(e, task)}
                    aria-label={text.preBacklogEditCard}
                  >
                    <div className="pre-backlog-row__main">
                      <span className="pre-backlog-row__title">{task.taskName}</span>
                      <div className="pre-backlog-row__chip-row">
                        <span className="pre-backlog-row__meta">{task.project}</span>
                        <span className="pre-backlog-row__badge">{statusLabels[task.initiativeStatus]}</span>
                      </div>
                    </div>
                    {summaryText ? (
                      <p className="pre-backlog-row__summary" title={summaryText}>
                        {summaryText}
                      </p>
                    ) : null}
                    <div
                      className="pre-backlog-row__effect"
                      aria-label={`${text.preBacklogPotentialNet}: ${formatCurrency(metrics?.standaloneBase ?? 0)}`}
                    >
                      <span className="pre-backlog-row__effect-label">{text.preBacklogPotentialNet}</span>
                      <span className="pre-backlog-row__effect-value">
                        {formatCurrency(metrics?.standaloneBase ?? 0)}
                      </span>
                    </div>
                  </div>
                  <div className="pre-backlog-row__actions pre-backlog-row__actions--collapsed">
                    <button
                      className="ghost-button pre-backlog-row__edit-btn"
                      type="button"
                      onClick={() => openIdeaEditor(task)}
                    >
                      {text.preBacklogEditCard}
                    </button>
                    <button
                      className="pre-backlog-promote-button"
                      type="button"
                      onClick={() => {
                        onPromoteToRoadmap(task.id);
                        notifyMovedToRoadmap(task.taskName);
                      }}
                    >
                      {text.preBacklogPromote}
                    </button>
                  </div>
                </div>
              );
            }

            const t =
              ideaEditDraft && ideaEditDraft.id === task.id ? ideaEditDraft : { ...task };

            return (
              <article key={task.id} className="pre-backlog-card pre-backlog-card--expanded">
                <div className="pre-backlog-card__grid">
                  <div className="pre-backlog-compact-split">
                    <div className="pre-backlog-compact-area pre-backlog-compact-area--task">
                      <div className="pre-backlog-compact-task-stack">
                        <label className="pre-backlog-compact-field pre-backlog-compact-field--task-full">
                          <span>{text.task}</span>
                          <input
                            className="cell-input"
                            value={t.taskName}
                            placeholder={locale === "ru" ? "Короткое название" : "Short title"}
                            onChange={(e) => updateIdeaEditDraft(t.id, "taskName", e.target.value)}
                          />
                        </label>
                        <div className="pre-backlog-compact-task-meta-row">
                          <label className="pre-backlog-compact-field">
                            <span>{text.project}</span>
                            <input
                              className="cell-input"
                              value={t.project}
                              onChange={(e) => updateIdeaEditDraft(t.id, "project", e.target.value)}
                            />
                          </label>
                          <label className="pre-backlog-compact-field">
                            <span>{text.initiativeStatus}</span>
                            <select
                              className="cell-input"
                              value={t.initiativeStatus}
                              onChange={(e) =>
                                updateIdeaEditDraft(t.id, "initiativeStatus", e.target.value as InitiativeStatus)
                              }
                            >
                              {PRE_BACKLOG_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {statusLabels[st]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="pre-backlog-compact-area pre-backlog-compact-area--primary-impact">
                      <div className="pre-backlog-compact-impact">
                        <span>{text.primaryImpact}</span>
                        <PreBacklogIdeaImpactInline
                          locale={locale}
                          stageLabels={stageLabels}
                          text={text}
                          stageValue={t.stage1}
                          impactType={t.impact1Type}
                          impactValue={t.impact1Value}
                          impactSlot={1}
                          onStageChange={(stage) => updateIdeaEditDraft(t.id, "stage1", stage)}
                          onImpactTypeChange={(nextType) =>
                            updateIdeaEditDraft(t.id, "impact1Type", nextType)
                          }
                          onImpactValueCommit={(next) => updateIdeaEditDraft(t.id, "impact1Value", next)}
                        />
                      </div>
                    </div>
                    <label className="pre-backlog-compact-area pre-backlog-compact-area--problem pre-backlog-compact-field pre-backlog-compact-field--idea-problem-merged">
                      <span>{text.ideaProblemWeSolve}</span>
                      <textarea
                        className="cell-input text-area text-area-compact pre-backlog-compact-problem-textarea"
                        rows={3}
                        value={t.problemStatement}
                        onChange={(e) => updateIdeaMergedProblemBody(t.id, e.target.value)}
                      />
                    </label>
                    <div className="pre-backlog-compact-area pre-backlog-compact-area--secondary-impact">
                      <div className="pre-backlog-compact-impact">
                        <span>{text.secondaryImpact}</span>
                        <PreBacklogIdeaImpactInline
                          locale={locale}
                          stageLabels={stageLabels}
                          text={text}
                          stageValue={t.stage2}
                          impactType={t.impact2Type}
                          impactValue={t.impact2Value}
                          impactSlot={2}
                          onStageChange={(stage) => updateIdeaEditDraft(t.id, "stage2", stage)}
                          onImpactTypeChange={(nextType) =>
                            updateIdeaEditDraft(t.id, "impact2Type", nextType)
                          }
                          onImpactValueCommit={(next) => updateIdeaEditDraft(t.id, "impact2Value", next)}
                        />
                      </div>
                    </div>
                    <div className="pre-backlog-compact-area pre-backlog-compact-area--params">
                      <div className="pre-backlog-compact-row pre-backlog-compact-row--params pre-backlog-compact-row--params-in-col">
                        <label className="pre-backlog-compact-field">
                          <span>{text.impactCategory}</span>
                          <select
                            className="cell-input"
                            value={t.impactCategory}
                            onChange={(e) =>
                              updateIdeaEditDraft(
                                t.id,
                                "impactCategory",
                                e.target.value as InitiativeImpactCategory,
                              )
                            }
                          >
                            {(Object.keys(categoryLabels) as InitiativeImpactCategory[]).map((key) => (
                              <option key={key} value={key}>
                                {categoryLabels[key]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="pre-backlog-compact-field">
                          <span>{text.confidence}</span>
                          <select
                            className="cell-input"
                            value={t.confidence}
                            onChange={(e) =>
                              updateIdeaEditDraft(t.id, "confidence", e.target.value as InitiativeConfidence)
                            }
                          >
                            {(Object.keys(confidenceLabels) as InitiativeConfidence[]).map((key) => (
                              <option key={key} value={key}>
                                {confidenceLabels[key]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="pre-backlog-compact-field">
                          <span>{text.effort}</span>
                          <select
                            className="cell-input"
                            value={t.effort}
                            onChange={(e) =>
                              updateIdeaEditDraft(t.id, "effort", e.target.value as InitiativeEffort)
                            }
                          >
                            {(Object.keys(effortLabels) as InitiativeEffort[]).map((key) => (
                              <option key={key} value={key}>
                                {effortLabels[key]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="pre-backlog-compact-field">
                          <span>{text.effectStart}</span>
                          <select
                            className="cell-input"
                            value={t.releaseMonth}
                            onChange={(e) =>
                              updateIdeaEditDraft(t.id, "releaseMonth", Number(e.target.value))
                            }
                          >
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {getMonthLabel(locale, i + 1)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="pre-backlog-card__meta-row">
                    <div className="pre-backlog-field pre-backlog-potential">
                      <span>{text.preBacklogPotentialNet}</span>
                      <strong>
                        {formatCurrency(
                          expandedLiveMetrics?.standaloneBase ?? metrics?.standaloneBase ?? 0,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
                <div className="pre-backlog-card__actions">
                  <div className="pre-backlog-card__actions-row">
                    <button className="primary-button" type="button" onClick={handleSaveIdeaEdits}>
                      {text.preBacklogSaveEdits}
                    </button>
                    <button className="ghost-button" type="button" onClick={handleCancelIdeaEdit}>
                      {text.preBacklogCancelEdit}
                    </button>
                    <button className="ghost-button" type="button" onClick={handleDuplicateExpanded}>
                      {text.duplicate}
                    </button>
                    <button className="ghost-button danger" type="button" onClick={handleRemoveExpanded}>
                      {text.remove}
                    </button>
                    <button
                      className="pre-backlog-promote-button"
                      type="button"
                      title={text.preBacklogPromoteHint}
                      onClick={handlePromoteFromExpanded}
                    >
                      {text.preBacklogPromote}
                    </button>
                  </div>
                </div>
              </article>
            );
              })}
            </div>
          )}

          {filtersToastVisible ? (
            <div
              className={`toast${roadmapTransferToast ? " toast--stacked" : ""}`}
              role="status"
            >
              {text.preBacklogFilteredToast}
            </div>
          ) : null}
          {roadmapTransferToast ? (
            <div className="toast" role="status">
              {roadmapTransferToast}
            </div>
          ) : null}
        </>
      )}
    </CollapsibleSection>
  );
}
