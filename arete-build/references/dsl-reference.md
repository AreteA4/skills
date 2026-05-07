# Arete DSL Reference

## Module Macro

### `#[arete(idl = ["path/to/idl.json"], proto = "path/to/file.proto", skip_decoders = false)]`
Applied to a module. Points to the IDL files or Protobuf files used for mapping.
- **idl**: Path(s) to IDL JSON file(s). Anchor and other framework formats supported. Use an array for multi-program stacks.
- **proto**: Path(s) to `.proto` files for Protobuf-based streams.
- **skip_decoders**: If true, skips generating instruction decoders.

## Entity Attributes

### `#[entity(name = "CustomName")]`
Marks a struct as a Arete entity (state projection).
- **name**: Custom name for the entity. Defaults to the struct name.

### `#[primary_key(field_path)]`
Defines the field path used as the primary key for the entity.

### `#[view(name, options)]`
Defines a custom view for the entity.
- **options**: `sort_by`, `order`, `take`.

## Field Mapping Macros

### `#[map(idl_path, strategy = LastWrite, transform = None, ...)]`
Maps an on-chain account field to an entity field.
- **from**: Source account field (e.g., `AccountType::field_name`).
- **primary_key**: Marks this field as the primary key.
- **lookup_index**: Creates a lookup index. Accepts optional `register_from` for cross-account PDA resolution.
- **strategy**: Update strategy (default: `SetOnce`).
- **transform**: Transformation to apply before storing.
- **rename**: Custom target field name.
- **temporal_field**: Secondary field for temporal indexing.
- **join_on**: Field to join on for multi-entity lookups.

### `#[from_instruction(path, strategy = LastWrite, ...)]`
Maps a field from an instruction's arguments or accounts.
- **from**: Source instruction type (e.g., `PlaceTrade::amount`).
- Accepts the same arguments as `#[map]`.

### `#[event(from = InstructionType, fields = [...], strategy = SetOnce)]`
Captures multiple fields from an instruction as a structured event.
- **from**: The source instruction type.
- **fields**: List of fields to capture. Use `accounts::name` for accounts and `args::name` for arguments.
- **strategy**: Update strategy (default: `SetOnce`).
- **transforms**: List of `(field, Transform)` tuples.
- **lookup_by**: Field used to resolve the entity key.
- **rename**: Custom target field name.
- **join_on**: Join field for multi-entity lookups.

### `#[snapshot(from = AccountType, strategy = LastWrite)]`
Captures the entire state of a source account as a snapshot.
- **from**: Source account type (inferred from field type if omitted).
- **strategy**: Only `SetOnce` or `LastWrite` allowed.
- **transforms**: List of `(field, Transform)` tuples for sub-fields.
- **lookup_by**: Field used to resolve the entity key.
- **rename**: Custom target field name.
- **join_on**: Join field for multi-entity lookups.

### `#[aggregate(from = [Instruction1, Instruction2], field = amount, strategy = Sum, condition = "amount > 1000")]`
Defines a declarative aggregation from instructions.
- **from**: Instruction(s) to aggregate from.
- **field**: Field to aggregate. Use `accounts::name` or `args::name`. If omitted, performs `Count`.
- **strategy**: `Sum`, `Count`, `Min`, `Max`, `UniqueCount`.
- **condition**: Boolean expression for conditional aggregation.
- **transform**: Transform to apply before aggregating.
- **lookup_by**: Field used to resolve the entity key.
- **rename**: Custom target field name.
- **join_on**: Join field for multi-entity lookups.

### `#[derive_from(from = [Instruction1, Instruction2], field = __timestamp, strategy = LastWrite)]`
Derives values from instruction metadata or arguments.
- **from**: Instruction(s) to derive from.
- **field**: Target field. Can be `__timestamp`, `__slot`, `__signature`, or a regular instruction arg.
- **strategy**: `LastWrite` or `SetOnce`.
- **condition**: Boolean expression for conditional derivation.
- **transform**: Transform to apply.
- **lookup_by**: Field used to resolve the entity key.

### `#[computed(expr = "field1 + field2")]`
Defines a field derived from other fields using a Rust-like expression.
- Can reference other fields in the entity.
- Can use resolver computed methods like `TokenMetadata::ui_amount(raw, decimals)`.

## Resolvers (`#[resolve]`)

Resolvers enrich entities with data that doesn't live on-chain. Arete fetches the external data server-side and delivers it to clients as part of the entity — no extra API calls needed from consumers.

### Token Metadata Resolver

Fetches SPL token metadata (name, symbol, decimals, logo) from the DAS API for any mint address. Triggered when the field type is `Option<TokenMetadata>`.

```rust
use arete::resolvers::TokenMetadata;

// Fixed address — use when the mint is known at build time
#[resolve(address = "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp")]
pub ore_metadata: Option<TokenMetadata>,

// Dynamic address — use when the mint comes from another field on the entity
#[resolve(from = "id.mint")]
pub token_metadata: Option<TokenMetadata>,
```

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `address` | string | One of `address` or `from` | Fixed mint address to resolve |
| `from` | string | One of `address` or `from` | Dotted path to an entity field containing the mint address |
| `strategy` | ident | No | `SetOnce` (default) or `LastWrite` |

