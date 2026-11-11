---
name: arete-sandbox
description: Act from an Arete sandbox, a funded Solana wallet the agent uses without holding its key, inside rules its owner signed. Use when ARETE_SANDBOX_ID is set or the sandbox_* MCP tools are listed, or when the user asks the agent to trade, swap, withdraw, check a sandbox's balance, holdings, rules or history, or explain a sandbox refusal. Covers the discover → preview → invoke loop, refusals and retries, and reading history with a4 sandbox. Do not use for protocol steps, dev environments or app wallets; use arete-protocols or arete-programs for those.
metadata:
  version: "1.0.0"
  min-cli: ">=0.54.1"
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

The `sandbox_*` tools are listed by the Arete MCP server (`a4 mcp`) only when
`ARETE_SANDBOX_ID` names a sandbox whose owner granted your account access.

- No `sandbox_*` tools: ask the owner for the sandbox id and set
  `ARETE_SANDBOX_ID` in the `env` of the `arete` MCP server, then have the
  host restart it.
- `sandbox-grant-missing`: the owner has not granted your account yet. Tell
  them to grant it on the sandbox's page in the dashboard.
- `sandbox-agent-key-required`: the server has no agent key. Log in as the
  agent (`a4 --profile agent auth status`) or set `ARETE_API_KEY` to the agent
  account's secret key in the server's environment.

Owner operations (rules, grants, pause, revoke) are not available to you.
When something needs one, say what the owner should change.

## The loop: discover → preview → invoke

1. `sandbox_status`: the wallet address, balances and the actions you hold
   (`invoke`, `swap`, `withdraw`). Start here.
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
| `swap`     | `{ inputMint, outputMint, amount, slippageBps?, computeUnitLimit?, computeUnitPriceMicroLamports? }`                                                         |
| `withdraw` | `{ lamports, transactionFormat? }`: SOL to the owner's wallet, the only destination                                                                         |

- `invoke` takes 1 to 8 instructions. The sandbox wallet is the only signer.
- Accounts with a `fill` in `sandbox_rules` (`fixed`, `wallet`, `derived`)
  can be left out. A refusal's `missingAccounts` lists the ones still needed.
- Pass u64 and u128 amounts as decimal strings, in the smallest unit.
- `swap` amounts are in the input mint's smallest unit.

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

## History and holdings

`sandbox_history` and `sandbox_holdings` are read-only. From a shell:

```bash
a4 sandbox history --json                  # newest first, 20 per page
a4 sandbox history --status landed --since 24h --json
a4 sandbox holdings --json
a4 sandbox rules show --json
```

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
