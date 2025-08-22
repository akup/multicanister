# ICR (internet computer registry) - Monorepo Multicanister Orchestration Project

Project helps to deploy and orchestrate multicanister environment for IC.

This monorepo provides a comprehensive multicanister orchestration framework for the [Internet Computer](https://github.com/DFINITY): it bundles a TypeScript-based Pocket IC Core Service that wraps [Pocket IC](https://github.com/dfinity/pocketic) exposes REST endpoints to upload, list, and manage WASM binaries with full metadata (branch, tag, commit, hash, and corruption state), and an ICR CLI tool that leverages DFX to build canisters, calculate SHA-256 checksums, and automate fresh installs, upgrades, or reinstallations via the Pocket IC Core API. Together, these components enable robust version tracking, integrity validation, and seamless deployment workflows for complex multi-canister applications.

## Pocket IC Core Service

It uses 'core' word because multicanister orchestration framework consists of core canisters and environment, that are specified at `core.json` and `environment.json`.
Core canisters are:

- registry-factory - it contains registry of deployed canisters and orchestrate them taking care of scaling by sharding and replicating. Moreover it provides routing framework that helps canisters to communicate in a location transparancy style: canisters should know only service names, but not the canisterId to communicate.
- internet-identity - is default ii canister
- candid ui - is a default [CandidUI Canister](https://github.com/dfinity/candid/tree/master/tools/ui) that helps to rapidly test deployed canisters with a simple UI

Pocket IC Core Service helps to manage core canisters, that are deployed to a wrapped Pocket IC. All other canisters that are listed in `environment.json` will be managed and deployed via registry-factory, that is part of the core canisters.

This workflow makes seemless inhouse development and production environments.

## Installation

### Install pnpm

```sh
npm i pnpm -g
pnpm install
```

### Install PocketIc

According to instruction for your platform
[https://github.com/dfinity/pocketic](https://github.com/dfinity/pocketic)

Add it to your .profile

```sh
export POCKET_IC_BIN="$PATH_TO_DOWNLOADED_BIN/pocket-ic"
```

and source it

Then you can run in terminal in any folder:

```sh
$POCKET_IC_BIN --help
```

Also it uses [pic-js](https://github.com/dfinity/pic-js) modified to [use live mode](https://github.com/akup/picjs-fork). This changes are subject for PR.
It is referenced from `typescript/pic` and should be submodule (TODO).

### Install didc

Copy latest `didc` release from [https://github.com/dfinity/candid/releases](https://github.com/dfinity/candid/releases) to your `~/bin/didc`. Make it executable:

```bash
chmod +x ~/bin/didc
```

and add `~/bin` to your path.

Check it is already in you path:

```bash
echo $PATH | grep -o "$HOME/bin"
```

if not add it to your `~/.profile`:

```bash
export PATH="$HOME/bin:$PATH"
```

and apply it:

```bash
source ~/.profile
```

On mac give permissions to run to didc at your `System settings->Confidentaility and security->Security`

Check it is installed:

```bash
didc --version
```

## Project structure

```txt
|- canisters           - here are all canisters (core and applications that should be deployed by core)
|- innerDfxProjects    - here we reference dfx tooling canisters that are needed in core deployment
|- typescript
| |- _eslint-config    - turborepo default eslint configs (referenced by other projects)
| |- _prettier-config  - turborepo default prettier configs (referenced by other projects)
| |- _eslint-config    - turborepo default typescript configs (referenced by other projects)
| |- icr-cli           - Command line tool to build canisters and upload to remote PIC and factories
| |- pic               - Clone of Pic JS with some upgrades (extending during development) not merged yet to @dfinity/pic
| |- pocket-ic-core    - Wrapper around PIC, helps to manage core canisters via http interface and runs the PIC
|- libs                - contains old project templates (unused and will be cleared)
```

## Submodules

`innerDfxProjects` folder contains [Candid](https://github.com/dfinity/candid) submodule that is configured to sparse tools/ui folder. So only [CandidUI Canister](https://github.com/dfinity/candid/tree/master/tools/ui) is cloned.

> **Important Note:** It will fail to build unless you remove or comment out the `candid` patch in your root `Cargo.toml`. For example:
>
> ```toml
> # [patch.crates-io.candid]
> # path = "../../rust/candid"
> ```

During build ICR CLI tool will go throwgh all folders to find `dfx.json` files, all of them will be applyed in the build from folder leafs, to the root. Core canisters can be used from inner dfx projects, so submodules can be added and deployed as part of core or environment like it is done with CandidUI Canister.

## Starting the Services

Before start follow instructions of preparing [Pocket IC Core Service](https://github.com/akup/multicanister/tree/main/typescript/pocket-ic-core) and [ICR CLI](https://github.com/akup/multicanister/tree/main/typescript/icr-cli)

You can start services for development from the root folder.
First start the Pocket IC Core service locally, or deploy it to your clowd according to instructions

```bash
pnpm dev-pocket-ic-core
```

Then you can start ICR CLI and point it to your Core Service (--pics, --pocket-server option or in `POCKET_IC_CORE_URL` environment varable)

Default `POCKET_IC_CORE_URL` is contained at `.\typescript\icr-cli\.env`

```bash
pnpm dev-icr-cli
```

It will build and upload to PIC canisters according to `.\core.json`

By default Pocket IC core starts PIC gateway on 4944 port. You can access canisters at

`http://localhost:4944/?canisterId=${your_canister_id}`

For example if you start with default core.json, you will see following log of `pnpm dev-icr-cli`:

```json
{
  candid_ui: {
    canisterIds: [ '$candid_ui_canister_id' ],
    wasmHash: 'b07c0258fad470be5e364ebf28e3ad5c7a59d8bf0e5820481fa8c3cc6c6cb565',
    branch: 'main',
    tag: 'latest',
    commit: 'latest',
    corrupted: false
  },
  factory: {
    canisterIds: [ '$factory_canister_id' ],
    wasmHash: '0eaefbc57820879f2af89452f5a7e812cfa47522d8b03329bd6197c80dcce33b',
    branch: 'main',
    tag: 'latest',
    commit: 'latest',
    corrupted: false
  }
}
```

Just use `$candid_ui_canister_id` to access default candid ui: `http://localhost:4944/?canisterId=${candid_ui_canister_id}`

## Developing factory and icr-cli

As factory can.did changes during development, you should update declarations at `typescript/icr-cli/src/declarations/factory`. It could be done simply by running from `typescript/icr-cli` folder:

```bash
npm run gen-factory-idl
```

It will replace `factory.did.js` `factory.did.d.ts` based on can.did file specified at `dfx.json` for factory (`canisters/factory/can.did`)

`factoryService` at `typescript/icr-cli/src/services` utilizes this declarations and is also subject to change on factory interface updates.
