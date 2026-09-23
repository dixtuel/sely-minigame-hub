//! SELY Global / Edge Config Service
//! Matches server/storage/globalConfig.ts and RUSTGEC.MD Section 7.4.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppAnnouncement {
    pub enabled: bool,
    #[serde(rename = "textTr")]
    pub text_tr: String,
    #[serde(rename = "textEn")]
    pub text_en: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    #[serde(rename = "badgeTr", skip_serializing_if = "Option::is_none")]
    pub badge_tr: Option<String>,
    #[serde(rename = "badgeEn", skip_serializing_if = "Option::is_none")]
    pub badge_en: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppGlobalConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maintenance: Option<bool>,
    #[serde(rename = "maintenanceMessageTr", skip_serializing_if = "Option::is_none")]
    pub maintenance_message_tr: Option<String>,
    #[serde(rename = "maintenanceMessageEn", skip_serializing_if = "Option::is_none")]
    pub maintenance_message_en: Option<String>,
    pub announcement: Option<AppAnnouncement>,
    pub flags: HashMap<String, bool>,
    pub source: String,
}

impl Default for AppGlobalConfig {
    fn default() -> Self {
        Self {
            maintenance: Some(false),
            maintenance_message_tr: None,
            maintenance_message_en: None,
            announcement: None,
            flags: HashMap::new(),
            source: "fallback".to_string(),
        }
    }
}

struct CacheEntry {
    config: AppGlobalConfig,
    fetched_at: Instant,
}

static CACHE: RwLock<Option<CacheEntry>> = RwLock::new(None);
const CACHE_TTL: Duration = Duration::from_secs(15);

/// Fetches global configuration with 15-second in-memory caching and safe fallback
pub async fn fetch_global_config() -> AppGlobalConfig {
    {
        let guard = CACHE.read().unwrap();
        if let Some(entry) = guard.as_ref() {
            if entry.fetched_at.elapsed() < CACHE_TTL {
                return entry.config.clone();
            }
        }
    }

    let conn_str = std::env::var("GLOBAL_CONFIG")
        .or_else(|_| std::env::var("EDGE_CONFIG"))
        .unwrap_or_default();

    if conn_str.trim().is_empty() {
        return AppGlobalConfig::default();
    }

    // In production, when Edge Config URL is configured, an HTTP GET is performed.
    // If unavailable or on error, fallback gracefully.
    let config = match reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
    {
        Ok(client) => match client.get(&conn_str).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<serde_json::Value>().await {
                    Ok(val) => AppGlobalConfig {
                        maintenance: val.get("maintenance").and_then(|v| v.as_bool()),
                        maintenance_message_tr: val
                            .get("maintenanceMessageTr")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        maintenance_message_en: val
                            .get("maintenanceMessageEn")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        announcement: val
                            .get("announcement")
                            .and_then(|v| serde_json::from_value(v.clone()).ok()),
                        flags: val
                            .get("flags")
                            .and_then(|v| serde_json::from_value(v.clone()).ok())
                            .unwrap_or_default(),
                        source: "global-config".to_string(),
                    },
                    Err(_) => AppGlobalConfig::default(),
                }
            }
            _ => AppGlobalConfig::default(),
        },
        Err(_) => AppGlobalConfig::default(),
    };

    let mut guard = CACHE.write().unwrap();
    *guard = Some(CacheEntry {
        config: config.clone(),
        fetched_at: Instant::now(),
    });

    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_provides_safe_fallback_configuration() {
        std::env::remove_var("GLOBAL_CONFIG");
        std::env::remove_var("EDGE_CONFIG");

        let config = fetch_global_config().await;
        assert_eq!(config.maintenance, Some(false));
        assert_eq!(config.announcement, None);
        assert_eq!(config.source, "fallback");
    }
}
