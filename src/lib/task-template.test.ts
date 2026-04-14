import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildTaskImportWorkbook, parseTaskImportWorkbook } from "@/lib/task-template";
import { Task } from "@/lib/types";

const exampleTask: Task = {
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
  impact1Value: 0.15,
  stage2: "checkout",
  impact2Type: "absolute_pp",
  impact2Value: 0.02,
  releaseMonth: 4,
  devCommittedReleaseMonth: 4,
  active: true,
  comment: "Test task",
};

describe("task import template", () => {
  it("builds a template workbook with guide sheets", () => {
    const workbook = buildTaskImportWorkbook({
      locale: "ru",
      tasks: [exampleTask],
    });

    expect(workbook.SheetNames).toEqual(["Шаблон задач", "Как заполнять", "Справочники"]);

    const taskRows = XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(
      workbook.Sheets["Шаблон задач"],
    );

    expect(taskRows[0].task_id).toBe("task-1");
    expect(taskRows[0].task_name).toBe("Checkout Redesign");
    expect(taskRows[0].priority).toBe("p1");
    expect(taskRows[0].impact_1_value).toBe(15);
    expect(taskRows[0].impact_2_value).toBe(2);
  });

  it("parses template rows and converts percentages to model values", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        active: "TRUE",
        project: "SEO",
        task_name: "Organic recovery",
        priority: "p3",
        stage_1: "traffic",
        impact_1_type: "relative_percent",
        impact_1_value: 15,
        stage_2: "order",
        impact_2_type: "absolute_pp",
        impact_2_value: 2,
        release_month: 7,
        comment: "Imported from excel",
      },
    ]);

    XLSX.utils.book_append_sheet(workbook, sheet, "Шаблон задач");

    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseTaskImportWorkbook(file, "ru");

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      active: true,
      project: "SEO",
      taskName: "Organic recovery",
      priority: "p3",
      initiativeStatus: "planned",
      stage1: "traffic",
      impact1Type: "relative_percent",
      impact1Value: 0.15,
      stage2: "order",
      impact2Type: "absolute_pp",
      impact2Value: 0.02,
      releaseMonth: 7,
      devCommittedReleaseMonth: 7,
    });
  });

  it("uses task_id column when present so ids round-trip", () => {
    const workbook = buildTaskImportWorkbook({ locale: "en", tasks: [exampleTask] });
    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseTaskImportWorkbook(file, "en");
    expect(result.tasks[0]?.id).toBe("task-1");
  });

  it("treats decimal Excel values as percentage inputs, not normalized ratios", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        active: "TRUE",
        project: "UX|UI",
        task_name: "New Homepage",
        stage_1: "catalog",
        impact_1_type: "relative_percent",
        impact_1_value: 0.8,
        release_month: 7,
        comment: "",
      },
    ]);

    XLSX.utils.book_append_sheet(workbook, sheet, "Шаблон задач");

    const file = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseTaskImportWorkbook(file, "ru");

    expect(result.tasks[0]?.impact1Value).toBeCloseTo(0.008, 10);
    expect(result.tasks[0]?.priority).toBe("p2");
  });
});
