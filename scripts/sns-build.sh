#!/usr/bin/env bash
set -Eeuo pipefail

# ===================== Config (env-overridable) =====================
: "${IC_REPO:=$(pwd)/ic}"                 # Path to the dfinity/ic submodule (do NOT auto-update here)
: "${TARGET:=wasm32-unknown-unknown}"     # Cargo target
: "${PROFILE:=release}"                   # 'release' | 'debug' | custom profile
: "${SNS_SET:=governance,root,swap,ledger,index}"   # What to build
: "${DFX_JSON:=$(pwd)/dfx.json}"          # Path to dfx.json
# ===================================================================

log() { echo -e "\033[1;34m[ sns-build ]\033[0m $*"; }
err() { echo -e "\033[1;31m[ sns-build ]\033[0m $*" >&2; }
die() { err "$@"; exit 1; }
need_bin() { command -v "$1" >/dev/null 2>&1; }

ensure_prereqs() {
  [[ -d "$IC_REPO/rs" ]] || die "IC_REPO does not look like 'dfinity/ic': $IC_REPO"
  [[ -f "$DFX_JSON"    ]] || die "dfx.json not found at: $DFX_JSON"
  need_bin cargo   || die "cargo not found"
  need_bin rustup  || die "rustup not found"
  need_bin ic-wasm || die "ic-wasm not found (project prerequisite)"
  # JSON parser: prefer jq; fallback to node
  if ! need_bin jq && ! need_bin node; then
    die "Neither 'jq' nor 'node' found. Install one to parse dfx.json."
  fi
  rustup target add "$TARGET" >/dev/null
}

# Read JSON value by path (dot notation) from dfx.json
json_get() {
  local path="$1"
  if need_bin jq; then
    jq -r ".$path // empty" "$DFX_JSON"
  else
    node -e '
      const fs=require("fs");
      const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const p=process.argv[2].split(".");
      let v=o; for(const k of p){ if(v==null){v="";break;} v=v[k]; }
      if(v==null){ v=""; }
      if(typeof v==="string") console.log(v);
      else if(typeof v==="number") console.log(String(v));
      else if(typeof v==="boolean") console.log(v?"true":"false");
      else console.log("");
    ' "$DFX_JSON" "$path"
  fi
}

# Compute Cargo target directory for a given profile
profile_dir() {
  case "$PROFILE" in
    release) echo "release" ;;
    debug)   echo "debug"   ;;
    *)       echo "$PROFILE" ;;
  esac
}

# Find newest *.wasm in directory (no time filter) — cross-platform via Node
find_newest_wasm_any() {
  local dir="$1"
  node -e '
    const fs=require("fs"), path=require("path");
    const dir=process.argv[1];
    let best=null;
    for(const f of (fs.existsSync(dir)?fs.readdirSync(dir):[])){
      if(!f.endsWith(".wasm")) continue;
      const p=path.join(dir,f);
      const st=fs.statSync(p);
      if(!best || st.mtimeMs > best.m){ best={m:st.mtimeMs, f:p}; }
    }
    if(best) console.log(best.f);
  ' "$dir"
}

# Find newest .wasm produced after a timestamp (first try)
find_newest_wasm_since() {
  local dir="$1" since_ts="$2"
  node -e '
    const fs=require("fs"), path=require("path");
    const dir=process.argv[1], since=Number(process.argv[2]||0)*1000;
    let best=null;
    for(const f of (fs.existsSync(dir)?fs.readdirSync(dir):[])){
      if(!f.endsWith(".wasm")) continue;
      const p=path.join(dir,f);
      const st=fs.statSync(p);
      if(st.mtimeMs < since) continue;
      if(!best || st.mtimeMs > best.m){ best={m:st.mtimeMs, f:p}; }
    }
    if(best) console.log(best.f);
  ' "$dir" "$since_ts"
}

# Shrink wasm binary
optimize_wasm() {
  local in="$1" out="$2"
  ic-wasm "$in" -o "$out" shrink
}

# Extract Candid via ic-wasm metadata; write to file if present
extract_did_from_wasm() {
  local wasm="$1" did_out="$2"
  if ic-wasm "$wasm" metadata candid:service > "$did_out".tmp 2>/dev/null; then
    if [[ -s "$did_out".tmp ]]; then
      mv -f "$did_out".tmp "$did_out"
      return 0
    fi
  fi
  rm -f "$did_out".tmp
  return 1
}

ensure_parent_dir() { mkdir -p "$(dirname "$1")"; }

cargo_build() {
  local manifest="$1"
  if [[ "$PROFILE" == "release" ]]; then
    cargo build --manifest-path "$manifest" --target "$TARGET" --release
  elif [[ "$PROFILE" == "debug" ]]; then
    cargo build --manifest-path "$manifest" --target "$TARGET"
  else
    cargo build --manifest-path "$manifest" --target "$TARGET" --profile "$PROFILE"
  fi
}

