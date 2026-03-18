#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Load .env.local for local builds (Vercel injects env directly)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) {
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (val) process.env[m[1].trim()] = val;
    }
  }
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (url && key) {
  fs.writeFileSync(
    path.join(publicDir, "supabase-config.json"),
    JSON.stringify({ url, anonKey: key }),
    "utf8",
  );
  console.log("[build] supabase-config.json written");
} else {
  // Write empty so client knows there's no config
  fs.writeFileSync(path.join(publicDir, "supabase-config.json"), "{}", "utf8");
  console.log("[build] supabase-config.json empty (env vars missing)");
}
