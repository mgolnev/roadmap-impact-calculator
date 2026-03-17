import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "out");
const portableDir = path.join(projectRoot, "portable");
const appDir = path.join(portableDir, "app");
const binDir = path.join(portableDir, "bin");
const serverScript = path.join(projectRoot, "scripts", "portable-server.cjs");

if (!existsSync(outDir)) {
  throw new Error("Static build not found. Run `npm run build` first.");
}

rmSync(portableDir, { recursive: true, force: true });
mkdirSync(portableDir, { recursive: true });
mkdirSync(binDir, { recursive: true });
cpSync(outDir, appDir, { recursive: true });

const macTarget = process.arch === "arm64" ? "node18-macos-arm64" : "node18-macos-x64";
const targets = [
  {
    target: macTarget,
    output: path.join(binDir, "roadmap-impact-macos"),
    runner: path.join(portableDir, "run-macos.command"),
    runnerContents: `#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/bin/roadmap-impact-macos"
`,
  },
  {
    target: "node18-win-x64",
    output: path.join(binDir, "roadmap-impact-win.exe"),
    runner: path.join(portableDir, "run-windows.bat"),
    runnerContents: `@echo off
"%~dp0bin\\roadmap-impact-win.exe"
`,
  },
];

const failures = [];

for (const item of targets) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["pkg", serverScript, "--target", item.target, "--output", item.output],
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    failures.push(item.target);
    continue;
  }

  writeFileSync(item.runner, item.runnerContents);

  if (item.runner.endsWith(".command")) {
    chmodSync(item.runner, 0o755);
  }
}

writeFileSync(
  path.join(portableDir, "README.txt"),
  [
    "Roadmap Impact Calculator portable build",
    "",
    "1. macOS: run run-macos.command",
    "2. Windows: run run-windows.bat",
    "3. The app starts a local server and opens in your browser automatically.",
    "",
    "The static app files are stored in the app/ folder.",
    failures.length > 0
      ? `Some targets were not built: ${failures.join(", ")}`
      : "All requested launcher targets were built successfully.",
    "",
  ].join("\n"),
);

if (failures.length === targets.length) {
  throw new Error(`Portable launcher build failed for all targets: ${failures.join(", ")}`);
}

if (failures.length > 0) {
  console.warn(`Portable launcher warnings: failed targets -> ${failures.join(", ")}`);
}

console.log(`Portable bundle created in ${portableDir}`);
