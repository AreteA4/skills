# React Program Operations

Generated program operations exposed by `useArete` provide fluent `.useMutation()` hooks. A stack's program SDKs are at `arete.programs.<name>`, so a component that renders the stack's views calls its operations from the same `useArete` result.

```tsx
const arete = useArete(MY_STACK);
const deposit = arete.programs.myProgram.transactions.deposit.useMutation();

async function submit() {
  await deposit.submit(
    { owner, amount: { ui: amount } },
    { reconcile: { refresh: [position] } },
  );
}
```

Call the hook unconditionally. Trigger `submit` only from an authorized user action.

## Mutation Phases

Branch the UI on `phase`. These are all of its values:

| Phase | Meaning |
| --- | --- |
| `idle` | Nothing submitted yet, or `reset()` was called |
| `preparing` | Building the operation before the wallet is involved |
| `awaiting-wallet` | The wallet is signing, and the adapter is sending and confirming |
| `submitted` | A transaction's receipt landed; a multi-transaction flow returns to `awaiting-wallet` for the next one |
| `confirmed` | Every transaction confirmed on chain |
| `reconciling` | Waiting for the stream to reach the confirmed slot, then refreshing the supplied targets |
| `reconciled` | The stream caught up and the refreshes completed |
| `confirmed-unreconciled` | Confirmed on chain, but reconciliation timed out or failed; see `reconciliationError` |
| `not-submitted` | Failed before anything reached the network: preparation, wallet rejection, or a definite send refusal |
| `submitted-unknown` | The transaction may have been sent; check `signature` before any retry, and never resend blindly |
| `chain-failed` | Solana reported an on-chain error; `displayError` carries the parsed program error when available |

There is no separate submitting or confirming phase: `awaiting-wallet` covers signing, sending, and confirmation. The happy path is `preparing` → `awaiting-wallet` → `submitted` → `confirmed` → `reconciling` → `reconciled`; without reconciliation it stops at `confirmed`. `status` is the coarser `'idle' | 'pending' | 'success' | 'error'`. After `confirmed-unreconciled`, `retryReconciliation()` repeats only the reconciliation; it never rebuilds, signs, or resubmits. Check the installed SDK's `MutationPhase` type when the union may have changed.

## Provider and Wallet

`AreteProvider` must receive:

- the generated stack;
- origin-bound `auth={{ publishableKey }}` for hosted access;
- the application's wallet adapter for execution.

Target Wallet Standard wallets. Browser wallets that implement it register themselves, so the app lists no wallet-specific adapters. Use `WalletProvider` from `@solana/wallet-adapter-react` with an empty `wallets` list, and pass `useSolanaWalletAdapter()` from `@usearete/adapter-web3js/react` to `AreteProvider`:

```bash
npm install @usearete/adapter-web3js @solana/web3.js \
  @solana/wallet-adapter-react @solana/wallet-adapter-react-ui
```

```tsx
import type { ReactNode } from 'react';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useSolanaWalletAdapter } from '@usearete/adapter-web3js/react';
import { AreteProvider } from '@usearete/react';
import { MY_STACK } from './generated/my-stack';

import '@solana/wallet-adapter-react-ui/styles.css';

// useSolanaWalletAdapter reads the wallet context, so AreteProvider sits
// one level below WalletProvider.
function AreteShell({ children }: { children: ReactNode }) {
  const wallet = useSolanaWalletAdapter(); // undefined until a wallet connects
  return (
    <AreteProvider stack={MY_STACK} auth={{ publishableKey }} wallet={wallet}>
      {children}
    </AreteProvider>
  );
}

export function App({ children }: { children: ReactNode }) {
  return (
    // wallets={[]}: only Wallet Standard wallets, detected at runtime.
    <WalletProvider wallets={[]} autoConnect>
      <WalletModalProvider>
        <AreteShell>{children}</AreteShell>
      </WalletModalProvider>
    </WalletProvider>
  );
}
```

Do not add explicit legacy wallet adapters (for example a Phantom or Solflare adapter package) to `wallets`. The web3.js adapter builds v0 transactions, so the wallet must support version `0` transactions.

Read-only program account hooks do not require a wallet. A disconnected mutation should remain an error; do not bypass it with an untracked RPC send.

When reconciliation matters, refresh the specific view/read results affected by the operation. Confirmation plus a processed-slot watermark does not prove that every expected entity changed.

Enable the Arete fluent-hooks ESLint rule so nested `.useMutation()` calls remain subject to Hooks rules.

Current references: `https://docs.arete.run/sdks/react/` and `https://docs.arete.run/using-stacks/transactions/`.