# Resolve ledger/index locations inside mono-repo and set their expected basenames
detect_ledger_paths() {
  if [[ -d "$IC_REPO/rs/ledger_suite/icrc1/ledger" ]]; then
    LEDGER_DIR="rs/ledger_suite/icrc1/ledger"
  else
    LEDGER_DIR="$(cd "$IC_REPO" && find rs/ledger_suite -type d -path '*/icrc1/*/ledger' | head -n1 || true)"
  fi
  [[ -n "${LEDGER_DIR:-}" ]] || die "ICRC-1 ledger dir not found in 'rs/ledger_suite'."
  LEDGER_BASENAME="ic-icrc1-ledger.wasm"

  if   [[ -d "$IC_REPO/rs/ledger_suite/icrc1/index-ng" ]]; then
    INDEX_DIR="rs/ledger_suite/icrc1/index-ng"
    INDEX_BASENAME="ic-icrc1-index-ng.wasm"
  elif [[ -d "$IC_REPO/rs/ledger_suite/icrc1/index" ]]; then
    INDEX_DIR="rs/ledger_suite/icrc1/index"
    INDEX_BASENAME="ic-icrc1-index.wasm"
  else
    die "ICRC-1 index(-ng) dir not found in 'rs/ledger_suite'."
  fi
}

# Build crate and place artifacts according to dfx.json; prefer expected wasm basename
build_and_place() {
  local can_key="$1" src_rel="$2" expected_basename="$3"

  local wasm_out candid_out
  wasm_out="$(json_get "canisters.${can_key}.wasm")"
  candid_out="$(json_get "canisters.${can_key}.candid")"
  [[ -n "$wasm_out"   ]] || die "Missing 'wasm' path in dfx.json for ${can_key}"
  [[ -n "$candid_out" ]] || die "Missing 'candid' path in dfx.json for ${can_key}"

  local src_dir="$IC_REPO/$src_rel"
  [[ -f "$src_dir/Cargo.toml" ]] || die "Cargo.toml not found: $src_rel"

  log "=== [${can_key}] cargo build ($src_rel) ==="
  local start_ts; start_ts="$(date +%s)"
  ( cd "$IC_REPO" && cargo_build "$src_dir/Cargo.toml" )

  local tgt="$IC_REPO/target/$TARGET/$(profile_dir)"
  [[ -d "$tgt" ]] || die "Cargo target dir missing: $tgt"

  # 1) Try exact expected basename
  local wasm=""
  if [[ -n "$expected_basename" && -f "$tgt/$expected_basename" ]]; then
    wasm="$tgt/$expected_basename"
  else
    # 2) Try newest since start_ts (fresh rebuild)
    wasm="$(find_newest_wasm_since "$tgt" "$start_ts" || true)"
    # 3) Fallback: newest any (covers cached builds with older mtime)
    [[ -n "$wasm" ]] || wasm="$(find_newest_wasm_any "$tgt" || true)"
  fi
  [[ -f "${wasm:-}" ]] || die "No wasm artifact found for ${can_key} in $tgt"

  # Optimize → store exactly where dfx.json expects
  ensure_parent_dir "$wasm_out"
  local opt_tmp="$(dirname "$wasm_out")/.${can_key}.opt.wasm"
  optimize_wasm "$wasm" "$opt_tmp"
  mv -f "$opt_tmp" "$wasm_out"

  # Extract Candid → store exactly where dfx.json expects
  ensure_parent_dir "$candid_out"
  if ! extract_did_from_wasm "$wasm_out" "$candid_out"; then
    local did_src; did_src="$(ls "$src_dir"/*.did 2>/dev/null | head -n1 || true)"
    if [[ -n "$did_src" ]]; then
      cp -f "$did_src" "$candid_out"
      log "(!) candid extracted from local .did (no metadata in wasm) → $candid_out"
    else
      err "(!) candid not found for ${can_key} (no wasm metadata and no crate .did)"
    fi
  fi

  log "✓ ${can_key}: wasm → $wasm_out ; did → $candid_out"
}

detect_ledger_paths_and_build() {
  detect_ledger_paths
  build_and_place "sns_ledger" "$LEDGER_DIR" "$LEDGER_BASENAME"
  build_and_place "sns_index"  "$INDEX_DIR"  "$INDEX_BASENAME"
}

main() {
  ensure_prereqs

  IFS=',' read -r -a parts <<< "$SNS_SET"
  for part in "${parts[@]}"; do
    case "$part" in
      governance) build_and_place "sns_governance" "rs/sns/governance" "sns-governance-canister.wasm" ;;
      root)       build_and_place "sns_root"       "rs/sns/root"       "sns-root-canister.wasm"       ;;
      swap)       build_and_place "sns_swap"       "rs/sns/swap"       "sns-swap-canister.wasm"       ;;
      ledger)     detect_ledger_paths_and_build ;;
      index)      detect_ledger_paths_and_build ;;  # handles both ledger/index if requested
      *)          die "Unknown part: $part (expected: governance,root,swap,ledger,index)" ;;
    esac
  done

  log "Done. Artifacts placed according to dfx.json."
}

main "$@"
