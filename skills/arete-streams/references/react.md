# React View Clients

Use this reference for React applications. Keep generated stack imports at module scope so provider and client cache identity remains stable.

## Dependencies

```bash
npm install @usearete/react @usearete/sdk zod
```

React is an application peer dependency. Do not install `zustand` separately; `@usearete/react` carries it.

## Provider and Hook

```tsx
import { AreteProvider, useArete } from '@usearete/react';
import { MY_STACK } from './generated/my-stack';

function Positions({ owner }: { owner: string }) {
  const arete = useArete(MY_STACK);
  const position = arete.views.Position.state.use({ owner });

  if (arete.status === 'error') {
    return <button onClick={() => void arete.retry()}>Reconnect</button>;
  }
  if (position.status !== 'ready') return <p>Loading…</p>;
  if (!position.data) return <p>No position</p>;
  return <pre>{JSON.stringify(position.data, null, 2)}</pre>;
}

export function App() {
  const publishableKey = import.meta.env.VITE_ARETE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error('VITE_ARETE_PUBLISHABLE_KEY is required');

  return (
    <AreteProvider stack={MY_STACK} auth={{ publishableKey }}>
      <Positions owner="…" />
    </AreteProvider>
  );
}
```

Use `.use()` for a live state/list result and `.useOne()` for the first list result. Pass `undefined` to a state hook when a dependent key is not ready; do not call hooks conditionally.

## Several Stacks, Programs, or Protocols: a Session

Requires `@usearete/react` and `@usearete/sdk` 0.47.0 or later, as installed by `a4` 0.47.0 or later. On older releases, call `useArete(stack)` for each stack.

Keep `useArete(MY_STACK)` for one stack, including its own `arete.programs.<name>`. When the UI also needs other stacks, standalone programs, or protocols behind one auth and one wallet, open one session with `AreteSessionProvider` and pass its stack members to `useArete`:

```tsx
import { AreteProvider, AreteSessionProvider, useArete, useAreteSession } from '@usearete/react';
import { MY_STACK } from './generated/my-stack';
import { OTHER_STACK } from './generated/other-stack';

const APP = { stacks: { app: MY_STACK, other: OTHER_STACK } }; // module level

function Positions({ owner }: { owner: string }) {
  const { session } = useAreteSession<typeof APP>();
  // `null` while the session opens; `stack` gives typed placeholders until then.
  const app = useArete(session?.stacks.app, { stack: APP.stacks.app });
  const position = app.views.Position.state.use({ owner });

  if (app.status === 'error') return <button onClick={() => void app.retry()}>Reconnect</button>;
  if (position.status !== 'ready') return <p>Loading…</p>;
  return <p>{position.data ? String(position.data.size) : 'No position'}</p>;
}

export function App() {
  return (
    <AreteProvider auth={{ publishableKey: import.meta.env.VITE_ARETE_PUBLISHABLE_KEY }}>
      <AreteSessionProvider definition={APP}>
        <Positions owner="…" />
      </AreteSessionProvider>
    </AreteProvider>
  );
}
```

- The member hooks read the session's connection and store, so nothing connects twice, and unmounting never disconnects the member. Do not call `Arete.connect`, or `useArete(MY_STACK)` with the definition, for a stack the session already has.
- The session takes `auth` and `fetch` from the enclosing `AreteProvider` unless `options` sets them. Changing the definition or options reopens the session; functions such as `getToken` and `fetch` compare by identity, so keep them stable.
- Once the session is open, `useArete(session.stacks.app)` needs no `stack`. A reopened session gives new members, and the hooks move to them.
- For program reads, transactions, and the session's wallet, follow the Compose a Session section of the `arete-programs` React reference.

## Stack Reads for Derived State

For derived "current X" state, use the stack's reads first. `arete.read.*` functions come from the stack's extension and combine views, program accounts, and chain state into one value. ORE's `read.currentRound`, for example, returns the current board and round with the round's phase, so the app does not rebuild that from several view hooks and the clock.

```tsx
const current = arete.read.currentRound.use();

if (current.status === 'error') return <p>{current.error?.message}</p>;
if (!current.isReady) return <p>Loading…</p>;
if (current.isEmpty) return <p>No active round</p>;
return <Round value={current.data} />;
```

Take the read names, arguments, and result shapes from the generated stack. A read hook runs again when its arguments change or when you call `refresh()`, not on every stream update. When the value must follow the stream, refresh the read when the view it depends on changes, or render that view directly. A stack without a stack extension has no reads, and a composed stack does not carry its source stack's reads.

## Status and Lifecycle

Render from status fields rather than treating `data` truthiness as loading state. Account for loading, ready-empty, refreshing, connection error, and validation error states. Use `retry()` for an explicit provider-managed replacement attempt.

Repeated `useArete` calls share a client when stack and option identities match. Keep program objects and options stable with module constants or `useMemo`.

For single-stack applications, generated or `createAreteReact`-bound provider/hook pairs can remove repeated stack arguments. Follow the installed generated exports rather than assuming their names.

Enable the `arete/fluent-hooks` ESLint rule when the project uses fluent `.use()`, `.useOne()`, or `.useMutation()` hooks; generic hooks linting cannot identify every nested fluent call.

Current reference: `https://docs.arete.run/sdks/react/`.
