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

/// The canonical message a voter must sign.
pub fn canonical_message(target_vote_pubkey: &str) -> String {
    format!("meridian:blacklist:{target_vote_pubkey}")
}

/// Verify that `signature_b58` is a valid ed25519 signature of the
/// canonical message for `target_vote_pubkey`, produced by the private
/// key corresponding to `voter_identity_b58`.
pub fn verify_vote(
    voter_identity_b58: &str,
    target_vote_pubkey: &str,
    signature_b58: &str,
) -> Result<()> {
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

    let msg = canonical_message(target_vote_pubkey);
    verifying_key
        .verify(msg.as_bytes(), &signature)
        .map_err(|e| anyhow!("signature verification failed: {e}"))
}

#[derive(Debug, Deserialize)]
pub struct VoteRequest {
    pub voter_identity: String,
    pub target_vote_pubkey: String,
    pub signature: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    #[test]
    fn test_canonical_message_format() {
        let msg = canonical_message("TargetPubkey123");
        assert_eq!(msg, "meridian:blacklist:TargetPubkey123");
    }

    #[test]
    fn test_verify_vote_valid() {
        use ed25519_dalek::Signer;
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let target = "SomeTargetVotePubkey";
        let msg = canonical_message(target);
        let sig = signing_key.sign(msg.as_bytes());
        let sig_b58 = bs58::encode(sig.to_bytes()).into_string();

        verify_vote(&voter_b58, target, &sig_b58).expect("valid signature should verify");
    }

    #[test]
    fn test_verify_vote_wrong_target() {
        use ed25519_dalek::Signer;
        let mut rng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let voter_b58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let msg = canonical_message("TargetA");
        let sig = signing_key.sign(msg.as_bytes());
        let sig_b58 = bs58::encode(sig.to_bytes()).into_string();

        let result = verify_vote(&voter_b58, "TargetB", &sig_b58);
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
        let result = verify_vote(&voter_b58, "Target", &bad_sig);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("64 bytes"));
    }
}
