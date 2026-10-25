# Protocol rejections: cause and fix

Every rejection keeps the server's `code`. Upload rejections also carry an
`errors` list, and each entry has a `path` (a JSON pointer into the built
spec), a `code` and a `message`. Read it with
`ARETE_API_KEY=<secret key> npx arete-protocol check`,
`a4 protocol deploy --dry-run` or the MCP tool `protocol_check`, before
uploading. The generated table, including every template and prepare code,
is at <https://docs.arete.run/reference/protocol-expressions/#rejections>.

## Check and build (local)

| Code | Cause | Fix |
|---|---|---|
| `unknown-reference` | A name not in scope at that site (see [expressions.md](expressions.md#names-in-scope)) | Declare it, or move the expression |
| `unknown-function` | A function the language lacks | Use one from [expressions.md](expressions.md#functions) |
| `invalid-expression` | A character or token the syntax lacks | Fix the syntax at the offset |
| `squads-multisig-not-from-resources` | A Squads step's multisig is not `resources.<name>` | Declare a resource and use it |
| warning: builtin program in a template | Templates cannot call builtins yet; the server rejects them | Use glue (see [builtins.md](builtins.md)), or install the program from the registry |

The local checker checks syntax and names only: its "ok" is not the
server's.

## Upload (`a4 protocol deploy`, `protocol_check`)

| Code | Cause | Fix |
|---|---|---|
| `protocol-invalid-document` | The spec breaks the contract schema (`contractCode`, `path`) | Rebuild with the current `@usearete/protocol`; fix `path` |
| `protocol-spec-check-failed` | An expression failed; `errors` entries carry the codes below | Fix each `path` |
| `protocol-template-check-failed` | A template doesn't match its program; `errors` entries carry template codes | Fix each `path` |
| `protocol-bundle-mismatch` | Handler steps without `handlers.mjs`, or a bundle with a template-only spec | Upload exactly the build's files |

Expression codes inside `errors`:

| Code | Cause | Fix |
|---|---|---|
| `unknown-reference` | Name out of scope | See [expressions.md](expressions.md#names-in-scope) |
| `unsupported-feature` | Function, operator or character the language lacks, float math, a non-literal `??` default | See [expressions.md](expressions.md#not-supported-and-what-to-write-instead) |
| `expression-type-mismatch` | Wrong type: a non-boolean guard, a non-pubkey account, a non-integer wrap amount, a bad function argument | Compare expected and found; cast where meant |
| `invalid-expression` | Syntax, arity, or a non-literal where a literal is required | Fix at the offset |
| `source-limit-exceeded` | Over 2048 bytes, 1024 nodes or 64 levels | Split the logic |

Template codes inside `errors` (`path` ends in `/build/instructions/<i>/...`):

| Code | Cause | Fix |
|---|---|---|
| `template_program_spec_missing` | Undeclared alias, or a builtin program | Install the program; use glue for token accounts |
| `template_unknown_instruction` | No such instruction in the IDL | Use the IDL's name |
| `template_unknown_arg` / `template_missing_arg` | Argument not in / missing from the IDL instruction | Match the IDL's arguments |
| `template_arg_type_mismatch` | The expression's type doesn't fit the IDL argument | Cast or change it |
| `template_unknown_account` / `template_missing_account` | Account not in the IDL / required and not derivable | Match the IDL's accounts |

## Activation

| Code | Cause | Fix |
|---|---|---|
| `protocol-template-check-pending` | Arete lacks a pinned program spec; `errors` names each (`protocol-program-spec-missing`, `/programs/<alias>`) | Publish or install the program, activate again |
| `protocol-template-check-failed` | Stored template check failed; `errors` lists why | Fix, rebuild, deploy a new release |
| `protocol-resource-unpublished` | A declared resource has no published version; `errors` names each | Publish each resource |
| `protocol-review-required` | The release has handler code | An operator reviews it |

## Prepare and submit

| Code | Cause | Fix |
|---|---|---|
| `guard_rejected` | A guard was false (`guard` names it) | Check with `protocol_actions` first |
| `instance_terminal` / `participant_terminal` | The instance or participant has finished | Use another instance |
| `step_not_client_callable` | Keeper or admin step | Keepers and operators run it |
| `step_requires_secret_key` | Secret step | Use a secret-key session |
| `protocol-args-invalid` | Args don't match the schema | Fix the named field |
| `template_evaluation_failed` | An expression failed while building (null, overflow) | Guard against the case |
| `template_encode_failed` | A value doesn't fit the IDL type | Bound it with a guard, or cast |
| `transaction-entitlement-required` | The account can't use the managed transaction gateway | See `a4 auth whoami` |
| `execution_intent_expired` | Prepared too long ago | Prepare again |
