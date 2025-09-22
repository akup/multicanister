use anyhow::{Context, Result, anyhow};
use serde_yaml::{Value, Mapping};
use clap::Parser;
use candid::Encode;
use ic_base_types::PrincipalId;
use ic_sns_init::{pb::v1::SnsInitPayload, SnsCanisterIds};
use std::{fs, path::PathBuf, str::FromStr};

#[derive(Debug, Parser)]
struct Args {
    /// Path to sns_init.yaml
    #[arg(long)]
    init_config: PathBuf,

    /// JSON file with canister IDs (sns_root, sns_governance, sns_ledger, sns_swap, sns_index)
    #[arg(long)]
    canister_ids: PathBuf,

    /// Output directory to write *.arg.bin and summary JSON
    #[arg(long)]
    out_dir: PathBuf,
}

// Normalize `dapp_canisters` to the structured form expected by ic_sns_init
fn normalize_dapp_canisters(root: &mut Value) {
    let key_dc = Value::String("dapp_canisters".into());
    let key_canisters = Value::String("canisters".into());
    if let Value::Mapping(map) = root {
        if let Some(entry) = map.get_mut(&key_dc) {
            match entry {
                // If it's a sequence, wrap it into { canisters: [...] } and convert strings to { principal: "..." }
                Value::Sequence(seq) => {
                    let mut can_seq = Vec::with_capacity(seq.len());
                    for item in std::mem::take(seq) {
                        match item {
                            Value::String(s) => {
                                let mut one = Mapping::new();
                                one.insert(Value::String("principal".into()), Value::String(s));
                                can_seq.push(Value::Mapping(one));
                            }
                            Value::Mapping(m) => {
                                can_seq.push(Value::Mapping(m));
                            }
                            _ => { /* ignore unsupported entries */ }
                        }
                    }
                    let mut wrapper = Mapping::new();
                    wrapper.insert(key_canisters.clone(), Value::Sequence(can_seq));
                    *entry = Value::Mapping(wrapper);
                }
                // If it's a mapping but without "canisters", treat the whole mapping as a single-canister spec
                Value::Mapping(m) => {
                    if !m.contains_key(&key_canisters) {
                        let mut wrapper = Mapping::new();
                        wrapper.insert(
                            key_canisters.clone(),
                            Value::Sequence(vec![Value::Mapping(std::mem::take(m))]),
                        );
                        *entry = Value::Mapping(wrapper);
                    }
                }
                _ => {}
            }
        }
    }
}

fn main() -> Result<()> {
    let args = Args::parse();
    fs::create_dir_all(&args.out_dir)?;

    // Read sns_init.yaml
    let yaml = std::fs::read_to_string(&args.init_config)
        .context("Failed to read sns_init.yaml")?;
    let mut raw: Value = serde_yaml::from_str(&yaml)
        .context("Failed to parse sns_init.yaml")?;
    normalize_dapp_canisters(&mut raw);
    let mut payload: SnsInitPayload = serde_yaml::from_value(raw)
        .context("Failed to decode SnsInitPayload from normalized YAML")?;

    // Fill fields normally set by NNS (match SNS CLI behavior)
    payload.nns_proposal_id = Some(0);
    payload.swap_start_timestamp_seconds = Some(0);
    payload.swap_due_timestamp_seconds = Some(0);

    // Read canister IDs
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
        ledger: get("sns_ledger")?,
        root: get("sns_root")?,
        swap: get("sns_swap")?,
        index: get("sns_index")?,
    };

    // Build per-canister init payloads
    let payloads = payload
        .build_canister_payloads(&sns_ids, None, true)
        .map_err(|e| anyhow!("Failed to build SNS canister payloads: {e}"))?;

    // Encode and write
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
