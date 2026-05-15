import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_BASELINE } from "@/lib/constants";
import { withInitiativeDefaults } from "@/lib/initiative";
import type { Task, YearPlan } from "@/lib/types";

import { useCalculatorStore } from "./calculator-store";

const emptyPlan = (tasks: Task[] = []): YearPlan => ({
  baseline: DEFAULT_BASELINE,
  tasks,
  trafficChangePercent: 0,
  timelineMode: "plan",
  pmData: {},
});

const baseIdea: Task = withInitiativeDefaults({
  id: "idea-x",
  taskName: "Idea",
  project: "Proj",
  stage1: "order",
  stage2: "order",
  priority: "p1",
  impact1Type: "relative_percent",
  impact1Value: 0,
  impact2Type: undefined,
  impact2Value: 0,
  releaseMonth: 1,
  devCommittedReleaseMonth: 1,
  active: true,
  comment: "",
  initiativeStatus: "hypothesis",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "medium",
  effort: "m",
});

describe("promoteIdeaToRoadmap / promoteIdeaToRoadmapForYear", () => {
  beforeEach(() => {
    useCalculatorStore.setState({
      activeYear: 2026,
      baseline: DEFAULT_BASELINE,
      tasks: [],
      ideas: [baseIdea],
      yearPlans: {
        2026: emptyPlan(),
        2027: emptyPlan(),
      },
    });
  });

  it("удаляет идею из pre-backlog при переносе в roadmap", () => {
    useCalculatorStore.getState().promoteIdeaToRoadmapForYear("idea-x", 2026);
    const s = useCalculatorStore.getState();
    expect(s.ideas).toHaveLength(0);
    expect(s.yearPlans[2026].tasks).toHaveLength(1);
    expect(s.yearPlans[2026].tasks[0].originTaskId).toBe("idea-x");
    expect(s.tasks).toHaveLength(1);
  });

  it("удаляет идею, если в целевом году уже есть задача с тем же originTaskId", () => {
    const promotedShape = withInitiativeDefaults({
      ...baseIdea,
      id: "road-1",
      initiativeStatus: "planned",
      originTaskId: "idea-x",
    });
    useCalculatorStore.setState({
      yearPlans: {
        2026: emptyPlan([promotedShape]),
        2027: emptyPlan(),
      },
      tasks: [promotedShape],
    });
    useCalculatorStore.getState().promoteIdeaToRoadmapForYear("idea-x", 2026);
    expect(useCalculatorStore.getState().ideas).toHaveLength(0);
  });
});
