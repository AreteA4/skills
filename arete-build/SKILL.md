---
name: arete-build
description: Build custom Arete stacks from Solana program IDLs using the Rust DSL. Covers entity definitions, field mappings, views, computed fields, PDA resolution, and deployment with the a4 CLI. Use when the user wants to create their own real-time data streaming stack.
allowed-tools: Bash(a4:*) Bash(npx:@usearete/a4*) Bash(cargo:*)
---

# Building Arete Stacks

A stack watches Solana programs and maps on-chain state into structured, streamable entities. The workflow is: **explore the IDL, understand what the user needs, write the Rust definition, build, deploy.**

## 1. Prerequisites

Required: Rust toolchain (building stacks compiles Rust), Arete CLI (`a4`), an IDL JSON file. Run once:

```bash
OS="$(uname -s 2>/dev/null || echo Windows)"

if ! command -v cargo &>/dev/null; then
  if [ "$OS" = "Darwin" ] || [ "$OS" = "Linux" ]; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    source "$HOME/.cargo/env"
  else
    curl -sSLo /tmp/rustup-init.exe https://win.rustup.rs/x86_64
    /tmp/rustup-init.exe -y
    export PATH="$USERPROFILE/.cargo/bin:$PATH"
  fi
fi
```

The CLI is a prebuilt binary; do not build it with Cargo:

```bash
if ! command -v a4 >/dev/null 2>&1; then
  curl -fsSL https://arete.run/install.sh | sh        # macOS / Linux
  # Windows PowerShell: irm https://arete.run/install.ps1 | iex
  # npm alternative:    npx @usearete/a4 install
  export PATH="$HOME/.local/bin:$PATH"                # the installer prints A4_BIN=<path>; use it if a4 is still not found
fi
a4 doctor --json    # exit 0 = ready; every failing check carries a `fix` command
```

> Never `cargo install a4-cli`. Update with `a4 self update`. If `doctor` warns about missing skills or MCP config, run `a4 init -y` (or `a4 doctor --fix`). All examples use `a4`; `npx @usearete/a4 <args>` runs the same binary.

## 2. Get the IDL

If the user already has the IDL, place it in `idl/` and skip to step 3.

If not, try in order:
1. Program GitHub repo — look for `target/idl/*.json` or `idl/*.json`
2. `anchor idl fetch <PROGRAM_ID> --provider.cluster mainnet -o idl/<program>.json`
3. Protocol SDK packages (NPM or crates.io often bundle the IDL)
4. Block explorers (Solscan, Solana.fm — "IDL" tab on the program page)
5. Source generators (Kinobi/Codama) as a last resort

## 3. Explore the IDL

Do this before writing any Rust. Always pass `--json` for machine-readable output.

**Survey** — get the full inventory:

```bash
a4 idl summary idl/<program>.json
a4 idl relations idl/<program>.json --json
a4 idl types idl/<program>.json --json
a4 idl events idl/<program>.json --json
```

`relations` is the most important output — it classifies accounts as Entity, Infrastructure, Role, or Other. Entity accounts are what you'll typically map to `#[entity]` structs.

**Match user intent** — adapt depth to how specific the user's request is:

- **Clear data requirements** — Use `a4 idl search idl/<program>.json <query>`, `a4 idl type idl/<program>.json <name>`, and `a4 idl instruction idl/<program>.json <name>` to confirm each requested field maps to a concrete account field, instruction arg, or event field.
- **App idea but unclear data model** — Use `relations`, `type-graph`, and `pda-graph` to identify entity candidates and relationships. Propose a data model, then proceed once confirmed.
- **No indication** — Use `relations`, `events`, and `search` to surface what the program tracks. Present a short menu of what's possible and narrow scope before coding.

**Close gaps** — before writing code, verify every cross-account link. This is the most critical step. You must understand how every account and instruction connects to every other, and confirm that the accounts you reference in macros (especially `lookup_by`) actually exist on the instruction you're sourcing from:

```bash
a4 idl account-usage idl/<program>.json <account> --json
a4 idl links idl/<program>.json <account-a> <account-b> --json
a4 idl connect idl/<program>.json <new-account> --existing <a,b> --suggest-a4 --json
a4 idl instruction idl/<program>.json <instruction-name> --json  # verify which accounts exist on an instruction
```

