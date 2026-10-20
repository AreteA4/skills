# Development environments and self-serve deploys

`a4 dev` connects a local protocol project or Solana app to an Arete-hosted,
persistent mainnet fork. Source, wallets, the CLI and dev UI stay on your
machine. The environment's chain state and protocol runtime are hosted.
`a4 protocol deploy` is the separate production deployment workflow.

Use the released CLI's help and generated README as the source of truth:
`a4 dev --help`, `a4 dev up --help`, `a4 protocol deploy --help`.
Cloud access depends on the account's access and quotas. If the service is
unavailable or disabled, report that result; do not substitute production.

## Requirements and authorization

Use an Arete secret key from `a4 auth login` or `ARETE_API_KEY`. For a protocol
project, install Node.js 22.13+ and the project's npm dependencies. The released
cloud workflow does not require installing a validator or local Arete runtime.

Starting a cloud environment creates or wakes an account resource and consumes
its allowance. Do it when the user asks to develop or test there. Development
SOL has no mainnet value. Never use production wallets or secrets for examples.

## Start a project

```bash
a4 protocol init my-protocol
cd my-protocol
npm install --save-dev @usearete/protocol@0.2.0
npx arete-protocol check
a4 dev up
```

CLI 0.42.0 writes an obsolete protocol-package range in the scaffold. The
explicit install above replaces it with the published 0.2.0 package before
checking or building. Do not install an unpublished version.

Init writes the project files and installs System Program builders. It refuses
to overwrite existing files. Commit source, generated modules and `arete.lock`;
keep `.arete/` ignored.

```bash
a4 dev up --env experiment          # choose or create a named environment
a4 dev up --no-deploy               # RPC and UI without protocol deployment
a4 dev up --port-base 48800         # another loopback port block
a4 dev status --json
a4 dev list --json                  # environments, usage and plan quotas
```

The CLI creates or wakes the environment, forwards its RPC and WebSocket on
loopback, builds and deploys the protocol when present, generates its client,
and watches for changes. A changed release gets a new deployment; reload code
that imported the previous generated definition. Failed builds leave the last
good deployment running. Use `deployment.*` expressions rather than hard-coded
ids or attestation keys.

`a4 dev down` stops local forwarding and the UI. It does not erase the cloud
fork. Environments sleep after inactivity and retain state for the account's
retention period. `a4 dev sleep` sleeps one explicitly; `a4 dev wake` wakes it.
Reset, restore and delete can discard work; get authorization for that effect.
Checkpoint storage and active environments count against the account's quotas.

## The app's client

The client is generated in `generated/<lang>/protocols/<alias>/`, where
`a4 install protocol` writes it. `a4 dev sdk --ts` (or `--rust`, `--python`)
regenerates it explicitly. Read its README for the real export and import path.
The definition carries the dev deployment id; do not edit generated files.

A backend uses the owning account's secret key and the API origin from
`a4 dev status --json`. The protocol API is not the loopback chain RPC. In
TypeScript, pass `keyClass: "secret"` when a key supplied through
`ARETE_API_KEY` must call secret steps. Browsers use an origin-bound publishable
key for public steps and an authenticated backend for secret steps.

Point wallets and chain clients at the RPC printed by `a4 dev up` (normally
`http://127.0.0.1:48700`). Keep the CLI running while they use it. Dev wallet
keys stay in `.arete/dev/wallets/`; only signed messages leave the machine.
`.arete/dev/session.json` and token-bearing stream URLs contain credentials:
never commit them or copy them into a browser bundle, log or chat.

Before shipping, deploy the protocol only when authorized, restore the published
client with `a4 install --locked`, and run `a4 install --check`. The latter fails
while a local-build override remains or dependencies differ from the lockfile.
Never force a production deployment id into a dev client or point the CLI at
an invented local protocol API.

## Drive and inspect the fork

```bash
a4 dev wallet creator
a4 dev step <step> --args '<json>' --wallet creator
a4 dev instance <instance-id> --wallet creator
a4 dev warp +2h
a4 dev fund <pubkey>
a4 dev scenario scenario.json --dry-run
a4 dev scenario scenario.json
a4 stream --dev --instance <instance-id>
a4 dev events
```

Use `warp` for deadlines and `scenario` for declared account overrides; inspect
the scenario before applying it. Use `a4 dev fund --help` for SOL/token funding
flags. Checkpoint, branch and restore are available through `a4 dev checkpoint`,
`a4 dev branch` and `a4 dev restore`; inspect their exact flags before changing
state. Untouched accounts follow mainnet; written accounts remain part of the
fork's state. Rebase refreshes untouched accounts, not the accounts you changed.

