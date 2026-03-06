import { BOARD_CONFIG, toWorldPos, INITIAL_LANES, INITIAL_REGIONS } from './src/config/board.ts';

console.log("TABLE BOUNDS:");
console.log("X: [-", BOARD_CONFIG.width / 2, ", ", BOARD_CONFIG.width / 2, "]");
console.log("Z: [-", BOARD_CONFIG.depth / 2, ", ", BOARD_CONFIG.depth / 2, "]");

const ms = INITIAL_REGIONS.find(r => r.id === 'region-main-scheme')!;
console.log("\nMAIN SCHEME:");
console.log("Center Position:", ms.position);
console.log("Left edge:", ms.position[0] - ms.width / 2);
console.log("Top edge:", ms.position[2] - ms.depth / 2);

const pa = INITIAL_LANES.find(l => l.id === 'lane-player-area')!;
console.log("\nPLAYER AREA:");
console.log("Center Position:", pa.position);
console.log("Bottom edge:", pa.position[2] + pa.depth / 2);

const pd = INITIAL_REGIONS.find(r => r.id === 'region-player-discard')!;
console.log("\nPLAYER DISCARD:");
console.log("Center Position:", pd.position);
console.log("Bottom edge:", pd.position[2] + pd.depth / 2);
