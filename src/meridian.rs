//! Meridian — community validator voting for blacklist entries.
//!
//! Active validators sign a canonical message with their identity keypair
//! to vote for blacklisting a target vote account. Once a target reaches
//! ≥ VOTE_THRESHOLD unique validator votes it is added to the blacklist.

use anyhow::{Result, anyhow, bail};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::Deserialize;

pub const MERIDIAN_SOURCE_NAME: &str = "meridian";
pub const VOTE_THRESHOLD: u64 = 10;
pub const TIMESTAMP_WINDOW_SECS: i64 = 600; // 10 minutes

/// Build the byte buffer that `solana sign-offchain-message` actually signs.
///
/// The Solana CLI prepends the following header to the raw message before signing:
///   [0xff] + b"solana offchain"  — 16-byte signing domain (prevents tx collisions)
///   [0x00]                       — version V0
///   [0x00]                       — format RestrictedAscii (0 = pure ASCII)
///   [len_lo, len_hi]             — 2-byte little-endian message length
///   [...message bytes]
///
/// Our canonical messages are always plain ASCII so format is always 0.
fn offchain_message_bytes(message: &str) -> Vec<u8> {
    let msg_bytes = message.as_bytes();
    assert!(
        msg_bytes.len() <= u16::MAX as usize,
        "offchain message too long: {} bytes",
        msg_bytes.len()
    );
    let len = msg_bytes.len() as u16;
    let mut data = Vec::with_capacity(20 + msg_bytes.len());
    data.extend_from_slice(b"\xffsolana offchain"); // signing domain (16 bytes)
    data.push(0); // version V0
    data.push(0); // format RestrictedAscii
    data.extend_from_slice(&len.to_le_bytes()); // LE u16 length
    data.extend_from_slice(msg_bytes);
    data
}

/// Includes `timestamp_secs` to prevent replay attacks.
pub fn canonical_message(target_vote_pubkey: &str, timestamp_secs: i64) -> String {
    format!("meridian:blacklist:{target_vote_pubkey}:{timestamp_secs}")
}

/// Verify that `signature_b58` is a valid ed25519 signature of the
/// canonical message for `target_vote_pubkey`, produced by the private
/// key corresponding to `voter_identity_b58`.
/// The `timestamp_secs` must be within TIMESTAMP_WINDOW_SECS of now.
///
/// `active_identities` must contain the set of known active validator identity
/// pubkeys (base58). The voter is rejected if their identity is absent from this
/// set, preventing non-validators from submitting votes regardless of signature
/// validity. Callers are responsible for keeping this set up to date.
pub fn verify_vote(
    voter_identity_b58: &str,
    target_vote_pubkey: &str,
    signature_b58: &str,
    timestamp_secs: i64,
    active_identities: &std::collections::HashSet<String>,
) -> Result<()> {
    if !active_identities.contains(voter_identity_b58) {
        bail!("voter identity is not a known active validator");
    }
    let now = chrono::Utc::now().timestamp();
    if (now - timestamp_secs).abs() > TIMESTAMP_WINDOW_SECS {
        bail!("timestamp too far from current time");
    }
    let pk_bytes = bs58::decode(voter_identity_b58)
        .into_vec()
        .map_err(|e| anyhow!("invalid voter identity base58: {e}"))?;
    if pk_bytes.len() != 32 {
        bail!("voter identity must be 32 bytes, got {}", pk_bytes.len());
    }
    let pk_arr: [u8; 32] = pk_bytes
        .try_into()
        .map_err(|_| anyhow!("voter identity conversion failed"))?;
    let verifying_key = VerifyingKey::from_bytes(&pk_arr)
        .map_err(|e| anyhow!("invalid ed25519 public key: {e}"))?;

    let sig_bytes = bs58::decode(signature_b58)
        .into_vec()
        .map_err(|e| anyhow!("invalid signature base58: {e}"))?;
    if sig_bytes.len() != 64 {
        bail!("signature must be 64 bytes, got {}", sig_bytes.len());
    }
    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| anyhow!("signature conversion failed"))?;
    let signature = Signature::from_bytes(&sig_arr);

    let msg = canonical_message(target_vote_pubkey, timestamp_secs);
    let signing_bytes = offchain_message_bytes(&msg);
    verifying_key
        .verify(&signing_bytes, &signature)
        .map_err(|e| anyhow!("signature verification failed: {e}"))
}

#[derive(Debug, Deserialize)]
pub struct VoteRequest {
    pub voter_identity: String,
    pub target_vote_pubkey: String,
    pub signature: String,
    pub voted_at_ts: i64,
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    #[test]
    fn test_canonical_message_format() {
        let msg = canonical_message("TargetPubkey123", 1_700_000_000);
        assert_eq!(msg, "meridian:blacklist:TargetPubkey123:1700000000");
    }

    #[test]
    fn test_verify_vote_valid() {
        use ed25519_dalek::Signer;
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let target = "SomeTargetVotePubkey";
        let ts = chrono::Utc::now().timestamp();
        let msg = canonical_message(target, ts);
        let sig = signing_key.sign(&offchain_message_bytes(&msg));
        let sig_b58 = bs58::encode(sig.to_bytes()).into_string();

        let active = std::collections::HashSet::from([voter_b58.clone()]);
        verify_vote(&voter_b58, target, &sig_b58, ts, &active).expect("valid signature should verify");
    }

    #[test]
    fn test_verify_vote_wrong_target() {
        use ed25519_dalek::Signer;
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let ts = chrono::Utc::now().timestamp();
        let msg = canonical_message("TargetA", ts);
        let sig = signing_key.sign(&offchain_message_bytes(&msg));
        let sig_b58 = bs58::encode(sig.to_bytes()).into_string();

        let active = std::collections::HashSet::from([voter_b58.clone()]);
        let result = verify_vote(&voter_b58, "TargetB", &sig_b58, ts, &active);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_vote_bad_signature() {
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();
        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();

        // 63 bytes — wrong length
        let bad_sig = bs58::encode(vec![0u8; 63]).into_string();
        let ts = chrono::Utc::now().timestamp();
        let active = std::collections::HashSet::from([voter_b58.clone()]);
        let result = verify_vote(&voter_b58, "Target", &bad_sig, ts, &active);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("64 bytes"));
    }

    #[test]
    fn test_verify_vote_unknown_voter() {
        use ed25519_dalek::Signer;
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let ts = chrono::Utc::now().timestamp();
        let msg = canonical_message("Target", ts);
        let sig = signing_key.sign(&offchain_message_bytes(&msg));
        let sig_b58 = bs58::encode(sig.to_bytes()).into_string();

        // Empty active set — voter is not a known validator
        let active = std::collections::HashSet::new();
        let result = verify_vote(&voter_b58, "Target", &sig_b58, ts, &active);
        assert!(result.is_err());
        assert!(
            result.unwrap_err().to_string().contains("not a known active validator"),
            "expected unknown-voter error"
        );
    }

    #[test]
    fn test_verify_vote_stale_timestamp() {
        use ed25519_dalek::Signer;
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let stale_ts = chrono::Utc::now().timestamp() - 700; // 11+ minutes ago
        let msg = canonical_message("Target", stale_ts);
        let sig = signing_key.sign(&offchain_message_bytes(&msg));
        let sig_b58 = bs58::encode(sig.to_bytes()).into_string();

        let active = std::collections::HashSet::from([voter_b58.clone()]);
        let result = verify_vote(&voter_b58, "Target", &sig_b58, stale_ts, &active);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("timestamp too far"));
    }
}
