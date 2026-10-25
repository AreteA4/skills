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

`AreteProvider`'s `wallet` signs only for stacks the provider connects. Members of a session sign with the session's wallet (see the next section).

## Compose a Session

Requires `@usearete/react` and `@usearete/sdk` 0.47.0 or later, as installed by `a4` 0.47.0 or later. On older releases, use `useArete(stack)` for each stack and the provider wallet above.

Use one session when the UI needs more than one stack, a standalone program (which has no views), or a protocol, with one auth and one wallet for all of them. For one stack and its own `arete.programs.<name>`, `useArete(MY_STACK)` is enough.

```bash
npm install @usearete/react @usearete/sdk @usearete/adapter-kit @solana/kit \
  @wallet-standard/react @wallet-standard/ui-registry zod
```

```tsx
import type { UiWalletAccount } from '@wallet-standard/react';
import {
  AreteProvider,
  AreteSessionProvider,
  useArete,
  useAreteSession,
  useAsyncRead,
  useOperationMutation,
  type OperationMutationError,
  type WalletAdapter,
} from '@usearete/react';
import { useWalletStandardWallet } from '@usearete/react/wallet-standard';
import { MY_STACK } from './generated/my-stack';
import { MY_PROGRAM } from './generated/my-program';

// Module level. The session reopens when the definition or options change
// shape, and a function in them (getToken, fetch) changes by identity.
const APP = { stacks: { app: MY_STACK }, programs: { vault: MY_PROGRAM } };
const auth = { publishableKey: import.meta.env.VITE_ARETE_PUBLISHABLE_KEY };

// `account` is the UiWalletAccount the user connected with @wallet-standard/react.
export function App({ account, vault }: { account: UiWalletAccount | null; vault: string }) {
  const { wallet, address, error } = useWalletStandardWallet(account, { chain: 'solana:mainnet' });
  return (
    <AreteProvider auth={auth}>
      {/* The session takes auth and fetch from AreteProvider, and its wallet from this prop. */}
      <AreteSessionProvider definition={APP} wallet={wallet}>
        {error?.code === 'chain_unsupported' && <p>Switch your wallet to mainnet.</p>}
        {error?.code === 'sign_transaction_unsupported' && <p>This wallet cannot sign for this app.</p>}
        <VaultPanel owner={address} vault={vault} wallet={wallet} />
      </AreteSessionProvider>
    </AreteProvider>
  );
}

function VaultPanel({ owner, vault, wallet }: { owner: string | null; vault: string; wallet?: WalletAdapter }) {
  const { session, status, error, ready, retry } = useAreteSession<typeof APP>();

  // Live view over the session's own connection. `stack` types the hooks while the session opens.
  const app = useArete(session?.stacks.app, { stack: APP.stacks.app });
  const position = app.views.Position.state.use(owner ? { owner } : undefined);

  // A standalone program has no views or read hooks: read its accounts with useAsyncRead.
  const program = session?.programs.vault;
  const account = useAsyncRead(
    ['vault', vault],
    async () => (program ? program.accounts.Vault.fetch(vault) : null),
    { enabled: program !== undefined, disabledStatus: 'connecting' },
  );

  // Runs on the provider's session. Pass the wallet: without one the run is not-ready.
  const deposit = useOperationMutation(
    async (input: { owner: string; amount: bigint }) =>
      (await ready()).programs.vault.instructions.deposit.prepare({ ...input, vault }),
    { wallet, onSuccess: () => void account.refresh() },
  );

  if (status === 'error') return <button onClick={retry}>Reconnect ({error?.message})</button>;
  return (
    <section>
      <p>Position: {position.data?.size != null ? String(position.data.size) : position.status}</p>
      <p>Vault: {account.data ? String(account.data.balance) : account.status}</p>
      <button
        disabled={!owner || deposit.isBusy}
        onClick={() => owner && deposit.mutate({ owner, amount: 1_000_000n })}
      >
        Deposit
      </button>
      {deposit.isAwaitingWallet && <p>Approve the request in your wallet.</p>}
      {deposit.error && <p>{describeError(deposit.error)}</p>}
    </section>
  );
}

function describeError(error: OperationMutationError): string {
  switch (error.kind) {
    case 'not-ready': return 'Connect a wallet first.';
    case 'wallet-rejected': return 'You declined the request.';
    case 'wallet-feature-unsupported': return 'This wallet cannot sign without sending. Use another wallet.';
    case 'wallet-chain-unsupported': return 'Switch your wallet to the network this app uses.';
    case 'wallet-version-unsupported': return 'This wallet cannot sign this transaction version.';
    case 'submitted-unknown': return 'Sent but not confirmed. Check the signature before trying again.';
    default: return error.message;
  }
}
```

Take the stack, program, view, account and operation names from the generated SDKs. `AreteSessionProvider` also accepts `options` (the `createSession` options without `wallet`) or `session={existing}` for a session the app opened and closes itself.

