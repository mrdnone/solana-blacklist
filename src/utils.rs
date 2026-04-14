/// Validates a given Solana public key string for format and character correctness.
///
/// # Parameters
/// - `pubkey_str`: A string slice representing the Solana public key to validate.
///
/// # Returns
/// - `Ok(())`: If the provided public key string is valid.
/// - `Err(String)`: If the validation fails, returning a descriptive error message.
pub fn validate_solana_pubkey(pubkey_str: &str) -> Result<(), String> {
    if pubkey_str.is_empty() {
        return Err("Public key cannot be empty".to_string());
    }

    if pubkey_str.len() < 32 || pubkey_str.len() > 44 {
        return Err("Invalid public key length".to_string());
    }

    // Check for invalid characters
    for c in pubkey_str.chars() {
        if !is_base58_char(c) {
            return Err(format!("Invalid character '{}' in public key", c));
        }
    }

    // // Decode and validate
    // match decode_base58(pubkey_str) {
    //     Ok(decoded) => {
    //         if decoded.len() != 32 {
    //             Err("Public key must be exactly 32 bytes when decoded".to_string())
    //         } else {
    //             Ok(())
    //         }
    //     }
    //     Err(e) => Err(format!("Failed to decode public key: {}", e)),
    // }
    Ok(())
}

/// Checks if a character is a valid base58 character
fn is_base58_char(c: char) -> bool {
    matches!(c, '1'..='9' | 'A'..='H' | 'J'..='N' | 'P'..='Z' | 'a'..='k' | 'm'..='z')
}
