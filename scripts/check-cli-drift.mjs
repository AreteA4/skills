#!/usr/bin/env node
// Drift check: the skills must cite a CLI surface that actually exists.
//
//   node scripts/check-cli-drift.mjs
//
// What it verifies:
//   1. Every skills/<name>/SKILL.md declares metadata.version and
//      metadata.min-cli (the oldest a4 release the skill's commands need).
//   2. Every backtick-quoted `a4 ...` command citation in skills/ resolves
//      against the real CLI: each token must be a valid subcommand wherever
//      the parent command has subcommands; trailing tokens after a leaf
//      command are positional arguments and pass.
//   3. The CLI under test satisfies every declared min-cli floor.
//
// The CLI is A4_BIN when set, otherwise `npx -y @usearete/a4@latest` (the
// wrapper bootstraps the signed binary from the latest GitHub release).
// Only backtick-quoted citations are checked; prose mentions are not command
// citations. Exit 1 on any failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// ---------------------------------------------------------------- frontmatter

const skillDirs = fs
  .readdirSync(path.join(repoRoot, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (skillDirs.length === 0) failures.push("skills/: no skill directories found");

const minCliRanges = new Map();
for (const dir of skillDirs) {
  const file = path.join("skills", dir, "SKILL.md");
  const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  const metadata = frontmatter?.[1].match(/^metadata:\n((?: {2}.*(?:\n|$))+)/m)?.[1] ?? "";
  const version = metadata.match(/^  version: "([^"]+)"/m)?.[1];
  const minCli = metadata.match(/^  min-cli: "([^"]+)"/m)?.[1];
  if (!version) failures.push(`${file}: metadata.version is missing`);
  if (!minCli) {
    failures.push(`${file}: metadata.min-cli is missing (expected e.g. ">=0.13.0")`);
  } else if (!/^>=\d+\.\d+\.\d+$/.test(minCli)) {
    failures.push(`${file}: metadata.min-cli must be a >=X.Y.Z floor, got "${minCli}"`);
  } else {
    minCliRanges.set(file, minCli.slice(2));
  }
}

// ---------------------------------------------------------------- CLI surface

const a4 = process.env.A4_BIN
  ? { command: process.env.A4_BIN, baseArgs: [] }
  : { command: "npx", baseArgs: ["-y", "@usearete/a4@latest"] };

function runA4(args) {
  const result = spawnSync(a4.command, [...a4.baseArgs, ...args], {
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

const versionOut = runA4(["--version"]).output.trim();
const cliVersion = versionOut.match(/(\d+\.\d+\.\d+)/)?.[1];
if (!cliVersion) {
  failures.push(`could not determine CLI version from: ${versionOut}`);
}

// Command tree: { name, subcommands: Map<string, node> }, walked from --help.
function subcommandsOf(pathParts) {
  const { status, output } = runA4([...pathParts, "--help"]);
  if (status !== 0) return new Map();
  const commandsLine = output.match(/^Commands:$/m);
  if (!commandsLine) return new Map();
  const rest = output.slice(commandsLine.index + commandsLine[0].length);
  const names = new Map();
  // rest begins with the newline terminating "Commands:"; the section ends
  // at the first blank line after the entries.
  for (const line of rest.split("\n").slice(1)) {
    if (line.trim() === "") break;
    const name = line.match(/^ {2}([a-z][a-z0-9-]*)/)?.[1];
    if (name && name !== "help") names.set(name, null);
  }
  return names;
}

function buildTree(pathParts, depth) {
  const node = { subcommands: new Map() };
  if (depth > 5) return node;
  for (const name of subcommandsOf(pathParts).keys()) {
    node.subcommands.set(name, buildTree([...pathParts, name], depth + 1));
  }
  return node;
}

console.log(`resolving CLI command tree (${a4.command} ${a4.baseArgs.join(" ")}) ...`);
const tree = buildTree([], 0);
if (tree.subcommands.size === 0) {
  failures.push("could not resolve the CLI command tree (is a4 runnable?)");
}

// ------------------------------------------------------------------ citations

const citations = new Map(); // command path -> first file citing it
function scanMarkdown(relativePath) {
  const text = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  // Command citations live in fenced blocks and inline code; prose mentions
  // (e.g. "a4 program lifecycle" in a description) are not citations.
  const segments = [
    ...[...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]),
    ...[...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]),
  ];
  for (const segment of segments) {
    for (const match of segment.matchAll(/(?:^|\s)(a4(?: [a-z][a-z0-9-]*){0,4})/gm)) {
      if (!citations.has(match[1])) citations.set(match[1], relativePath);
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".md")) scanMarkdown(path.relative(repoRoot, full));
  }
}
walk(path.join(repoRoot, "skills"));

for (const [citation, file] of [...citations].sort()) {
  const tokens = citation.split(" ").slice(1);
  if (tokens.length === 0) continue; // bare `a4` cites the binary, not a command
  let node = { subcommands: new Map([...tree.subcommands]) };
  let ok = true;
  let depth = 0;
  for (const token of tokens) {
    if (node.subcommands.size === 0) break; // leaf command: rest are positionals
    const next = node.subcommands.get(token);
    if (!next) {
      ok = false;
      break;
    }
    node = next;
    depth += 1;
  }
  if (!ok) {
    failures.push(
      `${file}: \`${citation}\` — "${tokens[depth]}" is not a subcommand of \`a4 ${tokens.slice(0, depth).join(" ")}\` in a4 ${cliVersion}`,
    );
  }
}

// -------------------------------------------------------------------- min-cli

function semverLessThan(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i];
  }
  return false;
}

if (cliVersion) {
  for (const [file, floor] of minCliRanges) {
    if (semverLessThan(cliVersion, floor)) {
      failures.push(`${file}: min-cli ">=${floor}" is not satisfied by the tested CLI ${cliVersion}`);
    }
  }
}

// --------------------------------------------------------------------- report

console.log(
  `checked ${citations.size} command citations across ${skillDirs.length} skills against a4 ${cliVersion}`,
);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("drift check OK");
