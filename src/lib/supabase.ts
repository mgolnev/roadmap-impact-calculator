import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/** Sync: only works if NEXT_PUBLIC_ vars were inlined at build (often broken on Vercel static export). */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedClient) return cachedClient;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return null;
  cachedClient = createClient(url, key);
  return cachedClient;
};

/** Async: tries env first, then fetches /supabase-config.json (written at build). Works reliably on Vercel. */
export const getSupabaseClientAsync = async (): Promise<SupabaseClient | null> => {
  if (cachedClient) return cachedClient;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (url && key) {
    cachedClient = createClient(url, key);
    return cachedClient;
  }

  try {
    const res = await fetch("/supabase-config.json");
    const json = (await res.json()) as { url?: string; anonKey?: string };
    const url = (json?.url || "").trim();
    const anonKey = (json?.anonKey || "").trim();
    if (url && anonKey) {
      cachedClient = createClient(url, anonKey);
      return cachedClient;
    }
  } catch {
    // ignore
  }

  return null;
};
