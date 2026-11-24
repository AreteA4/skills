---
name: arete-sandbox
description: Act from an Arete sandbox, a funded Solana wallet the agent uses without holding its key, inside rules its owner signed. Use when the sandbox_* MCP tools are listed, or when the user asks the agent to choose a sandbox, trade, swap, lend or deposit (Kamino Lend and similar), withdraw, check a sandbox's balance, holdings, rules or history, read program accounts or live views through a sandbox, or explain a sandbox refusal. Covers listing and selecting sandboxes, the discover → preview → invoke loop, program functions that plan a whole action, finding accounts, refusals and retries, sandbox-scoped reads, and a4 sandbox. Do not use for protocol steps, dev environments or app wallets; use arete-protocols or arete-programs for those.
metadata:
  version: "1.3.0"
  min-cli: ">=0.61.0"
---

# Act from an Arete sandbox

A sandbox is a hosted Solana wallet you use without ever holding its key. Its
owner funded it, chose the programs and instructions it may use, set spend
limits and allowed destinations, signed those rules, and granted your agent
account a set of actions. You name an action and its arguments; Arete builds
the transaction, checks it against the rules, signs it and sends it.

You never see a private key, a transaction to sign or an RPC URL, and you
never need one. Never ask the owner for a private key or for their own API
key.

## Setup

The Arete MCP server (`a4 mcp`) lists the `sandbox_*` tools whenever it has
the agent account's key. You need no sandbox id: the server asks Arete which
sandboxes your account has been granted.

- No `sandbox_*` tools: the server has no agent key. Check
  `a4 --profile agent auth status`, or set `ARETE_API_KEY` to the agent
  account's secret key in the server's environment.
- `sandbox-agent-key-required`: the same; log in as the agent.

Owner operations (rules, grants, pause, revoke) are not available to you.
When something needs one, say what the owner should change.

In a bug report, include the output of `a4 version` (or the MCP `version`
tool): the client version and the build of the Arete API it talks to.

## Choose the sandbox

1. `sandbox_list`: the sandboxes granted to you (id, name, wallet, cluster,
   status, actions) and the one in use.
2. Exactly one active sandbox: every tool uses it. Nothing to choose.
3. Several: `sandbox_select` with `sandbox` (an id or a name) chooses one for
   every later call; the choice is saved for the project, so it survives
   restarts. `clear: true` forgets it. When the user names a sandbox for one
   task only, pass `sandbox` on those calls instead.

Each call uses the first of: its own `sandbox` argument, the saved choice,
`ARETE_SANDBOX_ID` (a legacy fallback some setups still have), then the only
active sandbox granted. `sandbox_status` reports which one it used
(`selection`). Never guess between several sandboxes: ask the user which one
the task is for.

| Code                         | What to do                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- |
| `sandbox-selection-required` | Several are granted and none chosen: `sandbox_list`, then `sandbox_select` |
| `sandbox-none-granted`       | Nothing granted yet: ask the owner to grant this agent a sandbox           |
| `sandbox-unknown`            | The `sandbox` you passed matches no grant: check `sandbox_list`            |
| `sandbox-paused`             | Every grant is paused: tell the user; only the owner can resume            |
| `sandbox-not-configured`     | The API cannot list grants (older server): pass a sandbox id               |

From a shell, `a4 sandbox list` and `a4 sandbox use <id|name>` do the same and
share the saved choice with `a4 mcp` started in the same folder.

## The loop: discover → preview → invoke

1. `sandbox_status`: which sandbox this is, the wallet address, balances and
   the actions you hold (`invoke`, `withdraw`). Start here.
2. `sandbox_rules`: the enabled programs, each instruction's arguments and
   accounts, the program's `functions`, spend limits, the allowlist and the
   baseline. Use only what it lists, named exactly as it names them. When a
   program lists a function for what you want to do, use it (see Functions
   below) instead of assembling the instructions yourself.
3. `sandbox_derive` when you need an address: `kind: "pda"` with `programId`
   and `seeds` (computed locally), or `kind: "ata"` with `mint`.
   `sandbox_find_accounts` finds the account an action starts from (a pool,
   pair, reserve or vault) by the addresses it holds.
4. `sandbox_preview` with the action and arguments. It runs every check and
   signs nothing. It returns `pass` with what the wallet would lose, or the
   refusal.
5. `sandbox_invoke` with the same arguments. It is the only tool that moves
   funds.

Always preview before invoking. Tell the user what the wallet would lose
before you run anything they did not explicitly ask for.

## Actions

| `action`   | `args`                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `invoke`   | `{ instructions: [{ program, instruction, args?, accounts?, remainingAccounts? }], computeUnitLimit?, computeUnitPriceMicroLamports?, transactionFormat? }` |
| `call`     | `{ program, function, input, computeUnitLimit?, computeUnitPriceMicroLamports?, transactionFormat? }`: a program function that plans the whole action     |
| `withdraw` | `{ lamports, transactionFormat? }`: SOL to the owner's wallet, the only destination                                                                         |

