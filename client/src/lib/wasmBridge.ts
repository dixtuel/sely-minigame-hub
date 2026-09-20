/**
 * SELY MiniGame Hub - Rust WebAssembly Runtime Bridge
 * Loads sely_game_core.wasm and exposes high-performance native Rust
 * algorithms for level generators, physics, and cryptography.
 */

import initWasm, {
  wasm_generate_knot_level,
  wasm_is_knot_level_solvable,
  wasm_generate_cut_level,
  wasm_segment_distance,
  wasm_generate_shadow_level,
  wasm_generate_hane_level,
  wasm_compare_hane_number_guess,
  wasm_spark_physics_step,
  wasm_spark_calculate_pylon_height,
  wasm_spark_flight_collision,
  wasm_get_player_nick,
  wasm_get_player_signature,
  WasmPrng,
} from "@/wasm/sely_game_core";

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureWasmInitialized(): Promise<boolean> {
  if (wasmInitialized) return true;
  if (initPromise) {
    await initPromise;
    return wasmInitialized;
  }

  initPromise = (async () => {
    try {
      // In Vite, importing sely_game_core_bg.wasm directly provides the URL or bytes
      const wasmUrl = new URL("../wasm/sely_game_core_bg.wasm", import.meta.url).href;
      await initWasm(wasmUrl);
      wasmInitialized = true;
    } catch (err) {
      console.warn("[WASM Bridge] WebAssembly init deferred or failed, fallback active:", err);
      wasmInitialized = false;
    }
  })();

  await initPromise;
  return wasmInitialized;
}

export function isWasmReady(): boolean {
  return wasmInitialized;
}

export {
  wasm_generate_knot_level,
  wasm_is_knot_level_solvable,
  wasm_generate_cut_level,
  wasm_segment_distance,
  wasm_generate_shadow_level,
  wasm_generate_hane_level,
  wasm_compare_hane_number_guess,
  wasm_spark_physics_step,
  wasm_spark_calculate_pylon_height,
  wasm_spark_flight_collision,
  wasm_get_player_nick,
  wasm_get_player_signature,
  WasmPrng,
};
