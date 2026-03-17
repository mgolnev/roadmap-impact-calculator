export type FunnelStage = "catalog" | "pdp" | "atc" | "checkout" | "order";
export type Locale = "ru" | "en";
export type AdjustableStage =
  | FunnelStage
  | "traffic"
  | "atv"
  | "buyout"
  | "upt";
export type ImpactType = "relative_percent" | "absolute_pp" | "absolute_value";
export type Priority = "p1" | "p2" | "p3";

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
  stage1?: AdjustableStage;
  impact1Type?: ImpactType;
  impact1Value: number;
  stage2?: AdjustableStage;
  impact2Type?: ImpactType;
  impact2Value: number;
  releaseMonth: number;
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
  phases: Record<PhaseName, PhaseStatus>;
};
