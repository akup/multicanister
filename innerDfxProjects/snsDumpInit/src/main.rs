use anyhow::{Context, Result, anyhow};
use clap::Parser;
use candid::Encode;
use ic_base_types::PrincipalId;
use ic_sns_init::{pb::v1::SnsInitPayload, SnsCanisterIds};
use ic_nns_governance_api::CreateServiceNervousSystem;
use std::{fs, path::{Path, PathBuf}, str::FromStr};

/// Shim so `friendly.rs` can find `crate::unit_helpers` under the expected path.
#[allow(unused_imports)]
mod unit_helpers {
    pub use ic_sns_cli::unit_helpers::*;
}

/// Pulls in the CLI's friendly v2 YAML parser verbatim to guarantee identical
/// parsing/normalization semantics without depending on private modules.
#[allow(dead_code, unused_imports)]
mod friendly {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../ic/rs/sns/cli/src/init_config_file/friendly.rs"
    ));
}
use friendly::SnsConfigurationFile;

#[derive(Debug, Parser)]
struct Args {
    /// Path to sns_init.yaml (v2 format with units)
    #[arg(long)]
    init_config: PathBuf,
    /// JSON with SNS canister IDs {sns_root, sns_governance, sns_ledger, sns_swap, sns_index}
    #[arg(long)]
    canister_ids: PathBuf,
    /// Output dir for *.arg.bin and summary json
    #[arg(long)]
    out_dir: PathBuf,
}

/// Mirrors `read_create_service_nervous_system_from_init_yaml` from the CLI:
/// read v2 YAML -> friendly struct -> convert to CreateServiceNervousSystem.
fn read_csns_from_yaml(path: & Path) -> Result<CreateServiceNervousSystem> {
    let contents = fs::read_to_string(path)
        .with_context(|| format!("Unable to read {:?}", path))?;
    let configuration: SnsConfigurationFile =
        serde_yaml::from_str(&contents)
            .with_context(|| format!("Unable to parse contents of {:?} as SNS v2 config", path))?;
    let base_path = path.parent()
        .with_context(|| format!("Configuration file path ({:?}) has no parent", path))?;
    let csns = configuration
        .try_convert_to_create_service_nervous_system(base_path)
        .with_context(|| format!("Invalid configuration in {:?}", path))?;
    Ok(csns)
}

fn main() -> Result<()> {
    let args = Args::parse();
    fs::create_dir_all(&args.out_dir)?;

    // Parse v2 YAML to CSNS using the same logic as the official CLI.
    let mut csns = read_csns_from_yaml(&args.init_config)?;

    // Align with testflight behavior: force-disable Neurons' Fund if present.
    if csns.swap_parameters
        .as_ref()
        .and_then(|p| p.neurons_fund_participation)
        .unwrap_or(false)
    {
        println!("Neurons' Fund participation is ignored for testflight and will be treated as disabled.");
        if let Some(p) = csns.swap_parameters.as_mut() {
            p.neurons_fund_participation = Some(false);
        }
    }

    // Convert to SnsInitPayload (same conversion as CLI).
    let mut payload: SnsInitPayload = SnsInitPayload::try_from(csns)
        .map_err(|e| anyhow!("Invalid configuration after conversion to SnsInitPayload: {e}"))?;

    // Fields normally set by NNS/testflight.
    payload.nns_proposal_id = Some(0);
    payload.swap_start_timestamp_seconds = Some(0);
    payload.swap_due_timestamp_seconds = Some(0);

    // Read canister IDs from JSON and assemble SnsCanisterIds.
    let ids_json = fs::read_to_string(&args.canister_ids)
        .context("Failed to read canister IDs JSON")?;
    let ids_map: serde_json::Value = serde_json::from_str(&ids_json)
        .context("Failed to parse canister IDs JSON")?;
    let get = |k: &str| -> Result<PrincipalId> {
        let s = ids_map.get(k).and_then(|v| v.as_str())
            .with_context(|| format!("missing key {}", k))?;
        Ok(PrincipalId::from_str(s)?)
    };
    let sns_ids = SnsCanisterIds {
        governance: get("sns_governance")?,
        ledger:     get("sns_ledger")?,
        root:       get("sns_root")?,
        swap:       get("sns_swap")?,
        index:      get("sns_index")?,
    };

    // Build init payloads and write artifacts.
    let payloads = payload
        .build_canister_payloads(&sns_ids, None, true)
        .map_err(|e| anyhow!("Failed to build SNS canister payloads: {e}"))?;

    let items: &[(&str, Vec<u8>)] = &[
        ("sns_governance", Encode!(&payloads.governance)?),
        ("sns_ledger",     Encode!(&payloads.ledger)?),
        ("sns_root",       Encode!(&payloads.root)?),
        ("sns_swap",       Encode!(&payloads.swap)?),
        ("sns_index",      Encode!(&payloads.index_ng)?),
    ];

    let mut summary = serde_json::Map::new();
    for (name, bytes) in items {
        let p = args.out_dir.join(format!("{name}.arg.bin"));
        fs::write(&p, bytes)?;
        summary.insert(name.to_string(), serde_json::json!({
            "arg_hex": hex::encode(bytes),
            "arg_len": bytes.len()
        }));
    }
    fs::write(
        args.out_dir.join("sns_init_args.summary.json"),
        serde_json::to_vec_pretty(&serde_json::Value::Object(summary))?,
    )?;

    println!("Wrote SNS init args to {}", args.out_dir.display());
    Ok(())
}
