# Protocol expressions

Guards, derivations, reaction triggers, binds, glue, fees, read addresses and
instruction templates are expressions. The complete, generated list of every
function, operator, name and limit, with every rejection code, is
<https://docs.arete.run/reference/protocol-expressions/>. Read it before
guessing a function name.

## Check against the server, not the local checker

`npx arete-protocol check` alone checks syntax and names. It does not check
types. With a secret key, Arete's own upload checks run without uploading
anything:

```sh
ARETE_API_KEY=<secret key> npx arete-protocol check   # or --remote to require it
a4 protocol deploy --dry-run                          # uses the a4 login
```

The MCP tool `protocol_check` runs the same check. A rejection lists each error
as `path: message [code]`, where `path` is a JSON pointer into the built
spec (`/steps/open/guards/0/expr`). Fix the errors there instead of deploying
cut-down variants to find them.

## Values

- Integers are exact; there are no floats (`1.5` fails when evaluated).
  `u64` args and params are decimal strings that compare and add as
  integers: `args.amount >= 1000`.
- Public keys are base58 strings; a string literal works wherever a pubkey
  is expected.
- `[1, 2, 3]` is a byte array (0 to 255), not a list, and brackets never index.
- `true`, `false`, `null` (`none`).

## Operators

Loosest to tightest: `??` (right side must be a literal), `||`, `&&`, `|`,
`^`, `&`, `==` `!=`, `<` `<=` `>` `>=`, `<<` `>>`, `+` `-`, `*` `/` `%`,
then prefix `!`. Integer math fails on overflow and division by zero.

## Functions

`if(cond, a, b)`, `some`, `exists`, `is_some`, `is_none`, `is_null`, `abs`,
`min`, `max`, `concat(a, b, ...)`, `starts_with(text, prefix)`,
`split_part(text, sep, n)`, `utf8(bytes)`, `len`, `sum`, `index(list, 0)`,
`slice(list, 0, 8)`, `timestamp()`, `pda("<alias>", "<pda name>", seeds...)`,
`ata(owner, mint)`, and the casts `u8` … `u128`, `i8` … `i128`, `string`,
`bool`. `index`, `slice` and `split_part` take literal positions.

The checker also accepts `slot`, `keccak256`, `u64_from_le_bytes`,
`u64_from_be_bytes`, `ui_amount`, `raw_amount`, `f32` and `f64`, but protocol
evaluation rejects them: don't use them in protocols. `exp`, `ln` and `pow`
exist only in stacks.

## Names in scope

| Name | In scope |
|---|---|
| `now`, `deployment.*`, `params.*`, `resources.*` | everywhere (`now` is not in read addresses) |
| `wallet` | every step; the participant machine (the participant's wallet) |
| `args.*`, `ephemeral.<declared>` | step expressions, and the address of a read the step uses |
| `instance.id/state/accounts.*/roles.*` | everywhere except create steps |
| `participant.id/state/wallet` | participant steps and the participant machine |
| `reads.<declared>.*` | where the step or machine lists the read, but never inside a read address |

A read's address is checked once for every step or machine that uses it,
with that user's names. A name it uses must exist at every use, so
`args.venue` in a read address needs every step that reads it to declare
`venue`. A read nobody uses is not checked.

## Not supported, and what to write instead

| Instead of | Write |
|---|---|
| `list[0].field` | `index(list, 0)` (untyped: a field after it is not checked) |
| `x in [a, b]` (allow-lists) | `x == resources.a \|\| x == resources.b` |
| `resources.venues[args.venue]` | one resource per venue, chosen with `if(...)` |
| `cond ? a : b` | `if(cond, a, b)` |
| `x.len()` and other methods | `len(x)` |
| `-x` | `0 - x` |
| float math | scaled integers: `x * 15 / 10` |
| a PDA the IDL doesn't name | only IDL PDAs, through `pda(...)` |

For each rejection code with its cause and fix, see
[troubleshooting.md](troubleshooting.md).
