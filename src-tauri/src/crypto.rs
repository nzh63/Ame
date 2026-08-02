//! Cryptographic signing helpers for cloud provider APIs.

use hmac::{Hmac, Mac};
use md5::{Digest, Md5};
use sha2::Sha256;

/// MD5 hex digest (lowercase) — used by Baidu Translate API.
pub fn md5_hex(input: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// HMAC-SHA256 raw bytes.
pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// SHA256 hex digest (lowercase).
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Tencent Cloud TC3-HMAC-SHA256 signature.
///
/// Implements the full TC3 signing chain used by Tencent Cloud API v3.
/// Returns the value for the `Authorization` header.
#[allow(clippy::too_many_arguments)]
pub fn tencent_tc3_authorization(
    secret_id: &str,
    secret_key: &str,
    service: &str,
    action: &str,
    _region: &str,
    timestamp: i64,
    payload: &str,
) -> String {
    let date = chrono::DateTime::from_timestamp(timestamp, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default();

    // 1. Canonical request.
    let http_request_method = "POST";
    let canonical_uri = "/";
    let canonical_querystring = "";
    let ct = "application/json; charset=utf-8";
    let host = format!("{service}.tencentcloudapi.com");
    let canonical_headers = format!(
        "content-type:{ct}\nhost:{host}\nx-tc-action:{}\n",
        action.to_lowercase()
    );
    let signed_headers = "content-type;host;x-tc-action";
    let hashed_payload = sha256_hex(payload.as_bytes());
    let canonical_request = format!(
        "{http_request_method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    );

    // 2. String to sign.
    let algorithm = "TC3-HMAC-SHA256";
    let credential_scope = format!("{date}/{service}/tc3_request");
    let hashed_canonical = sha256_hex(canonical_request.as_bytes());
    let string_to_sign =
        format!("{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical}");

    // 3. Signing key chain.
    let secret_date = hmac_sha256(format!("TC3{secret_key}").as_bytes(), date.as_bytes());
    let secret_service = hmac_sha256(&secret_date, service.as_bytes());
    let secret_signing = hmac_sha256(&secret_service, b"tc3_request");
    let signature = hex::encode(hmac_sha256(&secret_signing, string_to_sign.as_bytes()));

    // 4. Authorization header.
    format!(
        "{algorithm} Credential={secret_id}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn md5_known_vectors() {
        assert_eq!(md5_hex(""), "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(md5_hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(md5_hex("hello"), "5d41402abc4b2a76b9719d911017c592");
    }

    #[test]
    fn sha256_known_vectors() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn hmac_sha256_known_vector() {
        let digest = hmac_sha256(b"key", b"The quick brown fox jumps over the lazy dog");
        assert_eq!(
            hex::encode(digest),
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
        );
    }

    #[test]
    fn tencent_tc3_signature_matches_independent_vector() {
        // Independent vector computed from the official Tencent Cloud API v3
        // signing spec (TC3-HMAC-SHA256).
        let auth = tencent_tc3_authorization(
            "AKIDEXAMPLE",
            "Gu5t9xGARNpq86cd98joQYCN3Cozk1qA",
            "cvm",
            "DescribeInstances",
            "ap-guangzhou",
            1551113065,
            r#"{"Limit": 1, "Filters": [{"Values": ["\u672a\u547d\u540d"], "Name": "instance-name"}]}"#,
        );
        assert_eq!(
            auth,
            "TC3-HMAC-SHA256 Credential=AKIDEXAMPLE/2019-02-25/cvm/tc3_request, \
             SignedHeaders=content-type;host;x-tc-action, \
             Signature=2220c8c846efab6e5158c3ae545e315ad80a246c20d35d53b8723eee82f2601d"
        );
    }
}
