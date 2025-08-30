#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Fetch SNS canisters (.wasm.gz) from download.dfinity.systems for a given IC
# RELEASE COMMIT, verify SHA-256 (optional), unpack to .wasm, extract Candid
# .did via ic-wasm, and delete the .gz files. Matches your dfx.json layout.
#
# Output layout:
#   canisters/sns/
#     sns-root-canister.wasm
#     sns-governance-canister.wasm
#     sns-swap-canister.wasm
#     ic-icrc1-ledger.wasm
#     ic-icrc1-index-ng.wasm
#   canisters/sns/did/
#     sns-root-canister.wasm.did
#     sns-governance-canister.wasm.did
#     sns-swap-canister.wasm.did
#     ic-icrc1-ledger.wasm.did
#     ic-icrc1-index-ng.wasm.did
#
# How to update the IC commit (RELEASE COMMIT):
#   1) Go to releases: https://github.com/dfinity/ic/releases
#   2) Open the desired release.
#   3) Copy the 40-char GIT COMMIT hash referenced by that release (the commit
#      used by the artifacts on download.dfinity.systems).
#   4) Edit DEFAULT_IC_COMMIT below (or override via env/CLI).
#
# Usage:
#   # 1) Defaults to DEFAULT_IC_COMMIT (edit in script)
#   ./fetch_sns_canisters.sh
#
#   # 2) Override via environment
#   IC_COMMIT=<40-hex> ./fetch_sns_canisters.sh
#
#   # 3) Override via CLI (highest priority)
#   ./fetch_sns_canisters.sh -c <40-hex>
#   ./fetch_sns_canisters.sh --commit <40-hex>
#   # or as positional first arg:
#   ./fetch_sns_canisters.sh <40-hex>
#
# Requirements:
#   - bash >= 4 (associative arrays)
#   - curl, gzip (gunzip)
#   - ic-wasm  (install: `cargo install ic-wasm`)
#   - sha256sum (Linux) or shasum -a 256 (macOS)
# ------------------------------------------------------------------------------

set -euo pipefail

# --- EDIT THIS CONSTANT ONLY for regular updates --------------------------------
DEFAULT_IC_COMMIT="91732387a03c7c82bdaea6f78d7f8321cc8cb559"
# ------------------------------------------------------------------------------

# --- CLI parsing (commit from args has highest priority) ------------------------
print_usage() {
  cat <<'EOF'
Usage:
  fetch_sns_canisters.sh [options] [<IC_COMMIT>]

Options:
  -c, --commit <IC_COMMIT>   Specify the 40-hex IC commit explicitly.
  -h, --help                 Show this help and exit.

Priority for resolving IC_COMMIT:
  CLI (-c/--commit or positional) > env(IC_COMMIT) > DEFAULT_IC_COMMIT (in script)
EOF
}

COMMIT_FROM_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--commit)
      [[ $# -ge 2 ]] || { echo "ERROR: Missing value for $1" >&2; exit 1; }
      COMMIT_FROM_ARG="$2"; shift 2;;
    -h|--help)
      print_usage; exit 0;;
    -*)
      echo "ERROR: Unknown option: $1" >&2
      print_usage; exit 1;;
    *)
      # positional (first non-option token is treated as commit)
      if [[ -z "${COMMIT_FROM_ARG}" ]]; then
        COMMIT_FROM_ARG="$1"; shift
      else
        echo "ERROR: Unexpected extra argument: $1" >&2
        print_usage; exit 1
      fi
      ;;
  esac
done

IC_COMMIT="${COMMIT_FROM_ARG:-${IC_COMMIT:-$DEFAULT_IC_COMMIT}}"

# --- Constants ------------------------------------------------------------------
readonly BASE_URL="https://download.dfinity.systems/ic"
readonly TARGET_DIR="canisters/sns"
readonly DID_DIR="${TARGET_DIR}/did"

# Artifact base names on download.dfinity.systems:
ARTIFACTS=(
  "sns-root-canister"
  "sns-governance-canister"
  "sns-swap-canister"
  "ic-icrc1-ledger"
  "ic-icrc1-index-ng"
)

