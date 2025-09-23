# sns-dump-init

Utility that generates per-canister init arguments for SNS canisters from a
**v2 `sns_init.yaml`** and a JSON file with pre-created canister IDs.

This tool is used for **local and CI/staging deployments (Pocket IC, etc.)** so
that the configuration you test matches the configuration intended for mainnet,
where releases are pushed via CI and **approved by the DAO** to keep updates
decentralized.

It reuses the same friendly parser and normalization logic as `dfx sns`
(via `ic/rs/sns/cli` sources) to stay consistent with production semantics.

## Why

- `sns_init.yaml` (v2 with units) is the canonical SNS configuration used in the
  project’s release flow. After tests are complete, a release is created and a
  GitHub workflow pushes it to mainnet, where **the DAO approves** the update.
- For local/CI environments, SNS canister IDs are provisioned up front (Pocket IC).
  We need binary init args (`*.arg.bin`) for `sns_governance`, `sns_root`,
  `sns_ledger`, `sns_swap`, and `sns_index` based on **the same YAML** —
  without editing it — to keep parity with mainnet configuration.

## Inputs

- `--init-config`: path to **v2** `sns_init.yaml`.
- `--canister_ids`: JSON with keys:
  `sns_root`, `sns_governance`, `sns_ledger`, `sns_swap`, `sns_index`
  (string principal IDs).
- `--out-dir`: directory for outputs.

Example `canister_ids`:
```json
{
  "sns_governance": "7uieb-cx777-77776-qaaaq-cai",
  "sns_ledger":     "75lp5-u7777-77776-qaaba-cai",
  "sns_root":       "72kjj-zh777-77776-qaabq-cai",
  "sns_swap":       "7pnye-yp777-77776-qaaca-cai",
  "sns_index":      "7im6q-vx777-77776-qaacq-cai"
}
