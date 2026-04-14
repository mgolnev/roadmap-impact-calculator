import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildRoadmapImpactWorkbook } from "@/lib/export";
import { uniformSeasonalityWeights } from "@/lib/seasonality";
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

const task: Task = {
  id: "task-1",
  project: "New Checkout",
  taskName: "Checkout Redesign",
  priority: "p1",
  initiativeStatus: "planned",
  description: "",
  problemStatement: "",
  impactCategory: "conversion",
  confidence: "high",
  effort: "m",
  stage1: "order",
  impact1Type: "relative_percent",
  impact1Value: 0.1,
  stage2: "checkout",
  impact2Type: "absolute_pp",
  impact2Value: 0.02,
  releaseMonth: 4,
  devCommittedReleaseMonth: 4,
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
      "Топ проектов",
      "Задачи",
    ]);

    const summaryRows = XLSX.utils.sheet_to_json<Record<string, number>>(
      workbook.Sheets["Сводка"],
    );
    const baselineRows = XLSX.utils.sheet_to_json<Record<string, number | string>>(
      workbook.Sheets["База"],
    );
    const impactMatrix = XLSX.utils.sheet_to_json<Record<string, string | number>>(
      workbook.Sheets["Воронка эффекта"],
      { header: 1, defval: "" },
    ) as unknown as (string | number)[][];
    const topProjectsRows = XLSX.utils.sheet_to_json<Record<string, number | string>>(
      workbook.Sheets["Топ проектов"],
    );
    const tasksRows = XLSX.utils.sheet_to_json<Record<string, number | string | boolean>>(
      workbook.Sheets["Задачи"],
    );

    expect(summaryRows[0].trafficChangePercent).toBe(15);
    expect(baselineRows.some((row) => row.metric === "Sessions")).toBe(true);
    expect(baselineRows.some((row) => row.metric === "Gross revenue")).toBe(true);
    const impactFlat = impactMatrix.flat().map(String).join("\t");
    expect(impactFlat).toContain("Checkout -> Заказ");
    expect(impactFlat).toContain("Gross revenue");
    expect(topProjectsRows[0]["Проект"]).toBe("New Checkout");
    expect(topProjectsRows[0]["Вклад в Net revenue (план)"]).toBe(900);
    expect(topProjectsRows[0]["Поздний релиз (мес.)"]).toBe("Апр");
    expect(tasksRows[0]["Задача"]).toBe("Checkout Redesign");
    expect(tasksRows[0]["Приоритет"]).toBe("P1 / высокий");
    expect(tasksRows[0]["Тип 1"]).toBe("%");
    expect(tasksRows[0]["Тип 2"]).toBe("п.п.");
    expect("incrementalCurrent" in tasksRows[0]).toBe(false);
    expect("active" in tasksRows[0]).toBe(false);
  });
});
