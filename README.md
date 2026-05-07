# Arete Skills

Agent skills for building with [Arete](https://docs.arete.run), real-time Solana data streaming.

## Install

```bash
npx skills add AreteA4/skills
```

## Skills

| Skill | Description |
|-------|-------------|
| `arete` | Router skill, detects your intent and points to the right sub-skill |
| `arete-consume` | SDK patterns for consuming streams (TypeScript, React, Rust) |
| `arete-build` | DSL syntax for building custom stacks from Solana program IDLs |

## How It Works

These skills teach AI coding agents how to use Arete. They reference the CLI for live data discovery, so type information is always accurate for the version you have installed.

### CLI Installation

The CLI binary name depends on how you install it:

| Install Method | Command | Binary Name |
|---------------|---------|-------------|
| Cargo (recommended) | `cargo install a4-cli` | `a4` |
| npm | `npm install -g arete-cli` | `arete-cli` |

All examples use `a4` (the Cargo binary). If you installed via npm, use `arete-cli` instead, or run without installing via `npx arete-cli`.
