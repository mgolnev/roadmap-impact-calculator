import { describe, expect, it } from "vitest";

import { compareRoadmapTasks } from "@/lib/roadmap-table-sort";
import type { Task, TaskValueMetrics } from "@/lib/types";

const baseTask = (over: Partial<Task>): Task => ({
  id: "t1",
  project: "P",
  taskName: "A",
  priority: "p2",
  initiativeStatus: "planned",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "medium",
  effort: "m",
  stage1: "order",
  impact1Type: "relative_percent",
  impact1Value: 0,
  stage2: undefined,
  impact2Type: undefined,
  impact2Value: 0,
  releaseMonth: 3,
  devCommittedReleaseMonth: 3,
  active: true,
  comment: "",
  ...over,
});

describe("compareRoadmapTasks", () => {
  it("sorts by releaseMonth asc/desc", () => {
    const a = baseTask({ id: "a", releaseMonth: 2 });
    const b = baseTask({ id: "b", releaseMonth: 5 });
    expect(compareRoadmapTasks(a, b, undefined, undefined, "releaseMonth", "asc")).toBeLessThan(0);
    expect(compareRoadmapTasks(a, b, undefined, undefined, "releaseMonth", "desc")).toBeGreaterThan(0);
  });

  it("sorts by priority", () => {
    const p1 = baseTask({ id: "x", priority: "p1" });
    const p3 = baseTask({ id: "y", priority: "p3" });
    expect(compareRoadmapTasks(p1, p3, undefined, undefined, "priority", "asc")).toBeLessThan(0);
  });

  it("uses metrics for valuePerMonth", () => {
    const a = baseTask({ id: "a" });
    const b = baseTask({ id: "b" });
    const ma: TaskValueMetrics = {
      monthsActive: 1,
      standaloneBase: 0,
      standalone15: 0,
      standalone20: 0,
      standalone30: 0,
      incrementalCurrent: 0,
      valuePerMonth: 10,
      valuePerYearIgnoreRelease: 120,
    };
    const mb: TaskValueMetrics = {
      monthsActive: 1,
      standaloneBase: 0,
      standalone15: 0,
      standalone20: 0,
      standalone30: 0,
      incrementalCurrent: 0,
      valuePerMonth: 20,
      valuePerYearIgnoreRelease: 240,
    };
    expect(compareRoadmapTasks(a, b, ma, mb, "valuePerMonth", "asc")).toBeLessThan(0);
  });

  it("uses metrics for valuePerYearIgnoreRelease", () => {
    const a = baseTask({ id: "a" });
    const b = baseTask({ id: "b" });
    const ma: TaskValueMetrics = {
      monthsActive: 1,
      standaloneBase: 0,
      standalone15: 0,
      standalone20: 0,
      standalone30: 0,
      incrementalCurrent: 0,
      valuePerMonth: 10,
      valuePerYearIgnoreRelease: 100,
    };
    const mb: TaskValueMetrics = {
      monthsActive: 1,
      standaloneBase: 0,
      standalone15: 0,
      standalone20: 0,
      standalone30: 0,
      incrementalCurrent: 0,
      valuePerMonth: 20,
      valuePerYearIgnoreRelease: 300,
    };
    expect(compareRoadmapTasks(a, b, ma, mb, "valuePerYearIgnoreRelease", "asc")).toBeLessThan(0);
  });

  it("tie-breaks by id", () => {
    const a = baseTask({ id: "b-same", releaseMonth: 1 });
    const b = baseTask({ id: "a-same", releaseMonth: 1 });
    expect(compareRoadmapTasks(a, b, undefined, undefined, "releaseMonth", "asc")).toBeGreaterThan(0);
  });
});
