#!/usr/bin/env node
// Pattern check: every snippet in references/patterns.md is part of a
// complete protocol in evals/patterns/ that the server accepts.
//
//   (cd evals/patterns && npm ci) && node scripts/check-patterns.mjs
//
// What it verifies:
//   1. Each ```ts block after a `<!-- snippet: <file> -->` marker in
//      skills/arete-protocols/references/patterns.md appears, line for line,
//      in that file; every evals/patterns/*.protocol.ts is cited at least once.
//   2. The protocols type-check (`tsc`, so `ix` names and accounts are right).
//   3. `arete-protocol check --remote` accepts each one: the server's own
//      upload checks, without uploading. That needs a secret key in
//      ARETE_API_KEY. Without one, the local check runs (`--offline`) and the
//      script warns, unless `--require-remote` is passed. Exit 1 on any failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const patternsDir = path.join(repoRoot, "evals", "patterns");
const doc = path.join("skills", "arete-protocols", "references", "patterns.md");
const requireRemote = process.argv.includes("--require-remote");
const failures = [];

// ------------------------------------------------------------------- snippets

const protocols = fs
  .readdirSync(patternsDir)
  .filter((file) => file.endsWith(".protocol.ts"))
  .sort();
const cited = new Set();
const lines = fs.readFileSync(path.join(repoRoot, doc), "utf8").split("\n");
for (let i = 0; i < lines.length; i += 1) {
  const marker = /^<!-- snippet: (evals\/patterns\/[\w.-]+) -->$/.exec(lines[i]);
  if (!marker) continue;
  const file = marker[1];
  if (lines[i + 1] !== "```ts") {
    failures.push(`${doc}:${i + 1}: a snippet marker must be followed by a \`\`\`ts block`);
    continue;
  }
  const end = lines.indexOf("```", i + 2);
  const block = lines.slice(i + 2, end).join("\n");
  const source = path.join(repoRoot, file);
  if (!fs.existsSync(source)) {
    failures.push(`${doc}:${i + 1}: ${file} does not exist`);
    continue;
  }
  cited.add(path.basename(file));
  if (!fs.readFileSync(source, "utf8").includes(block)) {
    failures.push(`${doc}:${i + 3}: the snippet is not in ${file} (update one to match the other)`);
  }
  i = end;
}
for (const file of protocols) {
  if (!cited.has(file)) failures.push(`evals/patterns/${file}: no snippet in ${doc} cites it`);
}

// ----------------------------------------------------------------- the checks

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: patternsDir, encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
};

const tsc = run("npx", ["--no-install", "tsc", "-p", "."]);
if (!tsc.ok) failures.push(`tsc:\n${tsc.output}`);

const remote = Boolean(process.env.ARETE_API_KEY?.trim());
if (!remote) {
  const message = "ARETE_API_KEY is not set: only the local check ran, not the server's";
  if (requireRemote) failures.push(message);
  else console.log(`::warning::${message}`);
}
for (const file of protocols) {
  const check = run("npx", ["--no-install", "arete-protocol", "check", file, remote ? "--remote" : "--offline"]);
  console.log(`${check.ok ? "ok  " : "FAIL"} ${file}: ${check.output.split("\n").at(-1)}`);
  if (!check.ok) failures.push(`arete-protocol check ${file}:\n${check.output}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`error: ${failure}`);
  process.exit(1);
}
console.log(`patterns: ${protocols.length} protocols, every snippet matches`);
