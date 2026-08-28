import { DEFAULT_BASELINE } from "@/lib/constants";
import { withInitiativeDefaults } from "@/lib/initiative";
import { saveRoadmapIdeas, formatRoadmapApiError } from "@/lib/roadmap-api";
import type { SharedRoadmapPayload, Task, YearPlan } from "@/lib/types";
import { useCalculatorStore } from "@/store/calculator-store";
import { usePMStore } from "@/store/pm-store";

const emptyYearPlan = (): YearPlan => ({
  baseline: DEFAULT_BASELINE,
  tasks: [],
  trafficChangePercent: 0,
  timelineMode: "plan",
  pmData: {},
});

export async function persistIdeasOnly(
  ideas: Task[],
): Promise<{ ok: boolean; updatedAt?: string | null; error?: string }> {
  const calc = useCalculatorStore.getState();
  const pm = usePMStore.getState();
  const normalizedIdeas = ideas.map((task) => withInitiativeDefaults(task));

  const fallbackPayload: SharedRoadmapPayload = {
    activeYear: calc.activeYear,
    sharedIdeas: normalizedIdeas,
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
    _writeMode: "ideas",
  };

  try {
    const row = await saveRoadmapIdeas(normalizedIdeas, fallbackPayload);
    return { ok: true, updatedAt: row.updated_at };
  } catch (error) {
    return { ok: false, error: formatRoadmapApiError(error) };
  }
}
