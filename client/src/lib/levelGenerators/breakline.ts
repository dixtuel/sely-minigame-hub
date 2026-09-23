import { isWasmReady, wasm_generate_breakline_run } from "@/lib/wasmBridge";
import { mulberry32 } from "@/lib/rng";

export interface BreaklineStage {
  patternIndex: number;
  mirrorX: boolean;
  mirrorY: boolean;
  cells: ArrayLike<number>;
}

export interface BreaklineRun {
  version: number;
  seed: number;
  mastery: number;
  cols: number;
  rows: number;
  stages: BreaklineStage[];
}

const PATTERNS = [
  ["00001110000", "00012221000", "00122222100", "01221112210", "12211111221", "01221112210", "00122222100", "00012221000", "00001110000"],
  ["00001110000", "00001110000", "11111111111", "12223332221", "11111111111", "00001110000", "00001110000", "00001110000", "00000000000"],
  ["11000000011", "22100000122", "12210001221", "01221012210", "00122122100", "01221012210", "12210001221", "22100000122", "11000000011"],
  ["11111111111", "12222222221", "00111111100", "00022222000", "00011111000", "00022222000", "00111111100", "12222222221", "11111111111"],
  ["11001100110", "22112211221", "11111111111", "00220022000", "00110011000", "00220022000", "11111111111", "22112211221", "11001100110"],
  ["11100000111", "12110001121", "11221012211", "01122122110", "00122222100", "01122122110", "11221012211", "12110001121", "11100000111"],
  ["11111111111", "12222222221", "12000000021", "12011111021", "12012221021", "12011111021", "12000000021", "12222222221", "11111111111"],
  ["00001110000", "00011111000", "00112221100", "01122222110", "11223332211", "00001110000", "00001110000", "00001110000", "00001110000"],
  ["11111111111", "12222222221", "12000000021", "12111111021", "12122221021", "12111111021", "12000000021", "12222222221", "11111111111"],
  ["11100000000", "22110000000", "11221000000", "01122100000", "00112210000", "00011221000", "00001122100", "00000112210", "00000011221"],
  ["11111111111", "12000000021", "12111111021", "12100001021", "12102301021", "12100001021", "12111111021", "12000000021", "11111111111"],
  ["12222222221", "21111111112", "12000000021", "12022222021", "12021112021", "12022222021", "12000000021", "21111111112", "12222222221"],
  ["11111111111", "12222222221", "11111111111", "12222222221", "11111111111", "12222222221", "11111111111", "12222222221", "11111111111"],
  ["10101010101", "01010101010", "10101010101", "01010101010", "10101010101", "01010101010", "10101010101", "01010101010", "10101010101"],
  ["11211211211", "12112112112", "21121121121", "11211211211", "12112112112", "21121121121", "11211211211", "12112112112", "21121121121"],
  ["11111111111", "00000000000", "22222222222", "00000000000", "11111111111", "00000000000", "22222222222", "00000000000", "11111111111"],
  ["10000000001", "21000000012", "12100000121", "11210001211", "01121012110", "00112121100", "00011211000", "00001110000", "00000100000"],
  ["11111111111", "12200000221", "12011111021", "12012221021", "12012321021", "12012221021", "12011111021", "12200000221", "11111111111"],
  ["00111111000", "01222222100", "12211111210", "12100001221", "12100001221", "12211111210", "01222222100", "00111111000", "00011100000"],
  ["11100000111", "12210001221", "11221012211", "01122122110", "00112211000", "01122122110", "11221012211", "12210001221", "11100000111"],
  ["00111111100", "01222222210", "12211111221", "12100001221", "12123321221", "12100001221", "12211111221", "01222222210", "00111111100"],
  ["00111111100", "01222222210", "12211111221", "12210001221", "12210001221", "12211111221", "01222222210", "00111111100", "00000000000"],
  ["11111111111", "12222222221", "12000000021", "12111111021", "12100001021", "12101101021", "12100001021", "12222222221", "11111111111"],
] as const;

export const BREAKLINE_STAGE_COUNT = 8;

function generateFallback(seed: number, requestedMastery: number): BreaklineRun {
  const mastery = Math.max(1, Math.min(4, Math.trunc(requestedMastery || 1)));
  const unsignedSeed = seed >>> 0;
  const selectorSeed = (unsignedSeed ^ Math.imul(mastery + 17, 0x045d9f3b)) >>> 0;
  const selector = mulberry32(selectorSeed);
  const patternOrder = Array.from({ length: PATTERNS.length }, (_, index) => index);
  for (let index = patternOrder.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(selector() * (index + 1));
    [patternOrder[index], patternOrder[swapIndex]] = [patternOrder[swapIndex], patternOrder[index]];
  }
  const stages: BreaklineStage[] = [];

  for (let stageIndex = 0; stageIndex < BREAKLINE_STAGE_COUNT; stageIndex++) {
    const patternIndex = patternOrder[stageIndex];
    const stageSeed = (
      unsignedSeed
      ^ Math.imul(mastery + 31, 0x27d4eb2d)
      ^ Math.imul(stageIndex + 1, 0x165667b1)
    ) >>> 0;
    const orientation = mulberry32(stageSeed);
    const mirrorX = orientation() >= 0.5;
    const mirrorY = orientation() >= 0.5;
    const difficulty = mastery + stageIndex;
    const cells = new Array<number>(9 * 11).fill(0);

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 11; col++) {
        let hp = Number(PATTERNS[patternIndex][row][col]);
        if (
          hp === 1
          && difficulty >= 4
          && (row * 17 + col * 11 + (unsignedSeed & 31) + stageIndex * 3) % 13 === 0
        ) {
          hp = 2;
        } else if (hp === 2 && difficulty >= 6 && (row * 3 + col * 5 + stageIndex) % 11 === 0) {
          hp = 3;
        }

        const targetRow = mirrorY ? 8 - row : row;
        const targetCol = mirrorX ? 10 - col : col;
        cells[targetRow * 11 + targetCol] = hp;
      }
    }

    stages.push({ patternIndex, mirrorX, mirrorY, cells });
  }

  return { version: 1, seed: unsignedSeed, mastery, cols: 11, rows: 9, stages };
}

export function generateBreaklineRun(seed: number, mastery: number): BreaklineRun {
  if (isWasmReady()) {
    try {
      const run = wasm_generate_breakline_run(seed >>> 0, mastery >>> 0) as BreaklineRun;
      if (run?.version === 1 && run.stages?.length === BREAKLINE_STAGE_COUNT && run.stages.every(stage => stage.cells?.length === 99)) {
        return run;
      }
    } catch {
      // The same deterministic layout is generated below if WASM is unavailable.
    }
  }
  return generateFallback(seed, mastery);
}
