// Pattern: state-only steps. A template with no instructions sends only the
// attested memo; its transitions apply when that transaction confirms. Use
// it for pause, resume and close instead of a placeholder instruction.
import { builtins, defineProtocol, ix } from "@usearete/protocol";

const { system } = builtins("system");

export default defineProtocol({
  name: "stateOnlyPattern",
  version: "0.1.0",
  programs: { system },
  instanceVisibility: "shared",
  roles: { owner: { description: "Pauses, resumes and closes the jar." } },
  machines: {
    instance: {
      initial: "open",
      states: { open: "recorded", paused: "recorded", closed: { kind: "recorded", terminal: true } },
    },
    participant: { initial: "supporter", states: { supporter: { kind: "recorded", terminal: true } } },
  },
  steps: {
    open: {
      scope: "create",
      authority: "creator",
      bind: { accounts: { creator: "wallet" }, roles: { owner: "wallet" } },
      build: [],
    },
    tip: {
      scope: "participant",
      authority: "participant",
      args: { amount: "u64" },
      guards: { amount_zero: "args.amount > 0", not_open: 'instance.state == "open"' },
      transitions: [{ machine: "participant", from: ["supporter"], to: "supporter" }],
      build: [
        ix(system, "transfer", {
          args: { lamports: "args.amount" },
          accounts: { fundingAccount: "wallet", recipientAccount: "instance.roles.owner" },
        }),
      ],
    },
    pause: {
      scope: "instance",
      authority: { kind: "role", role: "owner" },
      guards: { not_owner: "wallet == instance.roles.owner" },
      transitions: [{ from: ["open"], to: "paused" }],
      build: [],
    },
    resume: {
      scope: "instance",
      authority: { kind: "role", role: "owner" },
      guards: { not_owner: "wallet == instance.roles.owner" },
      transitions: [{ from: ["paused"], to: "open" }],
      build: [],
    },
    close: {
      scope: "instance",
      authority: { kind: "role", role: "owner" },
      guards: { not_owner: "wallet == instance.roles.owner" },
      transitions: [{ from: ["open", "paused"], to: "closed" }],
      build: [],
    },
  },
});
