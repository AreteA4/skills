# Rust SDK API Reference

## Connection

### `Arete::<T>::connect()`
Asynchronously connects to a Arete WebSocket.
- **T**, The generated Stack type.
- **Note**: The WebSocket URL is embedded in the stack definition (e.g., `ORE_STREAM_STACK`). No URL argument is needed.

## View Methods

### `.listen()`
Returns a stream that yields updates. Use with `.next().await` to iterate over updates.

## Integration

### Tokio
The Rust SDK uses `tokio` for async execution and communication. Ensure you have a `#[tokio::main]` attribute or a running `tokio` runtime.

Add to `Cargo.toml`:
```toml
[dependencies]
arete-a4-sdk = "0.1.1"
tokio = { version = "1", features = ["full"] }
```

## Example

```rust
// MyStack comes from your stack definition crate (built with arete-build)
use arete_sdk::prelude::*;
use my_stack::MyStack;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let a4 = Arete::<MyStack>::connect().await?;
    
    let mut stream = a4.views.my_entity.latest().listen().take(1);
    while let Some(item) = stream.next().await {
        println!("Item: {:?}", item.id);
    }
    
    Ok(())
}
```

This example is from the [official Arete documentation](https://docs.arete.run).
