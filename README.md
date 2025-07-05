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

Install pnpm

```sh
npm i pnpm -g
pnpm install
```

Install PocketIc, according to instruction for your platform
https://github.com/dfinity/pocketic

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

Then you can start ICR CLI and point it to your Core Service (--pics, --pocket-server option or in POCKET_IC_CORE_URL environment varable)

```bash
pnpm dev-icr-cli
```
