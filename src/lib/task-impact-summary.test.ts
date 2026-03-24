import { describe, expect, it } from "vitest";

import { formatCurrencyMillionsRub } from "@/lib/format";
import { formatTaskImpactSummary } from "@/lib/task-impact-summary";
import type { Task } from "@/lib/types";

const baseTask = (over: Partial<Task>): Task => ({
  id: "t1",
  project: "P",
  taskName: "Test",
  priority: "p2",
  initiativeStatus: "planned",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "medium",
  effort: "m",
  stage1: "checkout",
  impact1Type: "relative_percent",
  impact1Value: 0.1,
  stage2: undefined,
  impact2Type: undefined,
  impact2Value: 0,
  releaseMonth: 4,
  active: true,
  comment: "",
  ...over,
});

describe("formatCurrencyMillionsRub", () => {
  it("uses millions suffix above 1M", () => {
    expect(formatCurrencyMillionsRub(123_000_000)).toBe("₽123M");
    expect(formatCurrencyMillionsRub(5_500_000)).toBe("₽5.5M");
  });
});

describe("formatTaskImpactSummary", () => {
  it("uses full stage label and readable conversion phrase", () => {
    const s = formatTaskImpactSummary(baseTask({}), "en");
    expect(s).toContain("Checkout");
    expect(s).toContain("10");
    expect(s).toContain("step conversion");
  });
});
