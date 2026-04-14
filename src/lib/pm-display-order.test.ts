import { describe, expect, it } from "vitest";

import { mergePmVisibleReorder, reorderIdList, sanitizePmManualOrder } from "@/lib/pm-display-order";

describe("pm-display-order", () => {
  it("reorderIdList moves item before target when dragging down", () => {
    expect(reorderIdList(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "a", "c", "d"]);
  });

  it("mergePmVisibleReorder assigns reordered visible ids to their slots in full list", () => {
    const full = ["a", "b", "c", "d", "e"];
    const visible = ["b", "d", "e"];
    const next = mergePmVisibleReorder(full, visible, "e", "b");
    expect(next).toEqual(["a", "e", "c", "b", "d"]);
  });

  it("mergePmVisibleReorder for two visible rows swaps slots", () => {
    const next = mergePmVisibleReorder(["a", "b", "c", "d"], ["b", "d"], "d", "b");
    expect(next).toEqual(["a", "d", "c", "b"]);
  });

  it("sanitizePmManualOrder rejects wrong length", () => {
    expect(sanitizePmManualOrder(["a", "b"], ["a", "b", "c"])).toBe(null);
    expect(sanitizePmManualOrder(["a", "b", "c"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});
