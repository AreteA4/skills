# React SDK API Reference

## Components

### `<AreteProvider>`
Wraps your application to initialize the Arete SDK and manage connections to stacks.

**Props:**
- **`autoConnect`** (boolean, default: `true`) — Auto-connect on mount
- **`maxEntriesPerView`** (number | null, default: `10000`) — Max entries per view before LRU eviction
- **`websocketUrl`** (string, optional) — Override URL for all stacks (e.g., for local development)

```jsx
<AreteProvider autoConnect={true} maxEntriesPerView={10000}>
  <App />
</AreteProvider>
```

## Hooks

### `useArete(stackDefinition, options?)`
Returns a typed interface to your stack's views and connection state.

**Returns:**
- **`views`** — Typed view accessors (e.g., `views.OreRound.list.use()`)
- **`connectionState`** — Current WebSocket state (`'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'`)
- **`isConnected`** — Boolean convenience flag (`true` when `connectionState === 'connected'`)
- **`isLoading`** — `true` until client is ready
- **`error`** — Connection error if any
- **`client`** — Low-level `Arete` instance

**Options:**
- **`url`** (string, optional) — Override the stack's default WebSocket URL

```jsx
const { views, connectionState, isConnected, isLoading, error, client } = useArete(ORE_STREAM_STACK);
const { data: rounds, isLoading } = views.OreRound.list.use();
```

### `useConnectionState(stack?)`
Standalone hook for connection state. Returns the current connection state string.

**Parameters:**
- **`stack`** (optional) — Stack definition. If omitted, returns state of the single active client.

**Returns:** `'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'`

```jsx
const state = useConnectionState(ORE_STREAM_STACK);
```

## View Hooks

### List Views: `views.<Entity>.<view>.use(params?, options?)`
Subscribes to a list view and returns live-updating array data.

**Parameters:**
- **`take`** (number, server-side) — Limit entities returned from server
- **`skip`** (number, server-side) — Skip first N entities (pagination)
- **`where`** (object, client-side) — Filter with comparison operators (`gte`, `gt`, `lte`, `lt`, or exact match)
- **`limit`** (number, client-side) — Max results to keep after filtering
- **`schema`** (Schema\<T\>, client-side) — Zod schema (or any object with `safeParse`); entities that fail validation are silently excluded

**Options:**
- **`enabled`** (boolean, default: `true`) — Enable/disable subscription
- **`initialData`** (T[], optional) — Initial data before first response

**Returns:**
- **`data`** — Array of entities (`T[] | undefined`)
- **`isLoading`** — `true` until first data received
- **`error`** — Subscription error if any
- **`refresh`** — Function to manually trigger refresh

```jsx
const { data: rounds, isLoading, error, refresh } = views.OreRound.list.use({
  take: 50,
  skip: 0,
  where: { motherlode: { gte: 100000 } },
  limit: 10
}, { enabled: true, initialData: [] });
```

**With schema filtering** — use the generated "Completed" variant to only receive fully-hydrated entities:

```jsx
import { OreRoundCompletedSchema } from './generated/ore-stack';

const { data: rounds } = views.OreRound.latest.use({
  schema: OreRoundCompletedSchema,
});
// All fields on each round are guaranteed non-null — no optional chaining needed
```

Custom Zod schemas filter to only the fields you care about:

```jsx
import { z } from 'zod';

const TradableTokenSchema = z.object({
  id: z.object({ mint: z.string() }),
  reserves: z.object({ current_price_sol: z.number() }),
});

const { data: tokens } = views.PumpfunToken.list.use({
  schema: TradableTokenSchema,
});
```

### State Views: `views.<Entity>.<view>.use({ key }, options?)`
Subscribes to a state view and returns live-updating single entity data.

**Parameters:**
- **`key`** (string, required) — The entity key/address to subscribe to

**Options:**
- **`enabled`** (boolean, default: `true`) — Enable/disable subscription
- **`initialData`** (T, optional) — Initial data before first response

**Returns:**
- **`data`** — Single entity (`T | undefined`)
- **`isLoading`** — `true` until first data received
- **`error`** — Subscription error if any
- **`refresh`** — Function to manually trigger refresh

```jsx
const { data: round, isLoading } = views.OreRound.state.use({
  key: roundAddress
}, { enabled: !!roundAddress });
```

### `views.<Entity>.<view>.useOne(params?, options?)`
Convenience method for fetching a single item from a list view with proper typing.

**Returns:** `T | undefined` (not `T[]`)

**Equivalent to:** `.use({ take: 1 })` but with cleaner API and explicit intent.

**Parameters:** same as `.use()` — including `schema` for validation filtering.

```jsx
const { data: latestToken } = views.tokens.list.useOne();
// data: Token | undefined

const { data: topToken } = views.tokens.list.useOne({
  where: { volume: { gte: 10000 } }
});

// With schema — only resolves when a fully-hydrated entity exists
import { OreRoundCompletedSchema } from './generated/ore-stack';
const { data: round } = views.OreRound.latest.useOne({
  schema: OreRoundCompletedSchema,
});
// round is OreRoundCompleted | undefined — all fields non-null
```

## Filtering Operators

**Client-side `where` operators:**

| Operator | Description |
|----------|-------------|
| `gte` | Greater than or equal |
| `gt` | Greater than |
| `lte` | Less than or equal |
| `lt` | Less than |
| *(value)* | Exact match |

```jsx
const { data } = views.OreRound.list.use({
  where: {
    motherlode: { gte: 1000000 },
    difficulty: { lt: 50 },
    status: "active"  // Exact match
  }
});
```

## Connection States

The `connectionState` property returns one of five states:

| State | Description |
|-------|-------------|
| `'disconnected'` | Not connected |
| `'connecting'` | Establishing connection |
| `'connected'` | Active and healthy |
| `'reconnecting'` | Auto-reconnecting after failure |
| `'error'` | Connection failed |

```jsx
const { connectionState, isConnected } = useArete(ORE_STREAM_STACK);

const statusColors = {
  connected: "green",
  connecting: "yellow",
  reconnecting: "orange",
  disconnected: "gray",
  error: "red"
};

return <div style={{ color: statusColors[connectionState] }}>
  {isConnected ? "Live" : connectionState}
</div>;
```
