import { describe, expect, it } from "vitest";

import { DEFAULT_BASELINE } from "@/lib/constants";
import { getTaskValueMetrics, getTrafficMultiplier, simulateScenario } from "@/lib/calculations";
import { withInitiativeDefaults } from "@/lib/initiative";
import { normalizeSeasonalityWeights } from "@/lib/seasonality";
import { BaselineInput, Task } from "@/lib/types";
import { baselineFromAnnualFunnel } from "@/store/calculator-store";

const baseline: BaselineInput = {
  ...DEFAULT_BASELINE,
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

  it("uses dev_committed release month when timeline mode requests it", () => {
    const tasks = [
      createTask({
        id: "t1",
        stage1: "order",
        impact1Type: "relative_percent",
        impact1Value: 0.2,
        releaseMonth: 4,
        devCommittedReleaseMonth: 7,
      }),
    ];

    const plan = simulateScenario(baseline, tasks, getTrafficMultiplier(0), { timelineMode: "plan" });
    const dev = simulateScenario(baseline, tasks, getTrafficMultiplier(0), {
      timelineMode: "dev_committed",
    });

    expect(plan.months[3].orders).toBeCloseTo(3.6, 6);
    expect(dev.months[3].orders).toBeCloseTo(3, 6);
    expect(dev.months[6].orders).toBeCloseTo(3.6, 6);
  });

  it("changes sessions with a custom traffic multiplier", () => {
    const result = simulateScenario(baseline, [], getTrafficMultiplier(-10));
    expect(result.annual.sessions).toBeCloseTo(1080, 6);
  });

  it("keeps traffic and buyout effects distinct even when relative net uplift is equal", () => {
    const base = simulateScenario(baseline, [], getTrafficMultiplier(0));
    const trafficTask = createTask({
      id: "traffic-task",
      stage1: "traffic",
      impact1Type: "relative_percent",
      impact1Value: 0.1,
    });
    const buyoutTask = createTask({
      id: "buyout-task",
      stage1: "buyout",
      impact1Type: "relative_percent",
      impact1Value: 0.1,
    });

    const withTraffic = simulateScenario(baseline, [trafficTask], getTrafficMultiplier(0));
    const withBuyout = simulateScenario(baseline, [buyoutTask], getTrafficMultiplier(0));

    expect(withTraffic.annual.netRevenue - base.annual.netRevenue).toBeCloseTo(
      withBuyout.annual.netRevenue - base.annual.netRevenue,
      6,
    );

    expect(withTraffic.annual.sessions).toBeCloseTo(base.annual.sessions * 1.1, 6);
    expect(withTraffic.annual.orders).toBeCloseTo(base.annual.orders * 1.1, 6);
    expect(withTraffic.annual.grossRevenue).toBeCloseTo(base.annual.grossRevenue * 1.1, 6);
    expect(withTraffic.annual.buyoutRate).toBeCloseTo(base.annual.buyoutRate, 6);

    expect(withBuyout.annual.sessions).toBeCloseTo(base.annual.sessions, 6);
    expect(withBuyout.annual.orders).toBeCloseTo(base.annual.orders, 6);
    expect(withBuyout.annual.grossRevenue).toBeCloseTo(base.annual.grossRevenue, 6);
    expect(withBuyout.annual.buyoutRate).toBeCloseTo(base.annual.buyoutRate * 1.1, 6);
  });

  it("reports equal standalone net value for equal relative traffic and buyout uplifts", () => {
    const metrics = getTaskValueMetrics(
      baseline,
      [
        createTask({
          id: "traffic-task",
          stage1: "traffic",
          impact1Type: "relative_percent",
          impact1Value: 0.1,
        }),
        createTask({
          id: "buyout-task",
          stage1: "buyout",
          impact1Type: "relative_percent",
          impact1Value: 0.1,
        }),
      ],
      0,
    );

    expect(metrics["traffic-task"].standaloneBase).toBeCloseTo(
      metrics["buyout-task"].standaloneBase,
      6,
    );
  });

  it("treats buyout percentage points differently from relative buyout percent", () => {
    const base = simulateScenario(baseline, [], getTrafficMultiplier(0));
    const relativeBuyout = simulateScenario(
      baseline,
      [
        createTask({
          id: "relative-buyout",
          stage1: "buyout",
          impact1Type: "relative_percent",
          impact1Value: 0.1,
        }),
      ],
      getTrafficMultiplier(0),
    );
    const ppBuyout = simulateScenario(
      baseline,
      [
        createTask({
          id: "pp-buyout",
          stage1: "buyout",
          impact1Type: "absolute_pp",
          impact1Value: 0.1,
        }),
      ],
      getTrafficMultiplier(0),
    );

    expect(relativeBuyout.annual.buyoutRate).toBeCloseTo(0.88, 6);
    expect(ppBuyout.annual.buyoutRate).toBeCloseTo(0.9, 6);
    expect(ppBuyout.annual.netRevenue - base.annual.netRevenue).toBeCloseTo(
      base.annual.grossRevenue * 0.1,
      6,
    );
    expect(ppBuyout.annual.orders).toBeCloseTo(base.annual.orders, 6);
  });

  it("sums monthly sessions to annual sessions times traffic multiplier using seasonality weights", () => {
    const skewed = normalizeSeasonalityWeights([3, ...Array(11).fill(1)]);
    const b: BaselineInput = { ...baseline, seasonalityWeights: skewed };
    const mult = getTrafficMultiplier(5);
    const result = simulateScenario(b, [], mult);
    const sumM = result.months.reduce((acc, row) => acc + row.sessions, 0);
    expect(sumM).toBeCloseTo(baseline.sessions * mult, 4);
    expect(result.months[0].sessions).toBeGreaterThan(result.months[1].sessions);
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

  it("computes valuePerYearIgnoreRelease as if task started in january", () => {
    const metrics = getTaskValueMetrics(
      baseline,
      [
        createTask({
          id: "m-task",
          stage1: "order",
          impact1Type: "relative_percent",
          impact1Value: 0.1,
          releaseMonth: 4,
        }),
      ],
      0,
    );
    const m = metrics["m-task"];
    expect(m.valuePerYearIgnoreRelease).toBeGreaterThan(m.standaloneBase);
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

  it("can derive the next year baseline from the projected annual funnel", () => {
    const result = simulateScenario(
      baseline,
      [
        createTask({
          id: "uplift",
          stage1: "order",
          impact1Type: "relative_percent",
          impact1Value: 0.1,
        }),
      ],
      getTrafficMultiplier(5),
    );
    const nextBaseline = baselineFromAnnualFunnel(result.annual, baseline.seasonalityWeights);

    expect(nextBaseline.sessions).toBeCloseTo(result.annual.sessions, 6);
    expect(nextBaseline.catalogCr).toBeCloseTo(result.annual.rates.catalogCr, 6);
    expect(nextBaseline.orderCr).toBeCloseTo(result.annual.rates.orderCr, 6);
    expect(nextBaseline.buyoutRate).toBeCloseTo(result.annual.buyoutRate, 6);
    expect(nextBaseline.atv).toBeCloseTo(result.annual.atv, 6);
    expect(nextBaseline.seasonalityWeights).toEqual(baseline.seasonalityWeights);
  });
});
