// Pattern: a PDA the catalog IDL doesn't name yet. Until the program's
// catalog IDL gains it (then `pda("<alias>", "<name>", seeds...)` derives
// it), the creator passes the address and the create step binds it, so
// every later step reads it from the instance.
import { builtins, defineProtocol, ix } from "@usearete/protocol";

const { splToken } = builtins("splToken");

export default defineProtocol({
  name: "missingPdaPattern",
  version: "0.1.0",
  programs: { splToken },
  instanceVisibility: "shared",
  params: { mint: "pubkey" },
  roles: { owner: { description: "Opened the instance." } },
  machines: {
    instance: { initial: "open", states: { open: "recorded", closed: { kind: "recorded", terminal: true } } },
    participant: { initial: "member", states: { member: { kind: "recorded", terminal: true } } },
  },
  steps: {
    open: {
      scope: "create",
      authority: "creator",
      // The venue's authority PDA, derived off-chain from the program's docs.
      args: { mint: "pubkey", marketAuthority: "pubkey" },
      bind: {
        accounts: { creator: "wallet", marketAuthority: "args.marketAuthority" },
        roles: { owner: "wallet" },
      },
      build: [],
    },
    approve: {
      scope: "participant",
      authority: "participant",
      args: { amount: "u64" },
      guards: { amount_zero: "args.amount > 0", not_open: 'instance.state == "open"' },
      transitions: [{ machine: "participant", from: ["member"], to: "member" }],
      build: [
        ix(splToken, "Approve", {
          args: { amount: "args.amount" },
          accounts: {
            source: "ata(wallet, params.mint)",
            delegate: "instance.accounts.marketAuthority",
            owner: "wallet",
          },
        }),
      ],
    },
    close: {
      scope: "instance",
      authority: { kind: "role", role: "owner" },
      guards: { not_owner: "wallet == instance.roles.owner" },
      transitions: [{ from: ["open"], to: "closed" }],
      build: [],
    },
  },
});