`connect --suggest-a4` output maps directly to `register_from` and `#[aggregate]` decisions in the DSL.

See `references/cli-reference.md` for the full `a4 idl` command set.

## 4. Project Setup

```bash
cargo new --lib my-stack && cd my-stack
mkdir -p idl
# copy IDL file(s) into idl/
```

`Cargo.toml`:
```toml
[dependencies]
arete = { version = "0.1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
borsh = { version = "1.5", features = ["derive"] }
solana-pubkey = { version = "2.2", features = ["serde", "borsh"] }
```

`arete.toml`:
```toml
[project]
name = "my-stack"
```

## 5. Write the Stack Definition

A stack is a Rust module with `#[arete]` containing one or more `#[entity]` structs. Each entity has a primary key and sections (nested structs deriving `Stream`). Fields use mapping macros to declare their data source.

```rust
use arete::prelude::*;

#[arete(idl = ["idl/<program>.json"])]
mod my_stack {
    use arete::macros::Stream;
    use serde::{Deserialize, Serialize};

    #[entity(name = "Token")]
    #[view(name = "by_volume", sort_by = "metrics.total_volume", order = "desc")]
    pub struct Token {
        pub id: TokenId,
        pub state: TokenState,
        pub metrics: TokenMetrics,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, Stream)]
    pub struct TokenId {
        #[map(program_sdk::accounts::Pool::mint, primary_key, strategy = SetOnce)]
        pub mint: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, Stream)]
    pub struct TokenState {
        #[map(program_sdk::accounts::Pool::reserves, strategy = LastWrite)]
        pub reserves: Option<u64>,

        #[snapshot(from = program_sdk::accounts::Pool, strategy = LastWrite)]
        pub pool: Option<Pool>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, Stream)]
    pub struct TokenMetrics {
        #[aggregate(from = program_sdk::instructions::Swap, field = args::amount, strategy = Sum, lookup_by = accounts::pool)]
        pub total_volume: Option<u64>,

        #[aggregate(from = program_sdk::instructions::Swap, strategy = Count, lookup_by = accounts::pool)]
        pub swap_count: Option<u64>,

        #[derive_from(from = [program_sdk::instructions::Swap], field = __timestamp)]
        pub last_trade_at: Option<i64>,
    }
}
```

Key rules:
- The SDK module name is derived from the IDL's program name: `program_name` becomes `program_name_sdk`
- Account paths: `program_sdk::accounts::AccountType::field_name`
- Instruction paths: `program_sdk::instructions::InstructionName`
- Every entity needs exactly one `primary_key` field
- Section structs must derive `Stream`, `Debug`, `Clone`, `Serialize`, `Deserialize`

### ⚠️ CRITICAL: Account & Instruction Connection Planning

Before writing ANY macro, you MUST map out the full connection graph between accounts, instructions, and your entities. The macros are resolved at build time — if a connection doesn't exist, the build will fail silently or produce wrong results.

**The `lookup_by` rule:** When you use `lookup_by = accounts::some_account` on an `#[aggregate]`, `#[event]`, `#[snapshot]`, or `#[derive_from]` macro, the account you reference in `lookup_by` MUST be an account that exists on that specific instruction. This is how Arete resolves "which entity does this instruction update belong to?" — it reads the account address from the instruction's account list and matches it to an entity's primary key or lookup index.

**Example of the connection logic:**
```
Entity: Token (primary_key = Pool::mint)
                 │
                 │  The entity is keyed by the `mint` field on Pool accounts.
                 │  So Arete knows: Pool address → mint → Token entity.
                 │
Macro: #[aggregate(from = instructions::Swap, lookup_by = accounts::pool)]
                 │
                 │  When a Swap instruction fires, Arete needs to know
                 │  WHICH Token entity to update. It does this by:
                 │    1. Reading the `pool` account address from the Swap instruction
                 │    2. Looking up what `mint` value that Pool account holds
                 │    3. Routing the update to the Token entity with that mint
                 │
                 └─ This ONLY works if `pool` is an actual account on the Swap instruction.
                    Use `a4 idl instruction idl/<program>.json Swap --json` to verify.
```

**Pre-flight checklist (do this for EVERY macro that uses `lookup_by` or `register_from`):**

