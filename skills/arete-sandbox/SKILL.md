---
name: arete-sandbox
description: Act from an Arete sandbox, a funded Solana wallet the agent uses without holding its key, inside rules its owner signed. Use when the sandbox_* MCP tools are listed, or when the user asks the agent to choose a sandbox, trade, swap, withdraw, check a sandbox's balance, holdings, rules or history, read program accounts or live views through a sandbox, or explain a sandbox refusal. Covers listing and selecting sandboxes, the discover → preview → invoke loop, refusals and retries, sandbox-scoped reads, and a4 sandbox. Do not use for protocol steps, dev environments or app wallets; use arete-protocols or arete-programs for those.
metadata:
  version: "1.1.0"
  min-cli: ">=0.55.0"
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
   accounts, spend limits, the allowlist and the baseline. Use only what it
   lists, named exactly as it names them.
3. `sandbox_derive` when you need an address: `kind: "pda"` with `programId`
   and `seeds` (computed locally), or `kind: "ata"` with `mint`.
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
| `withdraw` | `{ lamports, transactionFormat? }`: SOL to the owner's wallet, the only destination                                                                         |

- `invoke` takes 1 to 8 instructions. The sandbox wallet is the only signer.
- Accounts with a `fill` in `sandbox_rules` (`fixed`, `wallet`, `derived`)
  can be left out. A refusal's `missingAccounts` lists the ones still needed.
- Pass u64 and u128 amounts as decimal strings, in the smallest unit.

## Swaps

There is no swap action. A swap is an `invoke` of the instructions that make
it, checked like any other:

1. Resolve the venue.
   - A venue's own instructions, when you know the pool: PumpSwap (pump-amm)
     `buy`/`sell` for a coin that has left its Pump.fun bonding curve,
     Pump.fun `buy`/`sell` on the curve, or a DEX's own swap instruction.
     Prefer this when it is enough.
   - A Jupiter route, for the best price across venues: quote with Jupiter's
     Swap API (about 50 `maxAccounts`, so it fits a v1 transaction: 64
     accounts, no lookup tables), then `/swap-instructions` with the sandbox
     wallet as the user. Routes fill only through venues the rules enable.
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
- `sandbox-guard-trial-failed`: the transaction fails when run; check
  accounts and amounts against `sandbox_rules` and `sandbox_holdings`.
- `sandbox-paused`: stop and tell the user; only the owner can resume.

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

## History and holdings

`sandbox_history` and `sandbox_holdings` are read-only. From a shell:

```bash
a4 sandbox list                            # granted sandboxes; * marks the one in use
a4 sandbox history --json                  # newest first, 20 per page
a4 sandbox history --status landed --since 24h --json
a4 sandbox holdings --json
a4 sandbox rules show --json
```

Each takes `--sandbox <id|name>` for that command alone.

Each history item has its status, decoded instructions, the Anchor events the
programs emitted, SOL and token changes and the accounts touched. Refusals
are recorded too. Use history to answer "what did you do" questions, and cite
the signature for landed actions.

`a4 sandbox rules validate <file>` checks a Rules v3 document locally, for an
owner drafting rules by hand. Nothing is sent.

## Docs

- https://docs.arete.run/sandboxes/overview/
- https://docs.arete.run/sandboxes/actions/
- https://docs.arete.run/sandboxes/errors/
- https://docs.arete.run/sandboxes/read-scope/