# Optional expected SHA256 for *.wasm.gz (fill to enforce verification).
# Example:
# EXPECTED_SHA256_GZ["sns-governance-canister"]="9b5c...<64 hex>..."
declare -A EXPECTED_SHA256_GZ=(
  ["sns-root-canister"]=""
  ["sns-governance-canister"]=""
  ["sns-swap-canister"]=""
  ["ic-icrc1-ledger"]=""
  ["ic-icrc1-index-ng"]=""
)

# --- Helpers -------------------------------------------------------------------
need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: '$1' not found in PATH. Please install it." >&2
    exit 1
  }
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

fetch_gz() {
  local name="$1"
  local url="${BASE_URL}/${IC_COMMIT}/canisters/${name}.wasm.gz"
  local out_gz="${TARGET_DIR}/${name}.wasm.gz"

  echo "↓ Downloading ${name}.wasm.gz"
  curl -fL --retry 3 --retry-delay 2 -o "${out_gz}" "${url}"
}

verify_gz_sha256() {
  local name="$1"
  local gz_path="${TARGET_DIR}/${name}.wasm.gz"
  local want="${EXPECTED_SHA256_GZ[$name]:-}"
  local got

  if [[ -n "${want}" ]]; then
    echo "• Verifying SHA-256 for ${name}.wasm.gz"
    got="$(sha256_of "${gz_path}")"
    if [[ "${got}" != "${want}" ]]; then
      echo "ERROR: SHA-256 mismatch for ${name}.wasm.gz" >&2
      echo "       expected: ${want}" >&2
      echo "       got:      ${got}" >&2
      echo "       (file kept for inspection: ${gz_path})" >&2
      exit 1
    fi
  else
    got="$(sha256_of "${gz_path}")"
    echo "• ${name}.wasm.gz sha256 = ${got}"
  fi
}

gunzip_to_wasm_and_delete_gz() {
  local name="$1"
  local in_gz="${TARGET_DIR}/${name}.wasm.gz"
  local out_wasm="${TARGET_DIR}/${name}.wasm"

  echo "• Unpacking ${name}.wasm.gz → ${name}.wasm"
  gzip -dc "${in_gz}" > "${out_wasm}"
  rm -f "${in_gz}"

  local wasm_sha
  wasm_sha="$(sha256_of "${out_wasm}")"
  echo "• ${name}.wasm sha256 = ${wasm_sha}"
}

extract_did() {
  local name="$1"
  local in_wasm="${TARGET_DIR}/${name}.wasm"
  local out_did="${DID_DIR}/${name}.wasm.did"

  echo "• Extracting Candid to ${name}.wasm.did"
  if ! ic-wasm "${in_wasm}" metadata candid:service > "${out_did}"; then
    echo "ERROR: Could not extract Candid metadata from ${in_wasm}." >&2
    echo "       Ensure the artifact contains 'candid:service' metadata or extract from sources." >&2
    exit 1
  fi

  if [[ ! -s "${out_did}" ]]; then
    echo "ERROR: Empty DID extracted for ${name}. Check the artifact or toolchain." >&2
    exit 1
  fi
}

# --- Pre-flight ----------------------------------------------------------------
need bash
need curl
need gzip
need ic-wasm
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  echo "ERROR: Neither 'sha256sum' nor 'shasum' found. Please install one." >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}" "${DID_DIR}"

if [[ ! "${IC_COMMIT}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "WARNING: IC_COMMIT (${IC_COMMIT}) does not look like a 40-char SHA." >&2
  echo "         Make sure you copied the RELEASE COMMIT from the GitHub release." >&2
fi

echo "Using IC_COMMIT=${IC_COMMIT}"
echo "Output:"
echo "  WASM dir: ${TARGET_DIR}"
echo "  DID dir:  ${DID_DIR}"
echo

# --- Main ----------------------------------------------------------------------
for name in "${ARTIFACTS[@]}"; do
  fetch_gz "${name}"
  verify_gz_sha256 "${name}"
  gunzip_to_wasm_and_delete_gz "${name}"
  extract_did "${name}"
  echo
done

echo "✔ All SNS canisters downloaded, verified (if expected provided), unpacked, and DID files extracted."
echo "  WASM files: ${TARGET_DIR}"
echo "  DID files:  ${DID_DIR}"
