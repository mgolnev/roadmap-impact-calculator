export type FunnelStage = "catalog" | "pdp" | "atc" | "checkout" | "order";
export type Locale = "ru" | "en";

/** План (продукт) vs месяц, на который закоммитилась разработка — для сценарного пересчёта. */
export type TimelineMode = "plan" | "dev_committed";
export type AdjustableStage =
  | FunnelStage
  | "traffic"
  | "atv"
  | "buyout"
  | "upt";
export type ImpactType = "relative_percent" | "absolute_pp" | "absolute_value";
export type Priority = "p1" | "p2" | "p3";

/** Жизненный цикл инициативы: pre-backlog → roadmap. */
export type InitiativeStatus = "draft" | "hypothesis" | "planned" | "in_progress" | "released";

export type InitiativeConfidence = "low" | "medium" | "high";

export type InitiativeEffort = "s" | "m" | "l";

/** Продуктовая категория влияния (UX); расчёт идёт через stage + impact type. */
export type InitiativeImpactCategory =
  | "conversion"
  | "aov_upt"
  | "retention"
  | "net_cr_cancellations";

export type BaselineInput = {
  sessions: number;
  catalogCr: number;
  pdpCr: number;
  atcCr: number;
  checkoutCr: number;
  orderCr: number;
  buyoutRate: number;
  atv: number;
  upt: number;
  /**
   * Доля годовых sessions по месяцам (янв = [0] … дек = [11]).
   * После нормализации элементы суммируются в 1; по умолчанию равные 1/12.
   */
  seasonalityWeights: number[];
};

export type BaselineAbsolute = {
  sessions: number;
  catalog: number;
  pdp: number;
  atc: number;
  checkout: number;
  orders: number;
};

export type BaselineDerived = {
  absolute: BaselineAbsolute;
  grossRevenue: number;
  netRevenue: number;
  orderUnits: number;
  asp: number;
};

export type FunnelRates = {
  catalogCr: number;
  pdpCr: number;
  atcCr: number;
  checkoutCr: number;
  orderCr: number;
};

export type Task = {
  id: string;
  project: string;
  taskName: string;
  priority: Priority;
  /** Статус в pipeline: Draft/Hypothesis = pre-backlog; Planned+ = roadmap. */
  initiativeStatus: InitiativeStatus;
  /** Что это и зачем */
  description: string;
  /** Какую проблему решает */
  problemStatement: string;
  /** Категория влияния (для приоритизации и отчётов). */
  impactCategory: InitiativeImpactCategory;
  confidence: InitiativeConfidence;
  effort: InitiativeEffort;
  stage1?: AdjustableStage;
  impact1Type?: ImpactType;
  impact1Value: number;
  stage2?: AdjustableStage;
  impact2Type?: ImpactType;
  impact2Value: number;
  /** Месяц старта эффекта в продуктовом плане (1–12). */
  releaseMonth: number;
  /** Месяц готовности релиза по коммиту разработки (PM); в режиме «план» не используется в модели. */
  devCommittedReleaseMonth: number;
  active: boolean;
  comment: string;
};

export type MonthlyRow = {
  month: number;
  monthLabel: string;
  sessions: number;
  catalog: number;
  pdp: number;
  atc: number;
  checkout: number;
  orders: number;
  grossRevenue: number;
  netRevenue: number;
  buyoutRate: number;
  atv: number;
  upt: number;
  orderUnits: number;
  asp: number;
  activeTaskIds: string[];
};

export type AnnualFunnel = {
  sessions: number;
  catalog: number;
  pdp: number;
  atc: number;
  checkout: number;
  orders: number;
  grossRevenue: number;
  netRevenue: number;
  buyoutRate: number;
  atv: number;
  upt: number;
  orderUnits: number;
  asp: number;
  rates: FunnelRates;
  toSessionsRates: FunnelRates;
};

export type SimulationResult = {
  months: MonthlyRow[];
  annual: AnnualFunnel;
};

export type TaskValueMetrics = {
  monthsActive: number;
  standaloneBase: number;
  standalone15: number;
  standalone20: number;
  standalone30: number;
  incrementalCurrent: number;
  valuePerMonth: number;
  /** Годовой эффект при том же месячном темпе, без учёта доли года после релиза (12 × эффект в месяц). */
  valuePerYearIgnoreRelease: number;
};

export type PhaseStatus = "not_started" | "in_progress" | "done" | "blocked" | "skipped";

export type PhaseName =
  | "prd"
  | "design"
  | "analytics"
  | "development"
  | "qa"
  | "ab_test"
  | "rollout"
  | "results";

export const PHASE_LIST: PhaseName[] = [
  "prd",
  "design",
  "analytics",
  "development",
  "qa",
  "ab_test",
  "rollout",
  "results",
];

export const PHASE_STATUS_CYCLE: PhaseStatus[] = [
  "not_started",
  "in_progress",
  "done",
  "blocked",
  "skipped",
];

export type TaskPMData = {
  startDate: string;
  endDate: string;
  manager: string;
  managerGJ: string;
  blocker: string;
  needsAbTest: boolean;
  devCostHours: number;
  /** Смежные системы (текст). */
  adjacentSystems: string;
  /** Комментарий по задаче в PM. */
  pmComment: string;
  /** URL эпика в Jira (вставка из браузера). */
  jiraEpicUrl: string;
  phases: Record<PhaseName, PhaseStatus>;
};

export type SharedRoadmapPayload = {
  baseline: BaselineInput;
  /** Roadmap / план (отдельно от pre-backlog идей). */
  tasks: Task[];
  /** Идеи и гипотезы до переноса в roadmap. */
  ideas: Task[];
  trafficChangePercent: number;
  /** Какой горизонт сроков использовать в годовой модели. */
  timelineMode?: TimelineMode;
  locale: Locale;
  pmData: Record<string, TaskPMData>;
  /**
   * Служебное поле для Supabase realtime: при `ideas` колонка обновляется автосохранением идей,
   * не нужно трогать локальный roadmap. Полное сохранение кнопкой — `full`.
   */
  _writeMode?: "ideas" | "full";
};

