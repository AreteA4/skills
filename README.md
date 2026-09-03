# Arete Agent Skills

Task-focused skills for building with [Arete](https://docs.arete.run), the typed data and program layer for Solana applications.

## Install

The normal agent onboarding flow installs the CLI, all five skills, and the Arete MCP servers:

```bash
curl -fsSL https://arete.run/install.sh | sh
a4 init -y
a4 doctor --json
```

Install only the skills when the rest of the project is already configured:

```bash
npx skills add AreteA4/skills
```

When upgrading an existing three-skill installation, run `a4 init -y` once.
The CLI uses the skills lockfile to remove only the legacy Arete-owned
`arete-consume` and `arete-build` entries after the five replacements install.

## Skills

| Skill | Use it for |
| --- | --- |
| `arete` | Discover capabilities, inspect exact descriptors, and manage project dependencies |
| `arete-streams` | Query and subscribe to typed stack views from TypeScript, React, Rust, or Python |
| `arete-programs` | Read program accounts and prepare, inspect, or execute program operations |
| `arete-stack-authoring` | Design app-facing read models and compile Arete stack artifacts from Solana IDLs |
| `arete-deploy` | Publish programs and plan or operate hosted stack deployments |

All five skills are installed together. Their descriptions select the smallest relevant workflow at runtime; users do not need to choose individual skills during setup.

## Sources of Truth

The skills deliberately avoid duplicating complete CLI and SDK manuals. Agents should resolve changing details in this order:

1. Generated SDK types and exact install descriptors.
2. `a4 <command> --help` and machine-readable `--json` output.
3. The Arete documentation MCP or [docs.arete.run](https://docs.arete.run).
4. The workflow and safety guidance in these skills.

The skills target the descriptor-backed Arete CLI surface with `a4 doctor`, `a4 know`, `a4 explore`, and `a4 install`.

Routing and safety regressions are captured as observable behaviors in
[`evals/cases.json`](evals/cases.json).

## Compatibility and Drift

Skills are versioned independently of the `arete-*` packages; the only hard
coupling is the CLI surface they cite. Each skill declares the oldest CLI it
works against in its frontmatter:

```yaml
metadata:
  version: "1.0.0"
  min-cli: ">=0.13.0"
```

Bump a skill's `version` with any content change and raise `min-cli` only when
the skill starts relying on a newer command or behavior.

CI fails when the skills drift from the released CLI. The check
(`node scripts/check-cli-drift.mjs`, A4_BIN=... to use a local build) resolves
the latest released `a4`, walks its `--help` command tree, and verifies every
backtick-quoted `a4 ...` citation in `skills/` against it — prose mentions are
not citations. It also verifies the CLI satisfies every declared `min-cli`
floor.
