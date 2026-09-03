---
name: arete
description: Discover and install exact Arete stacks or program SDKs for a Solana application. Use for generic Arete setup, capability discovery, choosing between read/build/subscribe coverage, or managing arete.toml dependencies. For view code use arete-streams; for program operations use arete-programs; for Rust stack definitions use arete-stack-authoring; for hosted publication or deployment use arete-deploy.
metadata:
  version: "1.0.0"
---

# Discover and Install Arete Capabilities

Use this skill to turn an application intent into an exact, installed Arete dependency. Do not guess protocols, stack names, program surfaces, view names, or generated APIs.

## Platform Model

Arete exposes three capability modes:

- `subscribe`: typed point-in-time and live views from a hosted stack.
- `read`: typed program-account and chain reads.
- `build`: typed program instructions, transactions, and flows.

An exact stack descriptor binds selected views, programs, authentication policies, endpoints, and SDK targets. A program descriptor binds a normalized IDL, ProgramSpec, Program Release, Program Read service, and supported SDK targets.

## Health Gate

When environment setup is relevant, run:

```bash
a4 doctor --json
```

Follow the reported `fix` commands when a required check is not ready. If `a4` is missing and setup is within scope, use the current bootstrap instructions at `https://docs.arete.run/agent.md`; do not substitute a Cargo installation from memory.

Do not run setup on every Arete task. A healthy project, a usable generated dependency, or a task that only asks for explanation does not need repeated onboarding.

## Discovery Workflow

Start from the user's intent, not from a remembered public stack:

```bash
a4 know search --query "<intent>" --json
```

Read the result's coverage flags. Continue with only the relevant branch:

- `subscribe`: inspect the named stack, then use `arete-streams` for application code.
- `read` or `build`: inspect the program surface, then use `arete-programs`.
- No suitable hosted capability and the user wants a custom feed: use `arete-stack-authoring`.
- Publication or hosted lifecycle work: use `arete-deploy`.

When the knowledge layer is unavailable or authentication is not configured, use descriptor discovery directly:

```bash
a4 explore --json
a4 explore programs --json
```

For a candidate, inspect its exact install descriptor:

```bash
a4 explore stack <stack-ref> --json
a4 explore program <program-ref> --json
```

For program semantics and callable operation names, prefer:

```bash
a4 know program <program-slug> --section surface --json
a4 know program <program-slug> --section instructions --json
a4 know program <program-slug> --section accounts --json
```

Treat a descriptor refusal as “not currently installable.” Do not fall back to an arbitrary latest IDL, AST, deployment, or release.

## Install the Exact Dependency

Prefer the `installCommand` returned by `a4 explore`. In a project, a saved dependency updates `arete.toml`, resolves `arete.lock`, and generates provenance-owned output:

```bash
a4 install stack <stack-ref> --ts
a4 install program <program-ref> --ts
```

Choose `--ts`, `--rust`, or `--python` from the existing project language and the descriptor's `sdkTargets`. Standalone program packaging may support fewer targets than a program bundled in a stack; trust the descriptor and command output.

Use `--no-save` only for a genuinely disposable, one-package generation. Do not hand-edit generated SDKs.

For project dependency configuration, locked installs, updates, removals, and output ownership, read [references/project-dependencies.md](references/project-dependencies.md).

## Source-of-Truth Order

When sources differ, use this precedence:

1. Generated types and the installed descriptor identity.
2. Current `a4 <command> --help` and `--json` output.
3. Current Arete documentation.
4. These workflow instructions.

Never preserve a stale example merely because it appears in an existing application. Identify the mismatch and migrate it to the installed surface.
