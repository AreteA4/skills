---
name: arete
description: Build with Arete, real-time Solana data streaming. Covers consuming existing streams and building custom stacks. Use when the user mentions Arete, real-time Solana data, on-chain streaming, ORE mining, or wants to consume/build data stacks.
allowed-tools: Bash(a4:*) Bash(npx:@usearete/a4*)
metadata:
  version: "0.5"
---

# Arete

Arete provides real-time streaming data from Solana programs via WebSocket. Think of it as a typed, structured pub/sub system for on-chain state.

**Key concepts:**
- **Stack** — a deployed streaming server that watches Solana programs and produces structured entity updates
- **Entity** — a domain object (e.g. `OreRound`, `OreMiner`) with typed fields organized in sections
- **View** — a lens on an entity: `state` (keyed lookup), `list` (collection), or custom (sorted/filtered)
- **SDK** — TypeScript, React, or Rust client libraries that connect to a stack's WebSocket and provide typed access to views

## Which Skill Do You Need?

Determine the user's intent, then load the appropriate sub-skill. Both sub-skills handle their own prerequisites, CLI setup, and schema discovery.

**Consuming an existing stack** (connecting to streams, subscribing to data, building UIs):
→ Load the `arete-consume` skill

**Building a custom stack** (writing Rust DSL, defining entities from program IDLs, deploying):
→ Load the `arete-build` skill

**Not sure yet?** Ask the user whether they want to consume data from an existing stack or build a new one from a Solana program IDL.

## Quick Reference

Scaffold a new app: `a4 create my-app` (prompts for template) or `npx @usearete/a4 create my-app`

CLI install: `cargo install a4-cli` (binary: `a4`) or `npm install -g @usearete/a4` (binary: `arete-cli`). Or use without installing: `npx @usearete/a4`. Prefer `a4` (Cargo).

Discover available stacks: `a4 explore --json`

Current public stacks: **ore** (ORE mining rounds, miners, treasury state). Generate a typed SDK with `a4 sdk create typescript <stack-name>` - use the stack name from `a4 explore --json`.
