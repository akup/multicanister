# ICR (internet computer registry) Cli tool

This tool helps to build, deploy and orchestrate multi-canister environments. It builds and deploys registry-factory to Pocket IC, and then build and deploys canisters from environment.json using the registry-factory. It works together with Pocket IC Core Service.

## Features

...

## Prerequisites

- Node.js (v16 or higher)
- pnpm package manager

## Installation

1. Install dependencies:
```bash
pnpm install
```

Also to add candid metadata to builded wasm and optimize it, [ic-wasm](https://github.com/dfinity/ic-wasm) is used and should be installed:
```bash
cargo install ic-wasm
```

## Starting the Service

On deploy and test it connects to [pocket ic core server](https://github.com/link). It should be started, and it's url should be provided in --pics, --pocket-server option or in $POCKET_IC_CORE_URL environment varable
For example change dev-start command int package.json to:
```bash
nodemon -r tsconfig-paths/register ./src/index.ts deploy --d ../../ --pics http://localhost:8092
```

Privide the --d, --dir option to set working dir, where root dfx.json file is located.

Then run the ICR Cli tool:
```bash
pnpm dev-start
```

It will build canisters from core.json and environment.json, and will connect to Pocket IC Core Service to deploy registry-factory (specified in core.json).
When factory is deployed to Pocket IC Core Service, ICR Cli will upload canister wasms listed in environment.json to core service that will deploy them using specified registry-factory.

## Cli commands help


## Development

- Run linting: `pnpm lint`
- Fix linting issues: `pnpm lint:fix`
- Format code: `pnpm format`
- Type checking: `pnpm check-types` 