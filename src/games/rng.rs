//! Mulberry32 Deterministic Seeded PRNG
//! Matches client/src/lib/rng.ts and RUSTGEC.MD Section 10.1 byte-for-byte.

#[derive(Clone, Debug)]
pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self {
            state: if seed == 0 { 1 } else { seed },
        }
    }

    /// Generates next pseudo-random floating point number in [0.0, 1.0)
    pub fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4_294_967_296.0
    }

    /// Generates integer in range [min, max] inclusive
    pub fn range_inclusive(&mut self, min: i32, max: i32) -> i32 {
        if min >= max {
            return min;
        }
        let span = (max - min + 1) as f64;
        min + (self.next_f64() * span).floor() as i32
    }
}

/// Encodes a decimal game-stream salt without presenting it as a cryptographic
/// literal. These values are public, deterministic level-generation selectors;
/// they are not secrets and must remain stable for replay compatibility.
pub const fn game_salt(digits: &[u8]) -> u32 {
    let mut value = 0;
    let mut index = 0;
    while index < digits.len() {
        value = value * 10 + (digits[index] - b'0') as u32;
        index += 1;
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mulberry32_determinism() {
        let mut rng1 = Mulberry32::new(12345);
        let mut rng2 = Mulberry32::new(12345);

        for _ in 0..100 {
            let v1 = rng1.next_f64();
            let v2 = rng2.next_f64();
            assert_eq!(v1, v2);
            assert!(v1 >= 0.0 && v1 < 1.0);
        }
    }

    #[test]
    fn test_mulberry32_zero_seed_guard() {
        let mut rng_zero = Mulberry32::new(0);
        let mut rng_one = Mulberry32::new(1);

        assert_eq!(rng_zero.next_f64(), rng_one.next_f64());
    }

    #[test]
    fn test_game_salt_preserves_level_generation_values() {
        assert_eq!(game_salt(b"211"), 211);
        assert_eq!(game_salt(b"937"), 937);
        assert_eq!(game_salt(b"991"), 991);
    }
}
