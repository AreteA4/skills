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

| Install Method | Command | Binary Name |
|---------------|---------|-------------|
| macOS / Linux | `curl -fsSL https://arete.run/install.sh \| sh` | `a4` |
| Windows PowerShell | `irm https://arete.run/install.ps1 \| iex` | `a4` |
| npm | `npx @usearete/a4 install` | `a4` |
| npx (no install) | `npx @usearete/a4 <command>` | — |

All examples use `a4`. Check readiness with `a4 doctor --json` (exit 0 = ready), set up a project with `a4 init -y` (installs these skills and the `a4 mcp` server config for every detected agent), and update with `a4 self update`. Do not `cargo install a4-cli`.
