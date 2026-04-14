import { describe, expect, it } from "vitest";

import { formatTaskImpactCeoCompactSummary, formatTaskImpactCeoVerboseSummary } from "@/lib/task-impact-ceo";
import type { Task } from "@/lib/types";

const baseTask: Task = {
  id: "t1",
  project: "P",
  taskName: "T",
  priority: "p1",
  initiativeStatus: "planned",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "high",
  effort: "m",
  impact1Value: 0,
  impact2Value: 0,
  releaseMonth: 4,
  devCommittedReleaseMonth: 4,
  active: true,
  comment: "",
};

describe("formatTaskImpactCeoCompactSummary", () => {
  it("EN: relative % on checkout → +10% C/O", () => {
    const task: Task = {
      ...baseTask,
      stage1: "checkout",
      impact1Type: "relative_percent",
      impact1Value: 0.1,
    };
    expect(formatTaskImpactCeoCompactSummary(task, "en")).toBe("+10% C/O");
  });

  it("EN: absolute pp on buyout → +7pp BO", () => {
    const task: Task = {
      ...baseTask,
      stage1: "buyout",
      impact1Type: "absolute_pp",
      impact1Value: 0.07,
    };
    expect(formatTaskImpactCeoCompactSummary(task, "en")).toBe("+7pp BO");
  });

  it("RU: uses comma decimals and п.п.", () => {
    const task: Task = {
      ...baseTask,
      stage1: "checkout",
      impact1Type: "relative_percent",
      impact1Value: 0.105,
    };
    const s = formatTaskImpactCeoCompactSummary(task, "ru");
    expect(s).toContain("C/O");
    expect(s).toMatch(/\+10,5%/);
  });

  it("RU verbose: checkout relative with suffix", () => {
    const task: Task = {
      ...baseTask,
      stage1: "checkout",
      impact1Type: "relative_percent",
      impact1Value: 0.1,
    };
    const s = formatTaskImpactCeoVerboseSummary(task, "ru");
    expect(s).toContain("к конверсии шага");
    expect(s).toMatch(/10,0%/);
  });
});