- `invoke` takes 1 to 32 instructions, as long as they fit one transaction:
  4096 bytes and 64 accounts for v1 (the default), 1232 bytes for v0. The
  sandbox wallet is the only signer.
- `program`, in `invoke` and `call`, is the base58 program id or a name: the
  display name, the IDL name (`kamino_lending`, `pump_amm`) or the baseline
  name. Case, spaces, `-` and `_` are ignored. An unknown or ambiguous name
  is refused with `sandbox-intent-invalid` and `candidates`: pick one.
- `call` needs the `invoke` grant. Older a4 releases do not offer it; then
  use `invoke`, following the order in the refusals.
- Accounts with a `fill` in `sandbox_rules` can be left out (see Finding
  accounts below).
- In `invoke`, pass u64 and u128 amounts as decimal strings, in the smallest
  unit.

## Functions

Some programs need more than one instruction for one action, in an exact
order, with setup that depends on live state. `sandbox_rules` lists a
program's `functions` when Arete can plan them: it reads the chain, emits
every instruction in the right order, fills the accounts and fills the
sandbox wallet in as the signer. Every instruction a function plans is
still checked against the rules, like an `invoke`. Functions are not only
for Kamino Lend: check `functions` on every program you use.

Each function has a `name`, a `summary` and an `input` schema. Read the
schema instead of guessing the input:

- `fields`: each with `name`, `type` (`pubkey`, `amount`, `bool`, `string`,
  an integer width or `enum`) and `required`, and where they apply `fill`
  (`wallet`: leave it out), `units` (the token a `ui` amount is in),
  `default`, `values` (literals besides the type, such as `"max"`) and
  `variants` (the strings an `enum` takes).
- `unknownFields`: `refused` (a field the schema does not list is an error)
  or `ignored`.

An `amount` is `{ "ui": "0.1" }` in whole units of the field's `units`
token, `{ "raw": "100000000" }` in base units, or a bare integer in base
units. A bare decimal string such as `"0.1"` is refused, like any input that
does not match the schema (`sandbox-function-input-invalid`).

Kamino Lend (`KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`) deposit:

```json
{
  "action": "call",
  "args": {
    "program": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
    "function": "transactions.obligation.deposit",
    "input": { "reserve": "<reserve address>", "amount": { "ui": "0.1" } }
  }
}
```

