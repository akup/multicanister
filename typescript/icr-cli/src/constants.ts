/**
 * ==================================================================
 * CONFIGURATION KEYS
 * ==================================================================
 */

// --- Core Configuration Keys (from core.json) ---
// The order of this array defines the deployment order.
// Place dependencies (like governance) before the canisters that need them (like root).
export const requiredCoreKeys = ['factory', 'sns_governance', 'sns_ledger', 'sns_root'] as const;
export const optionalCoreKeys = ['ii', 'candid_ui'] as const;

// Add other project-wide constants here.
