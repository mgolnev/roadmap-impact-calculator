import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildRoadmapImpactWorkbook } from "@/lib/export";
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

describe("buildRoadmapImpactWorkbook", () => {
  it("exports all main sheets and visible tables", () => {
    const workbook = buildRoadmapImpactWorkbook({
      locale: "ru",
      baseline,
      tasks: [task],
      trafficChangePercent: 15,
      taskMetrics: {
        "task-1": {
          monthsActive: 9,
          standaloneBase: 1000,
          standalone15: 1200,
          standalone20: 1300,
          standalone30: 1500,
          incrementalCurrent: 900,
          valuePerMonth: 111,
        },
      },
    });

    expect(workbook.SheetNames).toEqual([
      "Сводка",
      "База",
      "Воронка эффекта",
      "Топ задач",
      "Задачи",
      "Годовая воронка",
      "Помесячная модель",
    ]);

    const summaryRows = XLSX.utils.sheet_to_json<Record<string, number>>(
      workbook.Sheets["Сводка"],
    );
    const baselineRows = XLSX.utils.sheet_to_json<Record<string, number | string>>(
      workbook.Sheets["База"],
    );
    const impactRows = XLSX.utils.sheet_to_json<Record<string, number | string>>(
      workbook.Sheets["Воронка эффекта"],
    );
    const tasksRows = XLSX.utils.sheet_to_json<Record<string, number | string | boolean>>(
      workbook.Sheets["Задачи"],
    );
    const monthlyRows = XLSX.utils.sheet_to_json<Record<string, number | string>>(
      workbook.Sheets["Помесячная модель"],
    );

    expect(summaryRows[0].trafficChangePercent).toBe(15);
    expect(baselineRows.some((row) => row.metric === "Sessions")).toBe(true);
    expect(baselineRows.some((row) => row.metric === "Gross revenue")).toBe(true);
    expect(impactRows.some((row) => row.stage === "Checkout -> Заказ")).toBe(true);
    expect(tasksRows[0].taskName).toBe("Checkout Redesign");
    expect(monthlyRows).toHaveLength(12);
  });
});