- `transactions.obligation.deposit`, `.withdraw`, `.borrow`, `.repay` take
  `reserve` and `amount` (`units`: the reserve's token); `withdraw` and
  `repay` also take `"max"`. The optional fields are in `input`.
- A deposit creates the obligation, the user metadata and the reserve's
  farm state when they are missing, refreshes the reserves and the
  obligation, and wraps SOL from the wallet for a SOL reserve. It works for
  reserves with and without farms.
- Preview with `action: "call"` first, as with any action. The preview's
  `plan` names the function and the slot it read.

A function needs every instruction it builds, inner instructions (CPIs)
included, to be allowed by the rules. `sandbox_rules` adds
`missingInstructions` to a function that needs one they do not allow, and a
call to it is refused with `sandbox-function-instruction-not-allowlisted`
before anything is planned. Only the owner can allow it; until then use
another function or an `invoke` of allowed instructions.

If you must use `invoke` for Kamino Lend, prefer the `...V2` instructions
(`depositReserveLiquidityAndObligationCollateralV2`,
`withdrawObligationCollateralAndRedeemReserveCollateralV2`): they refresh the
farm themselves. The v1 instructions only run when the instructions right
before and after them are the exact refreshes Kamino checks, and a preview
refuses a wrong order with `sandbox-kamino-refresh-sequence`, naming the
missing instruction and where it goes.

## Finding accounts

You need no SDK to fill an instruction's accounts. Arete fills every account
with a `fill` in `sandbox_rules`:

- `fixed`: the IDL's address, a sysvar, a native program or the program
  itself;
- `wallet`: the sandbox wallet;
- `derived`: the spec's PDAs, the event authority, a mint's token program
  (`base_token_program` from `base_mint`), and your associated token account
  for a mint (`user_base_token_account`);
- `read`: a field of another account you give (`pool.base_mint`).

Fills chain: give the account an action starts from (a pool, a pair, a
reserve) and Arete reads and derives the rest. Leave filled accounts out,
and check `instructions[].filled` in the preview.

An account with no `fill` has a `lookup`. Use it in this order:

1. `docs`: what the IDL says, such as a PDA's seeds. Derive a PDA with
   `sandbox_derive`.
2. `tokenAccountFor`: it is your token account for one of those mints,
   usually the associated token account (`sandbox_derive` with
   `kind: "ata"`). Create it with the baseline `createIdempotent` in the same
   action if it doesn't exist.
3. `heldBy`: read an account of that type with `program_read_account` and
   take the address from the named field.
4. `search`: the account can be searched for. Call `sandbox_find_accounts`
   with `program`, the search's `type` and `fields` holding the addresses
   you know (`a4 sandbox accounts <program> <Type> --field k=v [--any-order]`).
   It finds the account an action starts from (a pool, pair, reserve or
   vault) by the addresses it holds, using the sandbox's chain. Pools with
   zero liquidity come last, and size-ranked types such as Kamino vaults
   come largest first. Pass `anyOrder: true` when either field may hold
   either address (a DLMM pair's two mints).
5. `accountType`: an account of that type. Take it from what you already
   know (a quote, an API, an earlier transaction), from a stack you can read
   through the sandbox, or, as a fallback, search the program with your own
   RPC: `getProgramAccounts` with a memcmp for `discriminator` at offset 0
   and one for each `findBy` field you know (for a PumpSwap `Pool`,
   `base_mint` at offset 43).
6. Otherwise follow `how`: the protocol's docs, SDK or API.

`unlocks` lists what Arete fills once you give the account, so give the ones
that unlock the most first.

A preview missing accounts is refused with `sandbox-intent-invalid`. The
message leads with what you must find, then what Arete fills once those are
given. `accountGuidance` has one entry per missing account: its `lookup`, or
`waitingOn` for an account Arete will fill. Give the first group and preview
again.

Arete resolves Orca Whirlpool and Raydium CLMM tick arrays and Meteora DLMM
bin arrays itself, from live state, at preview and at invoke: leave them
out. Other accounts that depend on live state or on the direction of a trade
(which vault is the input) stay yours. Take them from the venue's quote or
API just before you act, or use a Jupiter route (see Swaps).

## Swaps

There is no swap action. A swap is an `invoke` of the instructions that make
it, checked like any other:

1. Resolve the venue.
   - A venue's own instructions, when you know the pool: Pump.fun
     `buy`/`sell` on the bonding curve, PumpSwap (pump-amm) `buy`/`sell`
     for a Pump.fun coin that has graduated, or a DEX's own swap
     instruction. Prefer this when it is enough.
   - A Jupiter route, for the best price across venues. When the rules
     allow one, `sandbox_rules` carries a `jupiterSwap` guide: `buildUrl`
     (Jupiter Swap API v2 `/build`), a `query` with the sandbox wallet as
     taker and payer, `transactionVersion=1`, `maxAccounts=50`,
     `wrapAndUnwrapSol=true` and `dexes` limited to the venues the rules
     allow, and `steps`. Follow it instead of a quote and
     `/swap-instructions`, and send the route as one `invoke`.
2. Write the `invoke`: each instruction named as `sandbox_rules` lists it
   (Jupiter's swap is one of its listed instructions, such as `route_v2`),
   `args` decoded from the instruction data with the IDL types
   `sandbox_rules` gives, the named accounts, and the route's extra accounts
   in `remainingAccounts`. Setup such as creating a token account or wrapping
   SOL is baseline: put it in the same action, in order.
3. `sandbox_preview` with `action: "invoke"` until it passes, then
   `sandbox_invoke` with the same arguments.

If a preview refuses a venue's program or instruction, the rules do not
allow it: try a venue they do allow, or tell the owner what to enable.

## Exactly once

Every `sandbox_invoke` runs under an idempotency key: pass your own
(`idempotencyKey`, 1 to 128 characters) or use the generated one it returns.
A key never runs twice.

After a timeout or a `retryable: true` error on `sandbox_invoke`, the action
may have run. Before anything else, call `sandbox_action` with the
`idempotencyKey`:

- it ran: do not repeat it;
- it was refused: fix the request and retry with a new key;
- no action has the key: retry with the same key.

From a shell, `a4 sandbox action --idempotency-key <key>` looks it up.

## Refusals

Every `sandbox_*` error has `code`, `retryable` and a `hint`; a refusal also
names the `rule` and what triggered it (`program`, `instruction`, `mint`,
`attempted`, `cap`, `remaining`). Follow the hint.

- `retryable: false`: the same call fails again. Change the request first.
- `retryable: true` on a read or `sandbox_preview`: retry the same call after
  `retryAfterSeconds`.
- `sandbox-guard-insufficient-funds`: the wallet cannot pay. Report
  `balanceLamports` and `shortfallLamports`; spend less or ask the owner to
  fund it.
- Over a spend limit: use at most `remaining`.
- `sandbox-program-not-allowlisted`, `sandbox-instruction-not-allowlisted`,
  `sandbox-action-not-granted`: only the owner can change these. Do not try to
  route around them.
- `sandbox-kamino-refresh-sequence`: a Kamino Lend v1 instruction is missing
  a refresh right before or after it. The message names the instruction and
  its position. Use the program's function (`call`) or the v2 instruction.
- `sandbox-function-not-allowlisted`: the owner's rules name other functions
  for that program; use those, or `invoke`.
- `sandbox-function-instruction-not-allowlisted`: the function needs an
  instruction the rules do not allow (`missingInstructions`); use another
  function or `invoke` until the owner allows it.
- `sandbox-guard-trial-failed`: the transaction fails when run; check
  accounts and amounts against `sandbox_rules` and `sandbox_holdings`.
- `sandbox-paused`: stop and tell the user; only the owner can resume.

A refused `call` reports `stages` (each stage it passed, then the one that
refused it), `failedStage` and `plan` (as far as it got). Follow its `hint`:
it names the a4 command or MCP tool to run. Before anything is built, the
`plan` stage checks the chain and refuses:

| Code                                      | What to do                                   |
| ----------------------------------------- | -------------------------------------------- |
| `sandbox-plan-insufficient-token-balance` | Fund or wrap the token first                 |
| `sandbox-plan-account-not-initialized`    | Run what `createdBy` names first             |
| `sandbox-plan-pool-no-liquidity`          | Pick another pool                            |
| `sandbox-plan-seat-not-claimed`           | Run `transactions.market.setUpTrader` first  |
| `sandbox-plan-amount-below-minimum`       | Raise the amount to at least `minimumAmount` |

Never try to get funds to an address the rules do not allow, change an
authority or delegate, or split an action to slip under a limit.

## What the rules do not decide

The rules decide where funds may go, not whether a trade is good. Price,
slippage within what the owner allowed, and losses are yours to manage. Exits
are always allowed: you may always sell a token the sandbox bought.

## Reading through the sandbox

The sandbox's rules decide what you can read as well as what you can do.
`sandbox_reads` lists the programs you can read: exactly the programs the
rules enable. Then read through the sandbox:

- `program_read_account` with `address` (and optional `program`, `account`)
  decodes one account of a program in the rules.
- `read_view`, or `connect` then `subscribe`, reads a stack's live views; a
  stack opens only when every program it decodes is in the rules.

Each takes `sandbox` like the sandbox tools. If your account can only read
through sandboxes, they use the selected sandbox even without it, and are
refused with the selection codes above when none resolves; they never fall
back to your own key. A program outside the rules is refused with
`sandbox-program-not-allowlisted`, naming the `programs` left out; only the
owner can add them. A followed view stops within about a minute when the
owner changes the rules, pauses the sandbox or revokes your access.

From a shell:

```bash
a4 sandbox reads --json
a4 program account decode <address> --sandbox <id|name> --json
a4 get <Entity>/<view> --stack <stack> --sandbox <id|name> --limit 1
a4 stream <Entity>/<view> --stack <stack> --sandbox <id|name>
```

## History, holdings and the shell

`sandbox_history` and `sandbox_holdings` are read-only. Without a stdio MCP
server, the same loop runs in one-shot commands that send the same actions
and return the same results and refusals (`--json` prints them as the tools
do):

```bash
a4 sandbox list                            # granted sandboxes; * marks the one in use
a4 sandbox history --json                  # newest first, 20 per page
a4 sandbox history --status landed --since 24h --json
a4 sandbox holdings --json
a4 sandbox rules show --json
a4 sandbox accounts <program> <Type> --field <field>=<address> [--any-order]
a4 sandbox preview --call <program> <function> --input <json|@file>
a4 sandbox preview --invoke <json|@file>
a4 sandbox preview --withdraw <lamports>
a4 sandbox invoke --call <program> <function> --input <json|@file>   # same flags as preview
a4 sandbox action --idempotency-key <key>
a4 version                                 # client version and API build, for bug reports
```

Each `a4 sandbox` command takes `--sandbox <id|name>` for that command
alone.

Holdings list SOL, tokens and program positions: decoded Kamino and Save
obligations, volume accumulators and Kamino vault shares (`shareOf`).
`reclaimableRent` says which instruction returns an account's rent, and
appears only where the rules can allow that instruction.

Each history item has its status, decoded instructions, the Anchor events the
programs emitted, SOL and token changes and the accounts touched. Refusals
are recorded too. Use history to answer "what did you do" questions, and cite
the signature for landed actions.

`a4 sandbox rules validate <file>` checks a Rules v3 document locally, for an
owner drafting rules by hand. Nothing is sent.

## Docs

- https://docs.arete.run/sandboxes/overview/
- https://docs.arete.run/sandboxes/actions/
- https://docs.arete.run/sandboxes/accounts/
- https://docs.arete.run/sandboxes/errors/
- https://docs.arete.run/sandboxes/read-scope/
