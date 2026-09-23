use regex::Regex;
use std::sync::OnceLock;

static URL_PASSWORD_RE: OnceLock<Regex> = OnceLock::new();
static BEARER_TOKEN_RE: OnceLock<Regex> = OnceLock::new();
static JWT_TOKEN_RE: OnceLock<Regex> = OnceLock::new();
static IPV4_RE: OnceLock<Regex> = OnceLock::new();

fn get_url_password_re() -> &'static Regex {
    URL_PASSWORD_RE.get_or_init(|| Regex::new(r"(://[\w%.-]+:)([^@]+)(@)").unwrap())
}

fn get_bearer_token_re() -> &'static Regex {
    BEARER_TOKEN_RE.get_or_init(|| Regex::new(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/-]{8,}").unwrap())
}

fn get_jwt_token_re() -> &'static Regex {
    JWT_TOKEN_RE.get_or_init(|| Regex::new(r"(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,})").unwrap())
}

fn get_ipv4_re() -> &'static Regex {
    IPV4_RE.get_or_init(|| Regex::new(r"\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b").unwrap())
}

/// Sanitizes log strings to strip passwords from connection URLs, sensitive bearer tokens,
/// JWTs, and masks IPv4 addresses for KVKK/GDPR compliance.
pub fn sanitize_log_text(input: &str) -> String {
    if input.is_empty() {
        return String::new();
    }

    let pass_sanitized = get_url_password_re().replace_all(input, "${1}***${3}");
    let bearer_sanitized = get_bearer_token_re().replace_all(&pass_sanitized, "${1}***");
    let jwt_sanitized = get_jwt_token_re().replace_all(&bearer_sanitized, "jwt:***");
    let ip_sanitized = get_ipv4_re().replace_all(&jwt_sanitized, "${1}.*.*");

    ip_sanitized.into_owned()
}

pub struct SelyLogger;

impl SelyLogger {
    pub fn info(scope: &str, message: &str) {
        let clean = sanitize_log_text(message);
        println!("[sely:{scope}] {clean}");
    }

    pub fn warn(scope: &str, message: &str) {
        let clean = sanitize_log_text(message);
        eprintln!("[sely:{scope}] {clean}");
    }

    pub fn error(scope: &str, message: &str) {
        let clean = sanitize_log_text(message);
        eprintln!("[sely:{scope}] {clean}");
    }

    pub fn debug(scope: &str, message: &str) {
        if std::env::var("DEBUG").map(|v| v == "1" || v == "true").unwrap_or(false)
            || std::env::var("NODE_ENV").map(|v| v == "development").unwrap_or(false)
        {
            let clean = sanitize_log_text(message);
            println!("[sely:{scope}] {clean}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitizes_passwords_tokens_ips_and_prefixes() {
        // 1. Password sanitization in URLs
        let raw_url = "postgres://sely_user:superSecretPassword123@neon.tech:5432/sely_db";
        let sanitized_url = sanitize_log_text(raw_url);
        assert!(!sanitized_url.contains("superSecretPassword123"));
        assert!(sanitized_url.contains("postgres://sely_user:***@neon.tech:5432/sely_db"));

        // 2. Bearer authorization token sanitization
        let raw_token = "Authorization: Bearer mySecretToken123456789";
        let sanitized_token = sanitize_log_text(raw_token);
        assert!(!sanitized_token.contains("mySecretToken123456789"));
        assert!(sanitized_token.contains("Bearer ***"));

        // 3. IPv4 address masking
        let raw_ip = "Request from 192.168.1.105";
        assert_eq!(sanitize_log_text(raw_ip), "Request from 192.168.*.*");
    }
}
