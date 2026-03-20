#!/usr/bin/env node
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log("[build] Supabase env: URL=" + (url ? "✓" : "✗ missing") + " KEY=" + (key ? "✓" : "✗ missing"));
if (!url || !key) {
  console.warn("[build] Supabase не заработает. Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в Vercel → Project Settings → Environment Variables (Production)");
}
