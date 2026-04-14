import { describe, expect, it } from "vitest";

import { formatCurrencyMillionsRub } from "@/lib/format";
import { formatTaskImpactSummary } from "@/lib/task-impact-summary";
import type { Task } from "@/lib/types";

const baseTask = (over: Partial<Task>): Task => {
  const t = {
    id: "t1",
    project: "P",
    taskName: "Test",
    priority: "p2" as const,
    initiativeStatus: "planned" as const,
    description: "",
    problemStatement: "",
    impactCategory: "conversion" as const,
    confidence: "medium" as const,
    effort: "m" as const,
    stage1: "checkout" as const,
    impact1Type: "relative_percent" as const,
    impact1Value: 0.1,
    stage2: undefined,
    impact2Type: undefined,
    impact2Value: 0,
    releaseMonth: 4,
    devCommittedReleaseMonth: 4,
    active: true,
    comment: "",
    ...over,
  };
  return {
    ...t,
    devCommittedReleaseMonth: t.devCommittedReleaseMonth ?? t.releaseMonth,
  };
};

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
