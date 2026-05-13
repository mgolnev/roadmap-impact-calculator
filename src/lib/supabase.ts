import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const formatSupabaseError = (error: unknown): string => {
  if (!error) return "Unknown Supabase error";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      stringifyUnknown(record.message),
      record.details ? `details: ${stringifyUnknown(record.details)}` : "",
      record.hint ? `hint: ${stringifyUnknown(record.hint)}` : "",
      record.code ? `code: ${stringifyUnknown(record.code)}` : "",
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(" | ");
  }

  return stringifyUnknown(error) || "Unknown Supabase error";
};

/**
 * Не подставлять baked `public/supabase-config.json` (часто с прод-ключами после build),
 * если работаем локально или в `next dev` — иначе при пустом .env.local клиент всё равно ходит в прод.
 */
function shouldSkipSupabasePublicConfig(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** Sync: only works if NEXT_PUBLIC_ vars were inlined at build (often broken on Vercel static export). */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedClient) return cachedClient;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return null;
  cachedClient = createClient(url, key);
  return cachedClient;
};

/**
 * Сначала NEXT_PUBLIC_* из окружения (явный выбор проекта).
 * Затем — только вне локалки / не в `next dev` — fetch `/supabase-config.json` (Vercel static).
 */
export const getSupabaseClientAsync = async (): Promise<SupabaseClient | null> => {
  if (cachedClient) return cachedClient;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (url && key) {
    cachedClient = createClient(url, key);
    return cachedClient;
  }

  if (shouldSkipSupabasePublicConfig()) {
    return null;
  }

  try {
    const res = await fetch("/supabase-config.json");
    const json = (await res.json()) as { url?: string; anonKey?: string };
    const urlFromJson = (json?.url || "").trim();
    const anonKey = (json?.anonKey || "").trim();
    if (urlFromJson && anonKey) {
      cachedClient = createClient(urlFromJson, anonKey);
      return cachedClient;
    }
  } catch {
    // ignore
  }

  return null;
};
