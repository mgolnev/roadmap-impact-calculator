import type { SharedRoadmapPayload, Task } from "@/lib/types";

export type RoadmapStateRow = {
  id: number;
  payload: Partial<SharedRoadmapPayload> | null;
  updated_at?: string | null;
};

type ApiErrorPayload = {
  error?: string;
};

export class RoadmapApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RoadmapApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
  if (!response.ok) {
    throw new RoadmapApiError(body?.error || `HTTP ${response.status}`, response.status);
  }
  return body as T;
}

export async function fetchRoadmapState(): Promise<RoadmapStateRow | null> {
  const response = await fetch("/api/roadmap", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await parseResponse<{ row: RoadmapStateRow | null }>(response);
  return result.row;
}

export async function saveRoadmapState(
  payload: SharedRoadmapPayload,
): Promise<RoadmapStateRow> {
  const response = await fetch("/api/roadmap", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ payload }),
  });
  const result = await parseResponse<{ row: RoadmapStateRow }>(response);
  return result.row;
}

export async function saveRoadmapIdeas(
  ideas: Task[],
  fallbackPayload: SharedRoadmapPayload,
): Promise<RoadmapStateRow> {
  const response = await fetch("/api/roadmap", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ideas, fallbackPayload }),
  });
  const result = await parseResponse<{ row: RoadmapStateRow }>(response);
  return result.row;
}

export function formatRoadmapApiError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return typeof error === "string" ? error : "Unknown roadmap API error";
}
