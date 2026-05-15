import { DEFAULT_BASELINE } from "@/lib/constants";
import { withInitiativeDefaults } from "@/lib/initiative";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import type { PlanYear, SharedRoadmapPayload, Task, TaskPMData, TimelineMode, YearPlan } from "@/lib/types";
import { formatSupabaseError, getSupabaseClientAsync } from "@/lib/supabase";
import { DEFAULT_PLAN_YEAR, useCalculatorStore } from "@/store/calculator-store";
import { usePMStore } from "@/store/pm-store";

type RoadmapStateRow = {
  id: number;
  payload: Partial<SharedRoadmapPayload> | null;
};

type LegacySharedRoadmapPayload = {
  baseline?: SharedRoadmapPayload["yearPlans"][PlanYear]["baseline"];
  tasks?: Task[];
  ideas?: Task[];
  trafficChangePercent?: number;
  timelineMode?: TimelineMode;
  locale?: SharedRoadmapPayload["locale"];
  pmData?: Record<string, TaskPMData>;
};

const emptyYearPlan = (): YearPlan => ({
  baseline: DEFAULT_BASELINE,
  tasks: [],
  trafficChangePercent: 0,
  timelineMode: "plan",
  pmData: {},
});

const normalizeYearPlan = (plan: Partial<YearPlan> | undefined): YearPlan => {
  const mergedBaseline = { ...DEFAULT_BASELINE, ...(plan?.baseline ?? {}) };
  return {
    baseline: {
      ...mergedBaseline,
      seasonalityWeights: normalizeSeasonalityWeights(mergedBaseline.seasonalityWeights),
    },
    tasks: Array.isArray(plan?.tasks)
      ? (plan.tasks as Task[]).map((t) => withInitiativeDefaults(t))
      : [],
    trafficChangePercent: plan?.trafficChangePercent ?? 0,
    timelineMode: plan?.timelineMode === "dev_committed" ? "dev_committed" : "plan",
    pmData: plan?.pmData && typeof plan.pmData === "object" ? plan.pmData : {},
  };
};

function normalizeServerPayload(
  raw: Partial<SharedRoadmapPayload> | null | undefined,
): SharedRoadmapPayload | null {
  if (!raw) return null;
  if (raw.yearPlans) {
    const activeYear: PlanYear = raw.activeYear === 2027 ? 2027 : DEFAULT_PLAN_YEAR;
    return {
      activeYear,
      sharedIdeas: Array.isArray(raw.sharedIdeas)
        ? raw.sharedIdeas.map((t) => withInitiativeDefaults(t))
        : [],
      yearPlans: {
        2026: normalizeYearPlan(raw.yearPlans[2026]),
        2027: normalizeYearPlan(raw.yearPlans[2027]),
      },
      locale: raw.locale ?? "ru",
      _writeMode: raw._writeMode,
    };
  }

  const legacy = raw as Partial<LegacySharedRoadmapPayload>;
  if (!Array.isArray(legacy.tasks)) return null;
  const timelineMode: TimelineMode =
    legacy.timelineMode === "dev_committed" ? "dev_committed" : "plan";
  return {
    activeYear: DEFAULT_PLAN_YEAR,
    sharedIdeas: Array.isArray(legacy.ideas)
      ? (legacy.ideas as Task[]).map((t) => withInitiativeDefaults(t))
      : [],
    yearPlans: {
      2026: normalizeYearPlan({
        baseline: legacy.baseline,
        tasks: legacy.tasks,
        trafficChangePercent: legacy.trafficChangePercent ?? 0,
        timelineMode,
        pmData: legacy.pmData ?? {},
      }),
      2027: emptyYearPlan(),
    },
    locale: legacy.locale ?? "ru",
  };
}

const buildSharedPayload = (
  calc: ReturnType<typeof useCalculatorStore.getState>,
  pm: ReturnType<typeof usePMStore.getState>,
  sharedIdeas: Task[],
  writeMode: "ideas" | "full",
): SharedRoadmapPayload => ({
  activeYear: calc.activeYear,
  sharedIdeas,
  yearPlans: {
    2026: {
      ...(calc.yearPlans[2026] ?? emptyYearPlan()),
      pmData: pm.pmDataByYear[2026] ?? {},
    },
    2027: {
      ...(calc.yearPlans[2027] ?? emptyYearPlan()),
      pmData: pm.pmDataByYear[2027] ?? {},
    },
  },
  locale: calc.locale,
  _writeMode: writeMode,
});

async function fetchRoadmapStateRow(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>,
): Promise<{ row: RoadmapStateRow | null; error?: string }> {
  const byCanonicalId = await supabase
    .from("roadmap_state")
    .select("id, payload")
    .eq("id", 1)
    .maybeSingle();

  if (byCanonicalId.error) return { row: null, error: formatSupabaseError(byCanonicalId.error) };
  if (byCanonicalId.data) return { row: byCanonicalId.data as RoadmapStateRow };

  const latest = await supabase
    .from("roadmap_state")
    .select("id, payload")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) return { row: null, error: formatSupabaseError(latest.error) };
  return { row: (latest.data as RoadmapStateRow | null) ?? null };
}

/**
 * Обновляет в Supabase только список идей, не перезаписывая на сервере tasks/baseline
 * из локального состояния (если строка уже есть). Нужен для автосохранения без кнопки.
 */
export async function persistIdeasOnlyToSupabase(ideas: Task[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return { ok: false };

  const { row: existingRow, error: selectError } = await fetchRoadmapStateRow(supabase);
  if (selectError) return { ok: false, error: selectError };

  const calc = useCalculatorStore.getState();
  const pm = usePMStore.getState();
  const normalizedIdeas = ideas.map((t) => withInitiativeDefaults(t));

  let nextPayload: SharedRoadmapPayload;

  const fromServer = normalizeServerPayload(existingRow?.payload as Partial<SharedRoadmapPayload>);
  if (existingRow?.id != null && fromServer) {
    nextPayload = {
      ...fromServer,
      sharedIdeas: normalizedIdeas,
      _writeMode: "ideas",
    };
  } else {
    nextPayload = buildSharedPayload(calc, pm, normalizedIdeas, "ideas");
  }

  const updated = { payload: nextPayload, updated_at: new Date().toISOString() };
  const { error } = existingRow?.id != null
    ? await supabase.from("roadmap_state").update(updated).eq("id", existingRow.id)
    : await supabase.from("roadmap_state").insert(updated);

  if (error) return { ok: false, error: formatSupabaseError(error) };
  return { ok: true };
}