1. **Identify the source instruction** — What instruction does `from = ...` point to?
2. **List its accounts** — Run `a4 idl instruction idl/<program>.json <InstructionName> --json` and confirm the account name you're using in `lookup_by` is present in the instruction's accounts list.
3. **Trace the resolution chain** — How does Arete go from that account address back to your entity's primary key? Either:
   - The account type is the same one that holds your `primary_key` field (direct resolution), OR
   - A `lookup_index` with `register_from` has been set up to map this account → primary key (PDA resolution).
4. **Verify with `a4 idl links`** — Run `a4 idl links idl/<program>.json <AccountA> <AccountB> --json` to confirm the connection path exists.

**Common mistakes:**
- Using `lookup_by = accounts::pool` on an instruction that doesn't have a `pool` account — build fails or silently drops data
- Forgetting to set up `register_from` when the `lookup_by` account is a PDA that doesn't directly contain the primary key
- Assuming an account name exists on all instructions — different instructions may name the same logical account differently (e.g., `pool` vs `amm` vs `market`)
- Not checking the IDL to see the exact account names — always use `a4 idl instruction idl/<program>.json <InstructionName>` to get the canonical names

**Enriching with off-chain data:** If the user needs data that isn't on-chain (token metadata, images from metadata URIs, external API data), use `#[resolve]`. Two resolver types are available:
- **Token metadata** — `#[resolve(address = "mint_addr")]` or `#[resolve(from = "id.mint")]` on an `Option<TokenMetadata>` field. Fetches name, symbol, decimals, logo from the DAS API. Also provides `ui_amount`/`raw_amount` computed methods for human-readable token amounts.
- **URL fetching** — `#[resolve(url = field.path, extract = "json.path")]` on any field. Fetches JSON from a URL stored in another entity field and extracts a value by path. Use for NFT images, off-chain config, API responses.

### Token Decimal Handling with `ui_amount`

On-chain token amounts are raw integers — you must divide by `10^decimals` to get a human-readable value. Arete makes this seamless via `ui_amount`, which works directly with the `TokenMetadata` resolver.

**The pattern:** resolve token metadata to get `decimals`, then reference it in `transform = ui_amount(...)` on any `#[map]` field:

```rust
use arete::resolvers::TokenMetadata;

// 1. Resolve token metadata — this fetches decimals (and name/symbol/logo) from DAS
#[resolve(from = "id.mint")]
pub token_metadata: Option<TokenMetadata>,

// 2. Map a raw on-chain amount and convert to UI amount in one step
#[map(program_sdk::accounts::Pool::reserves, strategy = LastWrite,
      transform = ui_amount(token_metadata.decimals))]
pub reserves: Option<f64>,   // stored and streamed as a human-readable float
```

Arete handles the rest: the raw `u64` is captured internally, divided by `10^decimals` at evaluation time, and only the float is delivered to clients. If `token_metadata` hasn't resolved yet, `reserves` is `null` rather than a wrong value.

**When decimals are known at build time** (e.g., SOL = 9, USDC = 6), skip the resolver and pass the literal directly:

```rust
#[map(program_sdk::accounts::Pool::sol_amount, strategy = LastWrite,
      transform = ui_amount(9))]
pub sol_amount: Option<f64>,
```

**For computed fields or applying `ui_amount` to a list**, use `#[computed]`:

```rust
// Inline on a computed field
#[computed(state.reserves_raw.ui_amount(token_metadata.decimals))]
pub reserves_ui: Option<f64>,

// Apply to every element of a Vec
#[computed(state.balances_raw.map(|x| x.ui_amount(token_metadata.decimals)))]
pub balances_ui: Option<Vec<f64>>,
```

The inverse `raw_amount` converts back from UI float to raw integer when needed (e.g., building instructions):

```rust
#[computed(state.deposit_ui.raw_amount(token_metadata.decimals))]
pub deposit_raw: Option<u64>,
```

See `references/dsl-reference.md` for every macro, strategy, transform, resolver, and cross-account resolution pattern.

## 6. Build & Deploy

```bash
cargo build                          # generates .arete/*.stack.json
a4 auth login                        # authenticate
a4 up my-stack                       # push + build + deploy
a4 sdk create typescript my-stack    # generate SDK
a4 status                            # verify
a4 explore my-stack --json           # inspect live schema
```

Branch deploys: `a4 up my-stack --branch staging` / `a4 stack stop my-stack --branch staging`.

See `references/cli-reference.md` for full CLI options.
