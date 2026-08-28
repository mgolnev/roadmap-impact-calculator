export type FunnelStage = "catalog" | "pdp" | "atc" | "checkout" | "order";
export type Locale = "ru" | "en";

/** План (продукт) vs месяц, на который закоммитилась разработка — для сценарного пересчёта. */
export type TimelineMode = "plan" | "dev_committed";
export type PlanYear = 2026 | 2027;
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

/**
 * Первый проход pre-backlog: один вердикт отсева (скорость просмотра сотен задач).
 */
export type IdeaFirstPassVerdict = "not_seen" | "parking" | "candidate" | "trash";

/** @deprecated оставлено для миграции из persist; используйте `ideaFirstPass`. */
export type IdeaTriageSizing = "unset" | "needs_estimate" | "minor_fix";

/** @deprecated оставлено для миграции из persist; используйте `ideaFirstPass`. */
export type IdeaRelevance = "unset" | "current" | "stale" | "unclear";

/** @deprecated оставлено для миграции из persist; используйте `ideaFirstPass`. */
export type IdeaCandidateFlag = "unset" | "yes" | "no";

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
  /** Если задача скопирована из другого годового плана, ссылка на исходный год. */
  originYear?: PlanYear;
  /** Если задача скопирована из другого годового плана, ссылка на исходную задачу. */
  originTaskId?: string;
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
  /** Pre-backlog: первый проход / отсев (одна отметка). По умолчанию при отсутствии — `not_seen`. */
  ideaFirstPass?: IdeaFirstPassVerdict;
  /** @deprecated миграция → `ideaFirstPass`. */
  ideaTriageSizing?: IdeaTriageSizing;
  /** @deprecated миграция → `ideaFirstPass`. */
  ideaRelevance?: IdeaRelevance;
  /** @deprecated миграция → `ideaFirstPass`. */
  ideaCandidateFlag?: IdeaCandidateFlag;
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
  /** Годовой эффект задачи в сценарии "старт в январе". */
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

/** Маркетинговые каналы трафика для вкладки «Факт и прогноз». */
export type MarketingChannelId = "organic" | "paid" | "crm" | "media";

export const MARKETING_CHANNEL_IDS: MarketingChannelId[] = ["organic", "paid", "crm", "media"];

export type ChannelMonthlyMetrics = {
  sessions: number;
  /** Конверсия sessions → заказ для канала (доля 0–1). */
  cr: number;
};

export type MonthlyFactStatus = "open" | "closed" | "partial";

export type MonthlyFactEntry = {
  status: MonthlyFactStatus;
  /** Прошедшие дни в неполном месяце (для нормализации на полный месяц). */
  partialDays?: number;
  /** Календарных дней в месяце. */
  daysInMonth?: number;
  channels: Partial<Record<MarketingChannelId, ChannelMonthlyMetrics>>;
  atv: number;
  buyoutRate: number;
};

export type MarketingChannelPlan = {
  id: MarketingChannelId;
  /** Месяц подключения канала (1–12). */
  activeFromMonth: number;
  /** Учитывать в сценарии «+ медиа». */
  includeInMediaScenario: boolean;
  planSessions: number[];
  planCr: number[];
};

export type ForecastPlan = {
  /** Годовой план NET (₽). */
  annualNetTarget: number;
  /** Последний месяц с фактом (1–12). */
  lastFactMonth: number;
  channels: MarketingChannelPlan[];
  monthlyFacts: MonthlyFactEntry[];
};

export type ForecastScenarioId = "do_nothing" | "media" | "media_roadmap";

export type ForecastMonthRow = {
  month: number;
  monthLabel: string;
  source: "fact" | "forecast";
  sessions: number;
  orders: number;
  atv: number;
  buyoutRate: number;
  grossRevenue: number;
  netRevenue: number;
  planNetRevenue: number;
  channelSessions: Record<MarketingChannelId, number>;
};

export type ForecastScenarioResult = {
  id: ForecastScenarioId;
  months: ForecastMonthRow[];
  annualNetRevenue: number;
  annualPlanNetRevenue: number;
  deltaToPlan: number;
  deltaToDoNothing: number;
};

export type YearPlan = {
  baseline: BaselineInput;
  /** Roadmap / план (отдельно от pre-backlog идей). */
  tasks: Task[];
  trafficChangePercent: number;
  /** Какой горизонт сроков использовать в годовой модели. */
  timelineMode?: TimelineMode;
  pmData: Record<string, TaskPMData>;
  /** Факт, каналы и прогноз на год. */
  forecast?: ForecastPlan;
};

export type MultiYearRoadmapPayload = {
  activeYear: PlanYear;
  /** Идеи и гипотезы до переноса в roadmap; общий каталог для всех годов. */
  sharedIdeas: Task[];
  yearPlans: Record<PlanYear, YearPlan>;
  locale: Locale;
  /**
   * Служебное поле синхронизации: при `ideas` запись обновляется автосохранением идей,
   * не нужно трогать локальный roadmap. Полное сохранение кнопкой — `full`.
   */
  _writeMode?: "ideas" | "full";
};

export type SharedRoadmapPayload = MultiYearRoadmapPayload;
