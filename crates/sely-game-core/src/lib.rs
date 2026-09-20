use wasm_bindgen::prelude::*;

pub mod games;

#[wasm_bindgen(start)]
pub fn init() {
    // WASM core initialization
}

/// Mulberry32 deterministic PRNG
#[wasm_bindgen]
pub struct WasmPrng {
    rng: games::rng::Mulberry32,
}

#[wasm_bindgen]
impl WasmPrng {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Self {
        Self {
            rng: games::rng::Mulberry32::new(seed),
        }
    }

    #[wasm_bindgen(js_name = nextFloat)]
    pub fn next_float(&mut self) -> f64 {
        self.rng.next_f64()
    }
}

/// Knot (Düğüm) procedural level generator
#[wasm_bindgen]
pub fn wasm_generate_knot_level(seed: u32, mastery: i32) -> Result<JsValue, JsValue> {
    let level = games::knot::generate_knot_level(seed, mastery);
    serde_wasm_bindgen::to_value(&level).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Knot (Düğüm) level solvability verification
#[wasm_bindgen]
pub fn wasm_is_knot_level_solvable(seed: u32, mastery: i32) -> bool {
    let level = games::knot::generate_knot_level(seed, mastery);
    games::knot::is_knot_level_solvable(&level)
}

/// Cut (Kırpık) procedural level generator
#[wasm_bindgen]
pub fn wasm_generate_cut_level(seed: u32, mastery: u32) -> Result<JsValue, JsValue> {
    let level = games::cut::generate_cut_level(seed, mastery);
    serde_wasm_bindgen::to_value(&level).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Cut (Kırpık) point-to-segment geometric distance
#[wasm_bindgen]
pub fn wasm_segment_distance(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    games::geometry::segment_distance(
        games::geometry::Point2D { x: px, y: py },
        games::geometry::Point2D { x: ax, y: ay },
        games::geometry::Point2D { x: bx, y: by },
    )
}

/// Shadow (Gölge Payı) procedural level generator
#[wasm_bindgen]
pub fn wasm_generate_shadow_level(seed: u32, mastery: u32) -> Result<JsValue, JsValue> {
    let level = games::shadow::generate_shadow_level(seed, mastery);
    serde_wasm_bindgen::to_value(&level).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Hane (Kayıt Masası) procedural number level generator
#[wasm_bindgen]
pub fn wasm_generate_hane_level(seed: u32, mastery: u32) -> Result<JsValue, JsValue> {
    let level = games::hane::generate_hane_level(seed, mastery);
    serde_wasm_bindgen::to_value(&level).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Hane (Kayıt Masası) number guess comparison
#[wasm_bindgen]
pub fn wasm_compare_hane_number_guess(target: &str, guess: &str) -> Result<JsValue, JsValue> {
    let feedback = games::hane::compare_hane_number_guess(target, guess);
    serde_wasm_bindgen::to_value(&feedback).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Spark (Kıvılcım) single physics step
#[wasm_bindgen]
pub fn wasm_spark_physics_step(
    x: f64,
    y: f64,
    vy: f64,
    rotation: f64,
    dt: f64,
    flap: bool,
    gravity: f64,
    flap_impulse: f64,
    max_fall: f64,
) -> Result<JsValue, JsValue> {
    let spark = games::spark::SparkState { x, y, vy, rotation };
    let next = games::spark::spark_physics_step(&spark, dt, flap, gravity, flap_impulse, max_fall);
    serde_wasm_bindgen::to_value(&next).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Spark (Kıvılcım) pylon height calculation
#[wasm_bindgen]
pub fn wasm_spark_calculate_pylon_height(
    seed: u32,
    index: usize,
    min_height: f64,
    max_available: f64,
    prev_height: Option<f64>,
    max_delta: f64,
) -> f64 {
    games::spark::spark_calculate_pylon_height(seed, index, min_height, max_available, prev_height, max_delta)
}

/// Spark (Kıvılcım) flight collision check
#[wasm_bindgen]
pub fn wasm_spark_flight_collision(
    spark_x: f64,
    spark_y: f64,
    hit_radius: f64,
    pylon_x: f64,
    pylon_width: f64,
    pylon_top_height: f64,
    pylon_bottom_y: f64,
    pylon_bottom_height: f64,
    ground_y: f64,
) -> bool {
    let pylon = games::spark::Pylon {
        id: 0,
        x: pylon_x,
        width: pylon_width,
        top_height: pylon_top_height,
        gap: 0.0,
        bottom_y: pylon_bottom_y,
        bottom_height: pylon_bottom_height,
        passed: false,
    };
    games::spark::spark_flight_collision(spark_x, spark_y, hit_radius, &pylon, ground_y)
}

/// SELY Anonymous Procedural Nickname Generator
#[wasm_bindgen]
pub fn wasm_get_player_nick(locale: &str, date_str: &str, anon_id: &str) -> String {
    games::nick::get_player_nick(locale, date_str, anon_id)
}

/// SELY Player Signature
#[wasm_bindgen]
pub fn wasm_get_player_signature(game_id: &str, date_str: &str, anon_id: &str) -> String {
    games::nick::get_player_signature(game_id, date_str, anon_id)
}
