# Arete CLI Reference

All commands accept `--json` for machine-readable output and `--verbose` for debug info. Use `--json` by default in agent workflows.

## IDL Explorer (`a4 idl`)

Every subcommand takes `<path>` (the IDL JSON file) as its first argument. Lookups are case-insensitive with fuzzy matching on typos.

### Data inspection

| Command | Description |
|---------|-------------|
| `a4 idl summary <path>` | Program overview: name, format, address, section counts |
| `a4 idl instructions <path>` | List all instructions (name, account count, arg count) |
| `a4 idl instruction <path> <name>` | One instruction's accounts (writable/signer/PDA flags) and args |
| `a4 idl accounts <path>` | List all account types |
| `a4 idl account <path> <name>` | One account's field layout |
| `a4 idl types <path>` | List all custom types and enums |
| `a4 idl type <path> <name>` | One type's field layout |
| `a4 idl events <path>` | List all events |
| `a4 idl errors <path>` | List all error codes and messages |
| `a4 idl constants <path>` | List all constants |
| `a4 idl search <path> <query>` | Fuzzy-search across all sections |
| `a4 idl discriminator <path> <name>` | Compute Anchor discriminator for an instruction or account |

### Relationship analysis

| Command | Description |
|---------|-------------|
| `a4 idl relations <path>` | Classify accounts as Entity / Infrastructure / Role / Other |
| `a4 idl account-usage <path> <account>` | Which instructions use this account (grouped by writable/signer/readonly) |
| `a4 idl links <path> <a> <b>` | Instructions that involve both accounts together |
| `a4 idl pda-graph <path>` | PDA seed derivation graph (which accounts seed which PDAs) |
| `a4 idl type-graph <path>` | Pubkey field references across types (e.g. `TradeEvent.mint` → ?) |

### Stack integration

| Command | Description |
|---------|-------------|
| `a4 idl connect <path> <new-account>` | How a new account connects to existing ones |

Options for `connect`:
- **--existing <a,b,c>** — Comma-separated existing account names
- **--suggest-a4** — Suggest Arete integration points (`register_from`, `aggregate`)
- **--json** — Machine-readable output

`connect --suggest-a4` output maps directly to `lookup_index(register_from = ...)` and `#[aggregate]` decisions.

## Project & Config

| Command | Description |
|---------|-------------|
| `a4 init` | Create `arete.toml` in current directory |
| `a4 config validate` | Validate config file |

### `arete.toml`

```toml
[project]
name = "my-project"

[sdk]
typescript_output_dir = "./frontend/src/generated"
rust_output_dir = "./crates/generated"
typescript_package = "@myorg/my-sdk"
rust_module_mode = false

[[stacks]]
name = "my-game"
stack = "SettlementGame"
typescript_output_file = "./src/generated/game.ts"
rust_output_crate = "./crates/game-stack"
rust_module = true
```

## Auth

| Command | Description |
|---------|-------------|
| `a4 auth login` | Authenticate (accepts `--key, -k` for API key) |
| `a4 auth logout` | Remove credentials |
| `a4 auth status` | Check local auth state |
| `a4 auth whoami` | Verify with server |

## Build & Deploy

| Command | Description |
|---------|-------------|
| `a4 up [stack-name]` | Push + build + deploy. Accepts `--branch`, `--preview`, `--dry-run` |
| `a4 status` | Show deployment status |
| `a4 stack list` | List all stacks |
| `a4 stack show <name>` | Detailed stack info. Accepts `--version <n>` |
| `a4 stack versions <name>` | Version history. Accepts `--limit <n>` |
| `a4 stack push [name]` | Push local stacks to remote |
| `a4 stack stop <name>` | Stop a running stack. Accepts `--branch`, `--force` |
| `a4 stack delete <name>` | Delete a stack. Accepts `--force` |
| `a4 stack rollback <name>` | Rollback deployment. Accepts `--to`, `--build`, `--branch`, `--rebuild` |

## SDK Generation

| Command | Description |
|---------|-------------|
| `a4 sdk list` | List stacks available for SDK generation |
| `a4 sdk create typescript <stack>` | Generate TypeScript SDK. Accepts `--output`, `--package-name`, `--url` |
| `a4 sdk create rust <stack>` | Generate Rust SDK. Accepts `--output`, `--crate-name`, `--module`, `--url` |

## Discovery

| Command | Description |
|---------|-------------|
| `a4 explore [stack] [entity]` | Browse deployed stacks, entities, and views |
