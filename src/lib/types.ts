export type FunnelStage = "catalog" | "pdp" | "atc" | "checkout" | "order";
export type AdjustableStage =
  | FunnelStage
  | "traffic"
  | "atv"
  | "buyout"
  | "upt";
export type ImpactType = "relative_percent" | "absolute_pp" | "absolute_value";

export type BaselineInput = {
  sessions: number;
  catalog: number;
  pdp: number;
  atc: number;
  checkout: number;
  orders: number;
  buyoutRate: number;
  atv: number;
  upt: number;
};

export type BaselineDerived = {
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
  stream: string;
  taskName: string;
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

export type TrafficScenarioKey = "base" | "plus15" | "plus20" | "plus30";

export type TaskValueMetrics = {
  monthsActive: number;
  standaloneBase: number;
  standalone15: number;
  standalone20: number;
  standalone30: number;
  incrementalCurrent: number;
  valuePerMonth: number;
};
