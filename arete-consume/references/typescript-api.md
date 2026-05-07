# TypeScript SDK API Reference

## Connection

### `Arete.connect(stack, options?)`
Establishes a WebSocket connection to a Arete stack.

**Parameters:**
- `stack` — Stack definition (includes URL and typed views)
- `options.url` — Override the stack's default URL (optional)
- `options.maxEntriesPerView` — Max entries per view before LRU eviction (default: 10000)
- `options.validateFrames` — Validate incoming frames against Zod schemas (default: false)

**Returns:** `Promise<Arete>`

## Streaming Methods

Every view supports three streaming methods that return `AsyncIterable`:

### `.use(options?)` — Stream Merged Entities
The simplest streaming method. Emits the full merged entity after each change.

**State mode:** `.use(key, options?): AsyncIterable<T>`
**List mode:** `.use(options?): AsyncIterable<T>`

```typescript
// List view
for await (const round of a4.views.OreRound.latest.use()) {
  console.log("Round:", round.id.round_id);
}

// State view
for await (const round of a4.views.OreRound.state.use(roundAddress)) {
  console.log("Round updated:", round.state.motherlode);
}
```

### `.watch(options?)` — Stream Raw Updates
Emits operation type (upsert/patch/delete) with data.

**State mode:** `.watch(key, options?): AsyncIterable<Update<T>>`
**List mode:** `.watch(options?): AsyncIterable<Update<T>>`

```typescript
for await (const update of a4.views.OreRound.latest.watch()) {
  switch (update.type) {
    case "upsert":
      console.log("Created or replaced:", update.data);
      break;
    case "patch":
      console.log("Partial update:", update.data);
      break;
    case "delete":
      console.log("Deleted:", update.key);
      break;
  }
}
```

### `.watchRich(options?)` — Stream with Before/After Diffs
Emits before/after comparison for updates.

**State mode:** `.watchRich(key, options?): AsyncIterable<RichUpdate<T>>`
**List mode:** `.watchRich(options?): AsyncIterable<RichUpdate<T>>`

```typescript
for await (const update of a4.views.OreRound.latest.watchRich()) {
  switch (update.type) {
    case "created":
      console.log("New entity:", update.data);
      break;
    case "updated":
      console.log(`Changed: ${update.before.state.motherlode} → ${update.after.state.motherlode}`);
      break;
    case "deleted":
      console.log("Removed:", update.lastKnown);
      break;
  }
}
```

## One-Shot Methods

### `.get()` — Async Snapshot
Fetches the current state. Returns a promise that resolves when data is available.

**State mode:** `.get(key): Promise<T | null>`
**List mode:** `.get(): Promise<T[]>`

```typescript
// List view
const rounds = await a4.views.OreRound.latest.get();

// State view
const round = await a4.views.OreRound.state.get(roundAddress);
if (round) {
  console.log("Round:", round.id.round_id);
}
```

### `.getSync()` — Synchronous Snapshot
Returns immediately with cached data. Returns `undefined` if data hasn't been loaded yet.

**State mode:** `.getSync(key): T | null | undefined`
**List mode:** `.getSync(): T[] | undefined`

```typescript
const rounds = a4.views.OreRound.latest.getSync();
if (rounds) {
  console.log(`Cached: ${rounds.length} rounds`);
} else {
  console.log("Data not yet loaded");
}
```

## Types

### Update Types
Yielded by `.watch()`:

```typescript
type Update<T> =
  | { type: "upsert"; key: string; data: T }
  | { type: "patch"; key: string; data: Partial<T> }
  | { type: "delete"; key: string }
```

### RichUpdate Types
Yielded by `.watchRich()`:

```typescript
type RichUpdate<T> =
  | { type: "created"; key: string; data: T }
  | { type: "updated"; key: string; before: T; after: T; patch?: unknown }
  | { type: "deleted"; key: string; lastKnown?: T }
```

### WatchOptions
Options for streaming methods:

```typescript
interface WatchOptions {
  take?: number;         // Limit number of entities
  skip?: number;         // Skip first N entities
  schema?: Schema<T>;    // Validate and filter entities with a Zod schema
}
```

## Connection State

### `a4.connectionState`
Current connection state (read-only):

- `'disconnected'` — Not connected
- `'connecting'` — Establishing connection
- `'connected'` — Active connection
- `'reconnecting'` — Auto-reconnecting after failure
- `'error'` — Connection failed

### `a4.onConnectionStateChange(callback)`
Subscribe to connection state changes. Returns unsubscribe function.

```typescript
const unsubscribe = a4.onConnectionStateChange((state) => {
  console.log("Connection state:", state);
});

// Later: stop listening
unsubscribe();
```

### `a4.disconnect()`
Close the WebSocket connection gracefully.

```typescript
await a4.disconnect();
```

## Error Handling

```typescript
import { Arete, AreteError } from "@usearete/sdk";

try {
  const a4 = await Arete.connect(ORE_STREAM_STACK);
} catch (error) {
  if (error instanceof AreteError) {
    console.error("Arete error:", error.message);
    console.error("Code:", error.code);
  } else {
    throw error;
  }
}
```
