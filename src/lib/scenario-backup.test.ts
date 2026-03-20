import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildScenarioBackupWorkbook, parseScenarioBackupWorkbook } from "@/lib/scenario-backup";
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
};

const task: Task = {
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
  active: true,
  comment: "Test task",
};

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
    ]);

    const scenarioRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
      workbook.Sheets["Сценарий"],
    );
    const baselineRows = XLSX.utils.sheet_to_json<Record<string, number>>(
      workbook.Sheets["База сценария"],
    );

    expect(scenarioRows[0].locale).toBe("ru");
    expect(scenarioRows[0].trafficChangePercent).toBe(12.5);
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
    expect(restored.baseline).toEqual(baseline);
    expect(restored.tasks).toHaveLength(1);
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
});
