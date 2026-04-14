import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildScenarioBackupWorkbook, parseScenarioBackupWorkbook } from "@/lib/scenario-backup";
import { withInitiativeDefaults } from "@/lib/initiative";
import { uniformSeasonalityWeights } from "@/lib/seasonality";
import { emptyPhases, emptyPMData } from "@/store/pm-store";
import { BaselineInput, Task } from "@/lib/types";

const baseline: BaselineInput = {
  sessions: 1000,
  catalogCr: 0.61,
  pdpCr: 0.735,
  atcCr: 0.27,
  checkoutCr: 0.44,
  orderCr: 0.49,
  buyoutRate: 0.62,
  atv: 2100,
  upt: 2.5,
  seasonalityWeights: uniformSeasonalityWeights(),
};

const task: Task = withInitiativeDefaults({
  id: "task-1",
  project: "New Checkout",
  taskName: "Checkout Redesign",
  priority: "p1",
  initiativeStatus: "planned",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "medium",
  effort: "m",
  stage1: "order",
  impact1Type: "relative_percent",
  impact1Value: 0.1,
  stage2: "checkout",
  impact2Type: "absolute_pp",
  impact2Value: 0.02,
  releaseMonth: 4,
  devCommittedReleaseMonth: 6,
  active: true,
  comment: "Test task",
} as Task);

describe("scenario backup workbook", () => {
  it("builds a scenario backup workbook with baseline and task sheets", () => {
    const workbook = buildScenarioBackupWorkbook({
      locale: "ru",
      baseline,
      tasks: [task],
      trafficChangePercent: 12.5,
    });

    expect(workbook.SheetNames).toEqual([
      "Сценарий",
      "База сценария",
      "Шаблон задач",
      "Как заполнять",
      "Справочники",
      "PM",
    ]);

    const scenarioRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
      workbook.Sheets["Сценарий"],
    );
    const baselineRows = XLSX.utils.sheet_to_json<Record<string, number>>(
      workbook.Sheets["База сценария"],
    );

    expect(scenarioRows[0].locale).toBe("ru");
    expect(scenarioRows[0].version).toBe(5);
    expect(scenarioRows[0].trafficChangePercent).toBe(12.5);
    expect(scenarioRows[0].timelineMode).toBe("plan");
    expect(baselineRows[0].sessions).toBe(1000);
  });

  it("restores baseline, settings, and tasks from the same workbook", () => {
    const workbook = buildScenarioBackupWorkbook({
      locale: "en",
      baseline,
      tasks: [task],
      trafficChangePercent: -5,
    });
    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const restored = parseScenarioBackupWorkbook(file, "ru");

    expect(restored.locale).toBe("en");
    expect(restored.trafficChangePercent).toBe(-5);
    expect(restored.baseline.sessions).toBe(baseline.sessions);
    expect(restored.baseline.catalogCr).toBe(baseline.catalogCr);
    expect(restored.baseline.seasonalityWeights).toHaveLength(12);
    restored.baseline.seasonalityWeights.forEach((w, i) => {
      expect(w).toBeCloseTo(baseline.seasonalityWeights[i], 5);
    });
    expect(restored.tasks).toHaveLength(1);
    expect(restored.tasks[0].id).toBe("task-1");
    expect(restored.tasks[0]).toMatchObject({
      project: "New Checkout",
      taskName: "Checkout Redesign",
      priority: "p1",
      stage1: "order",
      impact1Value: 0.1,
      impact2Value: 0.02,
      releaseMonth: 4,
      active: true,
    });
    expect(restored.ideas).toHaveLength(0);
    expect(restored.timelineMode).toBe("plan");
  });

  it("round-trips timelineMode dev_committed", () => {
    const workbook = buildScenarioBackupWorkbook({
      locale: "en",
      baseline,
      tasks: [task],
      trafficChangePercent: 0,
      timelineMode: "dev_committed",
    });
    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const restored = parseScenarioBackupWorkbook(file, "en");
    expect(restored.timelineMode).toBe("dev_committed");
  });

  it("round-trips ideas on a separate sheet", () => {
    const idea: Task = {
      ...task,
      id: "idea-1",
      taskName: "Raw idea",
      initiativeStatus: "hypothesis",
      priority: "p3",
    };
    const workbook = buildScenarioBackupWorkbook({
      locale: "ru",
      baseline,
      tasks: [task],
      ideas: [idea],
      trafficChangePercent: 0,
    });
    expect(workbook.SheetNames).toContain("Идеи");
    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const restored = parseScenarioBackupWorkbook(file, "ru");
    expect(restored.ideas).toHaveLength(1);
    expect(restored.ideas[0].taskName).toBe("Raw idea");
    expect(restored.ideas[0].initiativeStatus).toBe("hypothesis");
  });

  it("round-trips PM (project management) data on PM sheet", () => {
    const pmRow = {
      ...emptyPMData(),
      managerGJ: "Lead PM",
      manager: "Partner",
      startDate: "2026-03",
      endDate: "2026-06",
      devCostHours: 120,
      adjacentSystems: "ERP",
      pmComment: "Note",
      jiraEpicUrl: "https://jira.example/browse/ABC-1",
      phases: { ...emptyPhases(), prd: "done", design: "in_progress" },
    };
    const workbook = buildScenarioBackupWorkbook({
      locale: "en",
      baseline,
      tasks: [task],
      trafficChangePercent: 0,
      pmData: { [task.id]: pmRow },
    });
    expect(workbook.SheetNames).toContain("PM");
    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const restored = parseScenarioBackupWorkbook(file, "en");
    const pm = restored.pmData[task.id];
    expect(pm).toBeDefined();
    expect(pm.managerGJ).toBe("Lead PM");
    expect(pm.manager).toBe("Partner");
    expect(pm.startDate).toBe("2026-03");
    expect(pm.endDate).toBe("2026-06");
    expect(pm.devCostHours).toBe(120);
    expect(pm.adjacentSystems).toBe("ERP");
    expect(pm.pmComment).toBe("Note");
    expect(pm.jiraEpicUrl).toBe("https://jira.example/browse/ABC-1");
    expect(pm.phases.prd).toBe("done");
    expect(pm.phases.design).toBe("in_progress");
  });
});
