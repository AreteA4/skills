// Pattern: one of several venues. The deployment lists the venues as an
// array resource; a step names a venue with a literal index, or takes it as
// an argument checked with `in` against the listed entries.
import { builtins, defineProtocol, ix } from "@usearete/protocol";

const { system } = builtins("system");

export default defineProtocol({
  name: "venuesPattern",
  version: "0.1.0",
  programs: { system },
  instanceVisibility: "shared",
  resources: {
    venues: {
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: { vault: { type: "string", format: "pubkey" } },
          required: ["vault"],
          additionalProperties: false,
        },
        maxItems: 2,
      },
      description: "The venues this deployment routes to, in a fixed order: [primary, fallback].",
    },
  },
  machines: {
    instance: { initial: "open", states: { open: "recorded", closed: { kind: "recorded", terminal: true } } },
    participant: { initial: "saver", states: { saver: { kind: "recorded", terminal: true } } },
  },
  steps: {
    open: {
      scope: "create",
      authority: "creator",
      bind: { accounts: { creator: "wallet" }, roles: { operator: "wallet" } },
      build: [],
    },
    // A fixed venue: a literal index, typed from the array's item schema.
    depositPrimary: {
      scope: "participant",
      authority: "participant",
      args: { amount: "u64" },
      guards: { amount_zero: "args.amount > 0", not_open: 'instance.state == "open"' },
      transitions: [{ machine: "participant", from: ["saver"], to: "saver" }],
      build: [
        ix(system, "transfer", {
          args: { lamports: "args.amount" },
          accounts: { fundingAccount: "wallet", recipientAccount: "resources.venues[0].vault" },
        }),
      ],
    },
    // The caller picks the venue; the guard keeps it to the listed ones.
    deposit: {
      scope: "participant",
      authority: "participant",
      args: { vault: "pubkey", amount: "u64" },
      guards: {
        unknown_venue: "args.vault in [resources.venues[0].vault, resources.venues[1].vault]",
        amount_zero: "args.amount > 0",
        not_open: 'instance.state == "open"',
      },
      transitions: [{ machine: "participant", from: ["saver"], to: "saver" }],
      build: [
        ix(system, "transfer", {
          args: { lamports: "args.amount" },
          accounts: { fundingAccount: "wallet", recipientAccount: "args.vault" },
        }),
      ],
    },
    close: {
      scope: "instance",
      authority: { kind: "role", role: "operator" },
      guards: { not_operator: "wallet == instance.roles.operator" },
      transitions: [{ from: ["open"], to: "closed" }],
      build: [],
    },
  },
  roles: { operator: { description: "Closes the instance." } },
});
