/* tslint:disable */
/* eslint-disable */

/**
 * Mulberry32 deterministic PRNG
 */
export class WasmPrng {
    free(): void;
    [Symbol.dispose](): void;
    constructor(seed: number);
    nextFloat(): number;
}

export function init(): void;

/**
 * Hane (Kayıt Masası) number guess comparison
 */
export function wasm_compare_hane_number_guess(target: string, guess: string): any;

/**
 * Cut (Kırpık) procedural level generator
 */
export function wasm_generate_cut_level(seed: number, mastery: number): any;

/**
 * Hane (Kayıt Masası) procedural number level generator
 */
export function wasm_generate_hane_level(seed: number, mastery: number): any;

/**
 * Knot (Düğüm) procedural level generator
 */
export function wasm_generate_knot_level(seed: number, mastery: number): any;

/**
 * Shadow (Gölge Payı) procedural level generator
 */
export function wasm_generate_shadow_level(seed: number, mastery: number): any;

/**
 * SELY Anonymous Procedural Nickname Generator
 */
export function wasm_get_player_nick(locale: string, date_str: string, anon_id: string): string;

/**
 * SELY Player Signature
 */
export function wasm_get_player_signature(game_id: string, date_str: string, anon_id: string): string;

/**
 * Knot (Düğüm) level solvability verification
 */
export function wasm_is_knot_level_solvable(seed: number, mastery: number): boolean;

/**
 * Cut (Kırpık) point-to-segment geometric distance
 */
export function wasm_segment_distance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number;

/**
 * Spark (Kıvılcım) pylon height calculation
 */
export function wasm_spark_calculate_pylon_height(seed: number, index: number, min_height: number, max_available: number, prev_height: number | null | undefined, max_delta: number): number;

/**
 * Spark (Kıvılcım) flight collision check
 */
export function wasm_spark_flight_collision(spark_x: number, spark_y: number, hit_radius: number, pylon_x: number, pylon_width: number, pylon_top_height: number, pylon_bottom_y: number, pylon_bottom_height: number, ground_y: number): boolean;

/**
 * Spark (Kıvılcım) single physics step
 */
export function wasm_spark_physics_step(x: number, y: number, vy: number, rotation: number, dt: number, flap: boolean, gravity: number, flap_impulse: number, max_fall: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmprng_free: (a: number, b: number) => void;
    readonly init: () => void;
    readonly wasm_compare_hane_number_guess: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_generate_cut_level: (a: number, b: number) => [number, number, number];
    readonly wasm_generate_hane_level: (a: number, b: number) => [number, number, number];
    readonly wasm_generate_knot_level: (a: number, b: number) => [number, number, number];
    readonly wasm_generate_shadow_level: (a: number, b: number) => [number, number, number];
    readonly wasm_get_player_nick: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wasm_get_player_signature: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wasm_is_knot_level_solvable: (a: number, b: number) => number;
    readonly wasm_segment_distance: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly wasm_spark_calculate_pylon_height: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly wasm_spark_flight_collision: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly wasm_spark_physics_step: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
    readonly wasmprng_new: (a: number) => number;
    readonly wasmprng_nextFloat: (a: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
