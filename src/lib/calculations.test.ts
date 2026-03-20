import { describe, expect, it } from "vitest";

import { getTaskValueMetrics, getTrafficMultiplier, simulateScenario } from "@/lib/calculations";
import { withInitiativeDefaults } from "@/lib/initiative";
import { BaselineInput, Task } from "@/lib/types";

const baseline: BaselineInput = {
  sessions: 1200,
  catalogCr: 0.6,
  pdpCr: 0.5,
  atcCr: 0.4,
  checkoutCr: 0.5,
  orderCr: 0.5,
  buyoutRate: 0.8,
  atv: 100,
  upt: 2,
};

const createTask = (overrides: Partial<Task>): Task =>
  withInitiativeDefaults({
    id: overrides.id ?? "task",
    project: overrides.project ?? "Project",
    taskName: overrides.taskName ?? "Task",
    priority: overrides.priority ?? "p2",
    initiativeStatus: overrides.initiativeStatus ?? "planned",
    description: overrides.description ?? "",
    problemStatement: overrides.problemStatement ?? "",
    impactCategory: overrides.impactCategory ?? "conversion",
    confidence: overrides.confidence ?? "medium",
    effort: overrides.effort ?? "m",
    stage1: overrides.stage1,
    impact1Type: overrides.impact1Type,
    impact1Value: overrides.impact1Value ?? 0,
    stage2: overrides.stage2,
    impact2Type: overrides.impact2Type,
    impact2Value: overrides.impact2Value ?? 0,
    releaseMonth: overrides.releaseMonth ?? 1,
    active: overrides.active ?? true,
    comment: overrides.comment ?? "",
    ...overrides,
  } as Task);

describe("simulateScenario", () => {
  it("multiplies multiple relative uplifts on the same stage", () => {
    const tasks = [
      createTask({
        id: "t1",
        stage1: "order",
        impact1Type: "relative_percent",
        impact1Value: 0.15,
      }),
      createTask({
        id: "t2",
        stage1: "order",
        impact1Type: "relative_percent",
        impact1Value: 0.15,
      }),
    ];

    const result = simulateScenario(baseline, tasks, getTrafficMultiplier(0));
    expect(result.annual.rates.orderCr).toBeCloseTo(0.5 * 1.15 * 1.15, 6);
  });

  it("adds percentage points for absolute_pp impacts", () => {
    const tasks = [
      createTask({
        id: "t1",
        stage1: "checkout",
        impact1Type: "absolute_pp",
        impact1Value: 0.02,
      }),
      createTask({
        id: "t2",
        stage1: "checkout",
        impact1Type: "absolute_pp",
        impact1Value: 0.03,
      }),
    ];

    const result = simulateScenario(baseline, tasks, getTrafficMultiplier(0));
    expect(result.annual.rates.checkoutCr).toBeCloseTo(0.55, 6);
  });

  it("applies absolute values to non-rate metrics like atv", () => {
    const tasks = [
      createTask({
        id: "t1",
        stage1: "atv",
        impact1Type: "absolute_value",
        impact1Value: 25,
      }),
    ];

    const result = simulateScenario(baseline, tasks, getTrafficMultiplier(0));
    expect(result.annual.atv).toBeCloseTo(125, 6);
  });

  it("keeps task effect active from release month onward", () => {
    const tasks = [
      createTask({
        id: "t1",
        stage1: "order",
        impact1Type: "relative_percent",
        impact1Value: 0.2,
        releaseMonth: 4,
      }),
    ];

    const result = simulateScenario(baseline, tasks, getTrafficMultiplier(0));

    expect(result.months[2].orders).toBeCloseTo(3, 6);
    expect(result.months[3].orders).toBeCloseTo(3.6, 6);
    expect(result.months[4].orders).toBeCloseTo(3.6, 6);
  });

  it("changes sessions with a custom traffic multiplier", () => {
    const result = simulateScenario(baseline, [], getTrafficMultiplier(-10));
    expect(result.annual.sessions).toBeCloseTo(1080, 6);
  });

  it("applies UPT impact and updates orderUnits", () => {
    const base = simulateScenario(baseline, [], getTrafficMultiplier(0));
    const withUpt = simulateScenario(
      baseline,
      [
        createTask({
          id: "upt-task",
          stage1: "upt",
          impact1Type: "relative_percent",
          impact1Value: 0.2,
        }),
      ],
      getTrafficMultiplier(0),
    );
    expect(base.annual.upt).toBeCloseTo(2, 6);
    expect(withUpt.annual.upt).toBeCloseTo(2 * 1.2, 6);
    expect(withUpt.annual.orderUnits).toBeGreaterThan(base.annual.orderUnits);
  });

  it("UPT impact increases netRevenue so task value is non-zero", () => {
    const metrics = getTaskValueMetrics(
      baseline,
      [
        createTask({
          id: "upt-task",
          stage1: "upt",
          impact1Type: "relative_percent",
          impact1Value: 0.2,
        }),
      ],
      0,
    );
    expect(metrics["upt-task"].standaloneBase).toBeGreaterThan(0);
  });

  it("splits roadmap contribution sequentially so task values sum to total delta", () => {
    const tasks = [
      createTask({
        id: "jan-task",
        taskName: "Jan task",
        stage1: "order",
        impact1Type: "relative_percent",
        impact1Value: 0.5,
        releaseMonth: 1,
      }),
      createTask({
        id: "feb-task",
        taskName: "Feb task",
        stage1: "order",
        impact1Type: "relative_percent",
        impact1Value: 0.5,
        releaseMonth: 2,
      }),
    ];

    const metrics = getTaskValueMetrics(baseline, tasks, 0);
    const withAll = simulateScenario(baseline, tasks, getTrafficMultiplier(0)).annual.netRevenue;
    const base = simulateScenario(baseline, [], getTrafficMultiplier(0)).annual.netRevenue;

    expect(metrics["jan-task"].incrementalCurrent).toBeCloseTo(1440, 6);
    expect(metrics["feb-task"].incrementalCurrent).toBeCloseTo(1320, 6);
    expect(
      metrics["jan-task"].incrementalCurrent + metrics["feb-task"].incrementalCurrent,
    ).toBeCloseTo(withAll - base, 6);
  });

  it("excludes draft pre-backlog initiatives from the annual scenario", () => {
    const planned = createTask({
      id: "p1",
      initiativeStatus: "planned",
      stage1: "order",
      impact1Type: "relative_percent",
      impact1Value: 0.1,
    });
    const draft = createTask({
      id: "d1",
      initiativeStatus: "draft",
      stage1: "order",
      impact1Type: "relative_percent",
      impact1Value: 0.5,
    });
    const onlyPlanned = simulateScenario(baseline, [planned], getTrafficMultiplier(0));
    const mixed = simulateScenario(baseline, [planned, draft], getTrafficMultiplier(0));
    expect(mixed.annual.netRevenue).toBeCloseTo(onlyPlanned.annual.netRevenue, 6);
  });
});
