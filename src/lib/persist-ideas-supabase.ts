import { DEFAULT_BASELINE } from "@/lib/constants";
import { withInitiativeDefaults } from "@/lib/initiative";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import type { SharedRoadmapPayload, Task, TimelineMode } from "@/lib/types";
import { getSupabaseClientAsync } from "@/lib/supabase";
import { useCalculatorStore } from "@/store/calculator-store";
import { usePMStore } from "@/store/pm-store";

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

/**
 * Обновляет в Supabase только список идей, не перезаписывая на сервере tasks/baseline
 * из локального состояния (если строка уже есть). Нужен для автосохранения без кнопки.
 */
export async function persistIdeasOnlyToSupabase(ideas: Task[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return { ok: false };

  const { data: existingRow, error: selectError } = await supabase
    .from("roadmap_state")
    .select("id, payload")
    .eq("id", 1)
    .maybeSingle();

  if (selectError) return { ok: false, error: selectError.message };

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
    ? await supabase.from("roadmap_state").update(updated).eq("id", 1)
    : await supabase.from("roadmap_state").insert(updated);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
