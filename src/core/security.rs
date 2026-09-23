//! SELY Security Headers and In-Memory Rate Limiting
//! Matches server/_core/security.ts and server/_core/security.test.ts.

use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Clone, Debug)]
pub struct Counter {
    pub count: u32,
    pub reset_at: u64,
}

pub struct RateLimiter {
    max: u32,
    window_ms: u64,
    counters: RwLock<HashMap<String, Counter>>,
    last_sweep: RwLock<u64>,
}

const MAX_LIMITER_ENTRIES: usize = 2048;

pub struct RateLimitResult {
    pub allowed: bool,
    pub limit: u32,
    pub remaining: u32,
    pub reset: u64,
    pub retry_after: Option<u64>,
}

impl RateLimiter {
    pub fn new(max: u32, window_ms: u64) -> Self {
        Self {
            max,
            window_ms,
            counters: RwLock::new(HashMap::new()),
            last_sweep: RwLock::new(0),
        }
    }

    pub fn check(&self, key: &str, now_ms: u64) -> RateLimitResult {
        // Periodic sweep
        {
            let last = *self.last_sweep.read().unwrap();
            if now_ms.saturating_sub(last) > self.window_ms {
                let mut last_mut = self.last_sweep.write().unwrap();
                *last_mut = now_ms;
                let mut map = self.counters.write().unwrap();
                map.retain(|_, c| c.reset_at > now_ms);
            }
        }

        let mut map = self.counters.write().unwrap();

        // Prevent memory exhaustion under DDoS
        if map.len() >= MAX_LIMITER_ENTRIES {
            let oldest_key = map.keys().next().cloned();
            if let Some(k) = oldest_key {
                map.remove(&k);
            }
        }

        let entry = map.entry(key.to_string()).or_insert_with(|| Counter {
            count: 0,
            reset_at: now_ms + self.window_ms,
        });

        if entry.reset_at <= now_ms {
            entry.count = 0;
            entry.reset_at = now_ms + self.window_ms;
        }

        entry.count += 1;
        let count = entry.count;
        let reset_at = entry.reset_at;

        let remaining = self.max.saturating_sub(count);
        let reset_secs = (reset_at + 999) / 1000;

        if count > self.max {
            let retry_after_secs = ((reset_at.saturating_sub(now_ms)) + 999) / 1000;
            RateLimitResult {
                allowed: false,
                limit: self.max,
                remaining: 0,
                reset: reset_secs,
                retry_after: Some(retry_after_secs.max(1)),
            }
        } else {
            RateLimitResult {
                allowed: true,
                limit: self.max,
                remaining,
                reset: reset_secs,
                retry_after: None,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_requests_inside_budget_then_returns_429() {
        let limiter = RateLimiter::new(2, 60_000);
        let now = 1_000;
        let ip = "127.0.0.1";

        let res1 = limiter.check(ip, now);
        assert!(res1.allowed);
        assert_eq!(res1.remaining, 1);

        let res2 = limiter.check(ip, now);
        assert!(res2.allowed);
        assert_eq!(res2.remaining, 0);

        let res3 = limiter.check(ip, now);
        assert!(!res3.allowed);
        assert_eq!(res3.remaining, 0);
        assert_eq!(res3.retry_after, Some(60));
    }
}
