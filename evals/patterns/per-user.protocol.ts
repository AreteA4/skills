// Pattern: per-user accounts. Each wallet that joins gets a participant
// record; its token accounts are derived from the wallet with `ata(...)`,
// never passed in. The recipient's account is created idempotently by an
// `associatedToken` instruction (or `glue.atas`).
import { builtins, defineProtocol, ix } from "@usearete/protocol";

const { associatedToken, splToken, system } = builtins("associatedToken", "splToken", "system");

export default defineProtocol({
  name: "perUserPattern",
  version: "0.1.0",
  programs: { associatedToken, splToken, system },
  instanceVisibility: "shared",
  params: { mint: "pubkey", decimals: "u8" },
  roles: { recipient: { description: "Receives the contributions." } },
  machines: {
    instance: { initial: "open", states: { open: "recorded", closed: { kind: "recorded", terminal: true } } },
    participant: {
      initial: "member",
      states: { member: "recorded", left: { kind: "recorded", terminal: true } },
    },
  },
  steps: {
    open: {
      scope: "create",
      authority: "creator",
      args: { recipient: "pubkey", mint: "pubkey", decimals: "u8" },
      bind: { accounts: { creator: "wallet" }, roles: { recipient: "args.recipient" } },
      build: [
        ix(associatedToken, "createIdempotent", {
          accounts: {
            fundingAddress: "wallet",
            associatedTokenAccountAddress: "ata(args.recipient, args.mint)",
            walletAddress: "args.recipient",
            tokenMintAddress: "args.mint",
            systemProgram: '"11111111111111111111111111111111"',
            tokenProgram: '"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"',
          },
        }),
      ],
    },
    contribute: {
      scope: "participant",
      authority: "participant",
      args: { amount: "u64" },
      guards: { amount_zero: "args.amount > 0", not_open: 'instance.state == "open"' },
      transitions: [{ machine: "participant", from: ["member"], to: "member" }],
      build: [
        ix(splToken, "TransferChecked", {
          args: { amount: "args.amount", decimals: "params.decimals" },
          accounts: {
            source: "ata(wallet, params.mint)",
            mint: "params.mint",
            destination: "ata(instance.roles.recipient, params.mint)",
            owner: "wallet",
          },
        }),
      ],
    },
    // State-only: the participant record moves; nothing moves on chain.
    leave: {
      scope: "participant",
      authority: "participant",
      guards: { not_member: 'participant.state == "member"' },
      transitions: [{ machine: "participant", from: ["member"], to: "left" }],
      build: [],
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
