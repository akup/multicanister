# Pocket IC Core Service

A service for managing Internet Computer (IC) core components, including version tracking, WASM file management, and core metadata storage.

## Features

- Wrap PocketIC server and keep it alive
- Store and manage [ICR (internet computer registry)](https://github.com/akup/multicanister) core components
- Track core canisters versions with branch, tag, and commit information
- Calculate and store WASM file hashes
- REST API for core management

## Prerequisites

- Node.js (v16 or higher)
- pnpm package manager

## Installation

1. Install dependencies:

```bash
pnpm install
```

## Starting the Service

Before start set bin pocket-ic path at environment variable

```bash
export POCKET_IC_BIN=${YOUR_PATH_TO_POCKET_IC}
```

Or put POCKET_IC_BIN variable into project root .env file

Also set the POCKET_IC_STATE_DIR environment variable with a full path for state directory.
If this directory doesn't exist it will be created and will store network topology and subnets states: deployed canisters and memory state.

Run the development server:

```bash
pnpm dev-start
```

The server will start on port 8092, pocketIC on 4943 and pocketIC live gateway on 4944 ports by default. You can specify a different ports using the `-p`, `pic-p`, `gw-p` flags:

```bash
pnpm dev-start -p 8080 -pic-p 4944 -gw-p 4945
```

## API Endpoints

### List Cores

```http
GET /api/list-core
```

Returns a list of all registered cores with their metadata.

Example response:

```json
{
  "core1": {
    "canisterIds": [],
    "wasmHash": "abc123...",
    "branch": "main",
    "tag": "v1.0.0",
    "commit": "abc123",
    "corrupted": false
  }
}
```

### Upload Core

```http
POST /api/upload
```

Upload a new core component with its metadata.

Required form fields:

- `file`: The WASM file to upload
- `sha256`: Sha256 of a wasm file
- `name`: Core component name
- `branch`: Git branch name (defaults to 'main')
- `tag`: Version tag (defaults to 'latest')
- `commit`: Git commit hash (defaults to 'latest')
- `updateStrategy`: Install mode for corrupted canisters ('upgrade' or 'reinstall', defaults to 'upgrade')

Installation behavior:

- If canister doesn't exist: Performs a fresh install
- If canister exists and matches stored hash: Performs an upgrade
- If canister exists but hash doesn't match (corrupted): Uses the `uncorrupt` parameter to determine install mode
  - `upgrade`: Upgrades the canister (default)
  - `reinstall`: Reinstalls the canister

Example using curl:

```bash
curl -X POST -F "file=@path/to/your/file.wasm" \
  # Dynamically calculate the sha256 checksum of the wasm file
  -F "sha256=$(sha256sum path/to/your/file.wasm | awk '{print $1}')" \
  -F "name=my-core" \
  -F "branch=main" \
  -F "tag=v1.0.0" \
  -F "commit=abc123" \
  -F "uncorrupt=upgrade" \
  http://localhost:8092/api/upload
```

Example response:

```json
{
  "message": "File uploaded successfully",
  "data": {
    "name": "my-core",
    "wasmHash": "abc123...",
    "branch": "main",
    "tag": "v1.0.0",
    "commit": "abc123",
    "corrupted": false
  }
}
```

## Data Storage

- Core metadata is stored in JSON files under `ic-data/cores/`
- Uploaded files are temporarily stored in `ic-data/uploads/` and automatically cleaned up after processing

## Error Handling

The service includes automatic cleanup of incomplete uploads and proper error handling for:

- Missing required parameters
- File upload failures
- Invalid file formats
- Storage errors

## Development

- Run linting: `pnpm lint`
- Fix linting issues: `pnpm lint:fix`
- Format code: `pnpm format`
- Type checking: `pnpm check-types`

## Accessing canister

Pocket IC is started on 4943 port by default, if `-pic-p` is not specified. And Pocket IC gateway is started on 4944 port if `-gw-p` is not specified.

You can access canisters at

`http://localhost:4944/?canisterId=${your_canister_id}`