`address` and `from` are mutually exclusive.

**TokenMetadata fields delivered to clients:**

| Field | Type | Description |
|-------|------|-------------|
| `mint` | `string` | The mint address (always present) |
| `name` | `string \| null` | Token name from on-chain metadata |
| `symbol` | `string \| null` | Token ticker symbol |
| `decimals` | `number \| null` | Number of decimal places |
| `logo_uri` | `string \| null` | URL to the token's logo image |

**Computed methods** — available in `#[computed]` expressions and `transform =` on `#[map]` fields:

| Method | Description |
|--------|-------------|
| `TokenMetadata::ui_amount(raw, decimals)` | Convert raw token amount to human-readable UI amount |
| `TokenMetadata::raw_amount(ui, decimals)` | Convert UI amount back to raw token amount |

```rust
// Use in a transform on #[map]
#[map(program_sdk::accounts::Pool::reserves, strategy = LastWrite,
      transform = ui_amount(token_metadata.decimals))]
pub reserves_ui: Option<f64>,

// Or use in #[computed]
#[computed(TokenMetadata::ui_amount(state.reserves_raw, token_metadata.decimals))]
pub reserves_ui: Option<f64>,
```

Resolver data is cached server-side — metadata is fetched once per mint and reused across all entities that reference it.

### URL Resolver

Fetches JSON from any HTTP endpoint. The URL comes from another field on the entity (e.g., a metadata URI stored on-chain). Use this when you need off-chain data that isn't token metadata — NFT images, API responses, configuration JSON, etc.

```rust
// url = dotted path to the entity field containing the URL
// extract = dot-notation path into the JSON response (required)
#[resolve(url = state.metadata_uri, extract = "image")]
pub image_url: Option<String>,

// With POST method
#[resolve(url = state.api_endpoint, method = POST, extract = "data.result")]
pub api_data: Option<String>,
```

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | path | Yes | Dotted path to an entity field containing the URL to fetch |
| `extract` | string | Yes | Dot-notation path to extract from the JSON response (e.g., `"data.image"`) |
| `method` | ident | No | `GET` (default) or `POST` |
| `strategy` | ident | No | `SetOnce` (default) or `LastWrite` |

`url` cannot be combined with `address` or `from` — those are for the token metadata resolver.

The `extract` path supports object keys and array indices (e.g., `"items.0.url"`). Results are cached and deduplicated — multiple entities requesting the same URL are batched into a single HTTP request.

## Cross-Account Resolution

### `lookup_index(register_from = [(Instruction, accounts::pda, accounts::key), ...])`
Preferred approach for cross-account PDA resolution. Add to a `#[map]` field that maps the secondary account's address.
- Each tuple specifies: (instruction type, instruction account containing PDA, instruction account containing primary key).
- Arete registers the mapping and routes subsequent account updates to the correct entity.

## Declarative Hooks (Advanced)

### `#[resolve_key(account = AccountType, strategy = "pda_reverse_lookup", lookup_name = "registry_name")]`
Defines how an account's primary key is resolved. Use when an account doesn't store its owner ID directly.
- **account**: The account type this resolver applies to.
- **strategy**: `"pda_reverse_lookup"` (default) or `"direct_field"`.
- **lookup_name**: The name of the registry to use for reverse lookups.
- **queue_until**: List of instructions to wait for before resolving.

### `#[register_pda(instruction = CreateInstruction, pda_field = accounts::pda, primary_key = args::id, lookup_name = "registry_name")]`
Registers a mapping between a PDA address and a primary key during an instruction.
- **instruction**: The instruction where the PDA is created/referenced.
- **pda_field**: The field containing the PDA address (e.g., `accounts::user_pda`).
- **primary_key**: The primary key to associate with this PDA (e.g., `args::user_id`).
- **lookup_name**: The name of the registry to store this mapping in.

## Update Strategies

| Strategy | Description |
|----------|-------------|
| `SetOnce` | Only write if the field is currently empty. |
| `LastWrite` | Always overwrite with the latest value. |
| `Append` | Append to a `Vec`. |
| `Merge` | Deep-merge objects (for nested structs). |
| `Max` | Keep the maximum value. |
| `Min` | Keep the minimum value. |
| `Sum` | Accumulate numeric values. |
| `Count` | Increment by 1 for each occurrence. |
| `UniqueCount` | Track unique values and store the count. |

## Transformations

| Transform | Description |
|-----------|-------------|
| `Base58Encode` | Encode bytes to Base58 string (default for Pubkeys). |
| `Base58Decode` | Decode Base58 string to bytes. |
| `HexEncode` | Encode bytes to Hex string. |
| `HexDecode` | Decode Hex string to bytes. |
| `ToString` | Convert value to string. |
| `ToNumber` | Convert value to number. |
