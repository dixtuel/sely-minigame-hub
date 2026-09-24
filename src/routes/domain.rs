//! Request-aware public origin resolution. No production hostname is implied by default.

fn is_local_host(host: &str) -> bool {
    let host = host.trim_matches(['[', ']']).split(':').next().unwrap_or(host);
    host.eq_ignore_ascii_case("localhost")
        || host == "127.0.0.1"
        || host == "::1"
        || host.ends_with(".localhost")
}

fn valid_host(host: &str) -> bool {
    !host.is_empty()
        && host.len() <= 253
        && host.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b':' | b'[' | b']')
        })
}

/// Resolve a public origin from an explicit domain or the current request host. A missing
/// domain and missing Host header intentionally produce `None`, never a branded fallback.
pub fn resolve_origin(
    configured_domain: Option<&str>,
    request_host: Option<&str>,
    forwarded_proto: Option<&str>,
) -> Option<String> {
    if let Some(configured) = configured_domain.map(str::trim).filter(|value| !value.is_empty()) {
        let (scheme, host) = configured
            .split_once("://")
            .map(|(scheme, host)| (scheme.to_ascii_lowercase(), host.trim_end_matches('/')))
            .unwrap_or_else(|| {
                let scheme = if is_local_host(configured) { "http" } else { "https" };
                (scheme.to_string(), configured)
            });
        if matches!(scheme.as_str(), "http" | "https") && valid_host(host) {
            return Some(format!("{scheme}://{host}"));
        }
    }

    let host = request_host.map(str::trim).filter(|host| valid_host(host))?;
    let requested_proto = forwarded_proto
        .map(str::trim)
        .filter(|proto| matches!(proto.to_ascii_lowercase().as_str(), "http" | "https"));
    let scheme = requested_proto
        .map(str::to_ascii_lowercase)
        .unwrap_or_else(|| if is_local_host(host) { "http" } else { "https" }.to_string());
    Some(format!("{scheme}://{host}"))
}

pub fn configured_origin(request_host: Option<&str>, forwarded_proto: Option<&str>) -> Option<String> {
    let configured_domain = std::env::var("PRIMARY_DOMAIN")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("VITE_PRIMARY_DOMAIN").ok().filter(|value| !value.trim().is_empty()));
    resolve_origin(configured_domain.as_deref(), request_host, forwarded_proto)
}

#[cfg(test)]
mod tests {
    use super::resolve_origin;

    #[test]
    fn missing_domain_and_host_does_not_invent_a_production_origin() {
        assert_eq!(resolve_origin(None, None, None), None);
        assert_eq!(resolve_origin(Some("  "), None, None), None);
    }

    #[test]
    fn request_host_supports_local_and_forwarded_origins() {
        assert_eq!(resolve_origin(None, Some("localhost:3000"), None), Some("http://localhost:3000".into()));
        assert_eq!(resolve_origin(None, Some("games.example"), Some("https")), Some("https://games.example".into()));
    }

    #[test]
    fn configured_domain_takes_precedence_and_rejects_unsafe_hosts() {
        assert_eq!(resolve_origin(Some("hub.example"), Some("localhost:3000"), Some("http")), Some("https://hub.example".into()));
        assert_eq!(resolve_origin(Some("https://hub.example/path"), None, None), None);
        assert_eq!(resolve_origin(None, Some("bad host"), None), None);
    }
}
