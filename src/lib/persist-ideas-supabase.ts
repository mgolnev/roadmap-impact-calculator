import { DEFAULT_BASELINE } from "@/lib/constants";
import { withInitiativeDefaults } from "@/lib/initiative";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import type { SharedRoadmapPayload, Task, TimelineMode } from "@/lib/types";
import { formatSupabaseError, getSupabaseClientAsync } from "@/lib/supabase";
import { useCalculatorStore } from "@/store/calculator-store";
import { usePMStore } from "@/store/pm-store";

type RoadmapStateRow = {
  id: number;
  payload: Partial<SharedRoadmapPayload> | null;
};

function normalizeServerPayload(
  raw: Partial<SharedRoadmapPayload> | null | undefined,
): SharedRoadmapPayload | null {
  if (!raw || !Array.isArray(raw.tasks)) return null;
  const timelineMode: TimelineMode =
    raw.timelineMode === "dev_committed" ? "dev_committed" : "plan";

  const mergedBaseline = { ...DEFAULT_BASELINE, ...(raw.baseline ?? {}) };

  return {
    baseline: {
      ...mergedBaseline,
      seasonalityWeights: normalizeSeasonalityWeights(mergedBaseline.seasonalityWeights),
    },
    tasks: (raw.tasks as Task[]).map((t) => withInitiativeDefaults(t)),
    ideas: Array.isArray(raw.ideas)
      ? (raw.ideas as Task[]).map((t) => withInitiativeDefaults(t))
      : [],
    trafficChangePercent: raw.trafficChangePercent ?? 0,
    timelineMode,
    locale: raw.locale ?? "ru",
    pmData: raw.pmData && typeof raw.pmData === "object" ? raw.pmData : {},
  };
}

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
      ideas: normalizedIdeas,
      _writeMode: "ideas",
    };
  } else {
    nextPayload = {
      baseline: calc.baseline,
      tasks: calc.tasks,
      ideas: normalizedIdeas,
      trafficChangePercent: calc.trafficChangePercent,
      timelineMode: calc.timelineMode,
      locale: calc.locale,
      pmData: pm.pmData,
      _writeMode: "ideas",
    };
  }

  const updated = { payload: nextPayload, updated_at: new Date().toISOString() };
  const { error } = existingRow?.id != null
    ? await supabase.from("roadmap_state").update(updated).eq("id", existingRow.id)
    : await supabase.from("roadmap_state").insert(updated);

  if (error) return { ok: false, error: formatSupabaseError(error) };
  return { ok: true };
}