The MCP tools include `dev_status`, `dev_step`, `dev_instance`, `dev_actions`,
`dev_warp`, `dev_scenario` and `dev_events`. Hosted protocol tools accept
`dev: true` to use the project's dev deployment. See [agents.md](agents.md)
for the prepare/check/sign/submit flow and optional local signer.

## Deploying your own protocol

Deploying is an external mutation: do it only when the user asked for it.

```bash
a4 protocol deploy --dry-run             # builds; files, expected release hash, slug, create vs reuse, programs to push
a4 protocol deploy --fee-policy fee-policy.json --resource launchDefaults=launch-defaults.json
a4 protocol deploy --no-activate --json
```

It needs a secret key (publishable keys are refused). It:

1. **Builds** with `arete-protocol build`. `--no-build` uploads the existing
   `.arete/protocol/` output instead and refuses it, naming the changed
   files, when a source changed since that build.
2. **Pushes programs installed from a local IDL.** Arete only checks
   templates against, compiles stacks from and packages programs it has, so
   each `source = { idl = … }` program is registered as your private program
   (alias `<slug>-<alias>`) unless your account or the registry already has
   that exact ProgramSpec. It waits for the admission
   (`waiting: program <alias> admission queued`, bounded by `--wait-secs`),
   records the Program Release in `arete.lock` and rebuilds. An IDL that no
   longer matches `arete.lock` is refused: run `a4 install` first.
   `--dry-run` only lists these programs.
3. Uploads only `protocol-spec.json` (plus `handlers.mjs` when a step has a
   handler); the server derives the release (`npx arete-protocol build
   --server-release` predicts its hash; deploy warns if they differ).
4. Reuses or creates a private deployment. A new one needs a fee policy
   (`"schema": "arete.protocol-fee-policy/v1"`) and a value for each declared
   resource; defaults can live in `[protocol]` of `arete.toml`
   (`access = "private"` is the only accepted value).
5. Activates it, unless `--no-activate`.
6. Updates the project's own client to the new deployment (below).

| Protocol | Outcome (`status` in `--json`) |
|---|---|
| Template-only | `active`: a private deployment at trust tier `unreviewed`. Activation waits (`waiting: …`, up to `--wait-secs`) while the server prepares the deployment and its stack. If the wait runs out, the deployment is not active yet and `pending` says why; run deploy again to finish. |
| Has handlers | `review-required`: the deployment exists, but handler code runs only after Arete reviews the release. Share the printed release hash and deployment id; Arete reviews and activates it. Owners never activate handler code. |
| Public | Not self-serve. Every self-serve deployment is private. |

An unreviewed deployment runs no author code, is visible only to your
account, and is not a reviewed or public listing. Don't present it as either.

### The registry package

Activation publishes an **owner-private** registry package of the protocol
(slug and spec version), reported as `registryPackage`:

| `status` | Meaning | Do |
|---|---|---|
| `published` | `Published the private registry package <slug>@<version>` | nothing |
| `existing` | already published for this release and deployment (`(already published)`) | nothing |
| `skipped` | nothing published, with `code` and `message`; the deployment is still active | `package-version-immutable`: that version already pins other content, so bump `version` in `protocol.ts` and deploy again. Otherwise fix what `message` names and deploy again. |

Then:

- **The project's own client.** If `arete.toml` installs this protocol
  (`a4 dev up` adds it), deploy moves the dependency to `^<deployed
  version>` and reinstalls the published package; the client now calls the
  production deployment. While no package is available it generates the
  client from the deployed build and keeps `local_build`. A project with no
  client gets a hint: `a4 install protocol <slug> --ts`.
- **Other projects of the same account** install it like a stack, with no
  deployment flag: `a4 install protocol <slug> --ts` (or `--rust`,
  `--python`). Other accounts can't resolve an owner-private package.
- **CI.** `a4 install --check` changes nothing and fails while any protocol
  client is a local build from `a4 dev` or isn't the release `arete.lock`
  pins. `a4 install --locked` restores the published clients. Both need the
  registry that published the package.

## Troubleshooting

- Service disabled or access denied: report the account/service result and keep
  production separate. Repeated retries do not grant access.
- RPC unavailable: check `a4 dev status`, the selected environment and whether
  `a4 dev up` is still forwarding. Environment tokens expire and are renewed
  by the CLI; do not hard-code them.
- Build or activation failure: read the diagnostics in the CLI or dev UI.
  Verify installed program modules and `arete.lock` before rebuilding.
- Wrong environment: inspect `a4 dev status --json` and `ARETE_DEV_ENV` before
  another mutation; use `a4 dev use --help` to select the intended environment.
- Missing generated client: run `a4 dev sdk` for the intended language and read
  its README. Reload the app after the deployment changes.

See the public [cloud dev guide](https://docs.arete.run/cli/local-development/)
and [application guide](https://docs.arete.run/development/application/) for
current commands and connection details.