- **One connection per stack.** Pass `session?.stacks.<key>` to `useArete`, with `{ stack }` while the member can be `null`, or `useArete(session.stacks.<key>)` once it can't be. Do not call `Arete.connect`, or `useArete(MY_STACK)` with the definition, for a stack that is already in the session: each opens a second connection.
- **The session's wallet.** Stack mutations from `useArete(member)` (`.useMutation()`) sign with the session's wallet, which the `wallet` prop sets without reopening the session. `useOperationMutation` signs only with the `wallet` you pass to the hook or to `run`/`mutate`. Without one it fails with `not-ready` before anything is prepared, unless you set `allowExecutorWallet: true` to use the session's. `AreteProvider`'s `wallet` never reaches session members.
- **Stable auth.** `options.auth` and `options.fetch` default to the enclosing `AreteProvider`'s. A changed definition or options closes the session and opens a new one (`session` is `null` meanwhile); options are compared two levels deep, but functions such as `getToken` and `fetch` by identity, so keep them at module level or in `useCallback`.
- **Opening and errors.** `status` is `opening`, `open` or `error`; `retry()` reopens after a failure. `ready()` resolves with the open session and is stable, so prepare functions can await it.
- **No reconciliation.** `useOperationMutation` does not wait for the stream or refresh views. Refresh what the operation changed in `onSuccess`; stack operations through `.useMutation()` keep `reconcile`.
- **Transaction versions.** The Kit adapter builds v0 unless `send.transactionVersion` asks otherwise. Most wallets do not sign V1 yet, so a V1 request typically fails with `wallet-version-unsupported`.

`useOperationMutation` status runs `idle` → `preparing` → `signing` → `sending` → `confirming` → `done`, or `error`, once per transaction of a flow (`transactionIndex` of `transactionCount`). A second run while one is in progress fails with `busy`. `mutate` keeps the failure in `error`; `run` rejects with it. Switch on `error.kind`:

| `kind` | Meaning |
| --- | --- |
| `busy` | A run of this hook is in progress; nothing started |
| `not-ready` | No session or no wallet; nothing was prepared or signed |
| `prepare-failed` | `prepare` threw; nothing was signed |
| `wallet-rejected` | The user declined or closed the wallet prompt |
| `wallet-feature-unsupported` | The wallet cannot sign without sending (no `solana:signTransaction`) |
| `wallet-chain-unsupported` | The wallet does not sign for the requested chain |
| `wallet-version-unsupported` | The wallet does not sign this transaction version |
| `wallet-modified` | The wallet changed the transaction, so it was not sent |
| `not-submitted` | Failed before anything reached the chain |
| `submitted-unknown` | May have landed; check `error.signature` on chain, never resend blindly |
| `chain-failed` | Failed on chain; see `programError` |

`useWalletStandardWallet(account, { chain })` returns `wallet` as `undefined` until an account is connected and whenever it cannot sign for Arete. Its `error` is then a `WalletStandardSignerError` whose `code` is `sign_transaction_unsupported`, `chain_unsupported` or `account_unavailable`. A declined prompt is not an `error` there: it fails the run with `wallet-rejected`, and the wallet stays usable. `isPromptOpen` is true while the wallet's approval prompt is open. `toOperationMutationError(error)` gives the same `kind` for an imperative `session.execute`.

## Reconcile What the Operation Changed

In WebSocket mode, generated mutation hooks reconcile by default: after confirmation they wait for the stack's processed-slot watermark to reach the confirmed slot, then refresh the targets in `reconcile.refresh`. The watermark proves the stream caught up. It does not prove that a particular entity changed, so choose the refresh targets yourself.

No tool infers them. While writing the component:

1. Take the operation's programs, instructions, and accounts: `describePreparedOperation(prepared)` from `@usearete/sdk` on a prepared value (the hook exposes the last one as `prepared`), or `a4 explore stack <stack-ref> --operation <operation> --json` for its required and derived accounts.
2. Compare them with each installed stack's entities and views from `a4 explore stack <stack-ref> --json`.
3. Pass exactly the affected views and reads to `reconcile.refresh`.

```tsx
await deploy.submit(input, {
  reconcile: {
    refresh: [
      arete.views.Board.state, // view hook objects refresh that view's active subscriptions
      arete.views.Round.state,
      arete.views.Miner.state,
      quote, // a read or view hook result
    ],
  },
});
```

`refresh` accepts view hook objects, view and read hook results, and callbacks. A timeout or failed refresh settles as `confirmed-unreconciled` without undoing the confirmed transaction.

Enable the Arete fluent-hooks ESLint rule so nested `.useMutation()` calls remain subject to Hooks rules.

Current references: `https://docs.arete.run/sdks/react/` and `https://docs.arete.run/using-stacks/transactions/`.
