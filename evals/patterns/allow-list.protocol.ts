// Pattern: an allow-list. A guard with `in` refuses any mint outside a list
// the deployment sets (`[protocol.resources] allowedMints = "mints.json"`).
import { builtins, defineProtocol, ix } from "@usearete/protocol";

const { splToken } = builtins("splToken");

export default defineProtocol({
  name: "allowListPattern",
  version: "0.1.0",
  programs: { splToken },
  instanceVisibility: "shared",
  roles: { recipient: { description: "Receives the deposits." } },
  resources: {
    allowedMints: {
      schema: { type: "array", items: { type: "string", format: "pubkey" }, maxItems: 8 },
      description: "The mints this deployment accepts.",
    },
  },
  machines: {
    instance: { initial: "open", states: { open: "recorded", closed: { kind: "recorded", terminal: true } } },
    participant: { initial: "depositor", states: { depositor: { kind: "recorded", terminal: true } } },
  },
  steps: {
    open: {
      scope: "create",
      authority: "creator",
      args: { recipient: "pubkey" },
      bind: { accounts: { creator: "wallet" }, roles: { recipient: "args.recipient" } },
      build: [],
    },
    deposit: {
      scope: "participant",
      authority: "participant",
      args: { mint: "pubkey", amount: "u64", decimals: "u8" },
      guards: {
        mint_not_allowed: "args.mint in resources.allowedMints",
        amount_zero: "args.amount > 0",
        not_open: 'instance.state == "open"',
      },
      transitions: [{ machine: "participant", from: ["depositor"], to: "depositor" }],
      glue: { atas: [{ owner: "instance.roles.recipient", mint: "args.mint" }] },
      build: [
        ix(splToken, "TransferChecked", {
          args: { amount: "args.amount", decimals: "args.decimals" },
          accounts: {
            source: "ata(wallet, args.mint)",
            mint: "args.mint",
            destination: "ata(instance.roles.recipient, args.mint)",
            owner: "wallet",
          },
        }),
      ],
    },
    close: {
      scope: "instance",
      authority: { kind: "role", role: "recipient" },
      guards: { not_recipient: "wallet == instance.roles.recipient" },
      transitions: [{ from: ["open"], to: "closed" }],
      build: [],
    },
  },
});
