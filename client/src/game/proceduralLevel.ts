import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type Echo3DLayout = {
  seed: number;
  mastery: number;
  startPoint: Vector3;
  initialHeading: Vector3;
  markers: { id: string; label: string; point: Vector3 }[];
  exitPoint: Vector3;
  gateRotation: number;
  route: { x: number; z: number; scale: [number, number, number]; rotation: number }[];
  partitions: [number, number, number, number, number][]; // x, z, width, depth, height
  columns: [number, number, number, number][]; // x, z, height, width
  rubble: [number, number, number, number][]; // x, z, scale, rotation
  grass: [number, number][]; // x, z
  listenerPath: Vector3[];
};

function rng(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function distPointToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const l2 = (x2 - x1) ** 2 + (z2 - z1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, pz - z1);
  let t = ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), pz - (z1 + t * (z2 - z1)));
}

export function generate3DEchoLayout(seed: number, mastery: number): Echo3DLayout {
  const prng = rng(seed);

  // 4 Topological flow archetypes:
  // 0: NW -> NE -> SE -> SW (Exit on West boundary)
  // 1: SW -> NW -> NE -> SE (Exit on East boundary)
  // 2: SE -> SW -> NW -> NE (Exit on North/East boundary)
  // 3: NE -> SE -> SW -> NW (Exit on West/North boundary)
  const archetype = Math.abs(Math.imul(seed + 1013, 7919)) % 4;

  const quadrantCenters = [
    { x: -9.5, z: -8.0 }, // 0: NW
    { x: 9.5, z: -8.0 },  // 1: NE
    { x: 9.5, z: 8.0 },   // 2: SE
    { x: -9.5, z: 8.0 },  // 3: SW
  ];

  const sequence = [
    archetype,
    (archetype + 1) % 4,
    (archetype + 2) % 4,
    (archetype + 3) % 4,
  ];

  // 1. Generate Start Point in first quadrant
  const startCenter = quadrantCenters[sequence[0]];
  const startPoint = new Vector3(
    +(startCenter.x + (prng() * 4 - 2)).toFixed(2),
    0,
    +(startCenter.z + (prng() * 4 - 2)).toFixed(2),
  );

  // 2. Thematic marker labels & positions in subsequent quadrants
  const labelPool = [
    ["Kuzey ölçeği", "Sessiz kayıt", "Son yankı"],
    ["İlk mühür", "Taş bellek", "Gölge kapısı"],
    ["Eski yankı", "Orta kaide", "Zaman izi"],
    ["Derin geçit", "Kayıt mühürü", "Yansıma oda"],
    ["Işık izi", "Yankı kaidesi", "Son mühür"],
    ["Bazalt odası", "Kırılgan iz", "Arşiv çıkışı"],
  ];
  const labels = labelPool[Math.abs(Math.imul(seed + 331, 1013)) % labelPool.length];

  const markerPositions = sequence.slice(1).map((qIdx, i) => {
    const qCenter = quadrantCenters[qIdx];
    return {
      id: `mark-${String.fromCharCode(97 + i)}`,
      label: labels[i],
      point: new Vector3(
        +(qCenter.x + (prng() * 4.8 - 2.4)).toFixed(2),
        0,
        +(qCenter.z + (prng() * 4.8 - 2.4)).toFixed(2),
      ),
    };
  });

  // 3. Exit gate location in the last quadrant
  const lastQuad = sequence[3];
  let exitPoint: Vector3;
  let gateRotation = 0;

  if (lastQuad === 0) {
    exitPoint = new Vector3(-13.5, 0, -10.5);
    gateRotation = 0;
  } else if (lastQuad === 1) {
    exitPoint = new Vector3(13.5, 0, -10.5);
    gateRotation = Math.PI;
  } else if (lastQuad === 2) {
    exitPoint = new Vector3(13.5, 0, 9.5);
    gateRotation = Math.PI;
  } else {
    exitPoint = new Vector3(-13.5, 0, 9.5);
    gateRotation = 0;
  }

  // 4. Smooth connecting route (walkable slabs)
  const waypoints = [
    startPoint,
    markerPositions[0].point,
    markerPositions[1].point,
    markerPositions[2].point,
    exitPoint,
  ];

  const route: { x: number; z: number; scale: [number, number, number]; rotation: number }[] = [];
  for (let seg = 0; seg < waypoints.length - 1; seg++) {
    const pA = waypoints[seg];
    const pB = waypoints[seg + 1];
    const dist = Math.hypot(pB.x - pA.x, pB.z - pA.z);
    const steps = Math.max(4, Math.round(dist / 1.55));
    const midX = (pA.x + pB.x) / 2 + (prng() * 2.2 - 1.1);
    const midZ = (pA.z + pB.z) / 2 + (prng() * 2.2 - 1.1);

    for (let s = (seg === 0 ? 0 : 1); s <= steps; s++) {
      const t = s / steps;
      const invT = 1 - t;
      const x = +(invT * invT * pA.x + 2 * invT * t * midX + t * t * pB.x).toFixed(2);
      const z = +(invT * invT * pA.z + 2 * invT * t * midZ + t * t * pB.z).toFixed(2);
      const rot = +((prng() * 0.4 - 0.2)).toFixed(2);
      const sx = +(0.92 + prng() * 0.25).toFixed(2);
      const sz = +(0.92 + prng() * 0.25).toFixed(2);
      route.push({ x, z, scale: [sx, 1, sz], rotation: rot });
    }
  }

  // Initial heading towards the second route slab
  const dx = (route[1]?.x ?? 1) - route[0].x;
  const dz = (route[1]?.z ?? 1) - route[0].z;
  const headingLen = Math.hypot(dx, dz) || 1;
  const initialHeading = new Vector3(+(dx / headingLen).toFixed(3), 0, +(dz / headingLen).toFixed(3));

  function minRouteDistance(x1: number, z1: number, x2: number, z2: number): number {
    let minDist = Infinity;
    for (const r of route) {
      const d = distPointToSegment(r.x, r.z, x1, z1, x2, z2);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  // 5. Partition walls with mathematical clearance / doorways
  const candidateWalls = [
    { x1: 0, z1: -13.5, x2: 0, z2: -4 },
    { x1: 0, z1: 4, x2: 0, z2: 13.5 },
    { x1: -15, z1: 0, x2: -3.5, z2: 0 },
    { x1: 3.5, z1: 0, x2: 15, z2: 0 },
    { x1: -10, z1: -13, x2: -10, z2: -7 },
    { x1: 10, z1: -13, x2: 10, z2: -7 },
    { x1: -10, z1: 7, x2: -10, z2: 13 },
    { x1: 10, z1: 7, x2: 10, z2: 13 },
    { x1: -14, z1: -5, x2: -8, z2: -5 },
    { x1: 8, z1: 5, x2: 14, z2: 5 },
    { x1: -6, z1: 8, x2: 0, z2: 8 },
    { x1: 0, z1: -8, x2: 6, z2: -8 },
  ];

  const partitions: [number, number, number, number, number][] = [];
  for (let i = 0; i < candidateWalls.length; i++) {
    const wall = candidateWalls[i];
    const d = minRouteDistance(wall.x1, wall.z1, wall.x2, wall.z2);
    if (d >= 2.1) {
      const cx = (wall.x1 + wall.x2) / 2;
      const cz = (wall.z1 + wall.z2) / 2;
      const w = Math.abs(wall.x2 - wall.x1) > 0 ? Math.abs(wall.x2 - wall.x1) : 0.72;
      const dp = Math.abs(wall.z2 - wall.z1) > 0 ? Math.abs(wall.z2 - wall.z1) : 0.72;
      const h = +(0.78 + (prng() * 0.14)).toFixed(2);
      partitions.push([+cx.toFixed(2), +cz.toFixed(2), +w.toFixed(2), +dp.toFixed(2), h]);
    }
  }

  // 6. Columns
  const candidateColumns = [
    [-14.1, -12.1], [-8.0, -12.8], [0.2, -12.8], [8.0, -12.6], [14.0, -11.5],
    [-14.0, 11.9], [-4.9, 12.65], [2.0, 12.55], [10.2, 12.7], [14.0, 9.9],
    [-14.1, 3.0], [14.0, 2.6], [-6.7, 4.5], [7.8, -2.7], [-3.5, -3.5], [3.5, 3.5],
  ];

  const columns: [number, number, number, number][] = [];
  for (let i = 0; i < candidateColumns.length; i++) {
    const [cx, cz] = candidateColumns[i];
    let minD = Infinity;
    for (const r of route) {
      const d = Math.hypot(r.x - cx, r.z - cz);
      if (d < minD) minD = d;
    }
    if (minD >= 1.7) {
      const h = +(1.3 + prng() * 0.7).toFixed(2);
      const w = +(0.7 + prng() * 0.15).toFixed(2);
      columns.push([cx, cz, h, w]);
    }
  }

  // 7. Rubble props
  const rubble: [number, number, number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const rx = +(-14.5 + prng() * 29).toFixed(2);
    const rz = +(-12.5 + prng() * 25).toFixed(2);
    let minD = Infinity;
    for (const r of route) {
      const d = Math.hypot(r.x - rx, r.z - rz);
      if (d < minD) minD = d;
    }
    if (minD >= 1.6) {
      const s = +(0.42 + prng() * 0.3).toFixed(2);
      const rot = +(prng() * Math.PI).toFixed(2);
      rubble.push([rx, rz, s, rot]);
    }
  }

  // 8. Dry grass
  const grass: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const gx = +(-14.5 + prng() * 29).toFixed(2);
    const gz = +(-12.5 + prng() * 25).toFixed(2);
    let minD = Infinity;
    for (const r of route) {
      const d = Math.hypot(r.x - gx, r.z - gz);
      if (d < minD) minD = d;
    }
    if (minD >= 1.4) {
      grass.push([gx, gz]);
    }
  }

  // 9. Listener patrol path around the quadrants
  const listenerPath = [
    new Vector3(+(quadrantCenters[0].x * 0.5 + prng() * 2).toFixed(2), 0, +(quadrantCenters[0].z * 0.5 + prng() * 2).toFixed(2)),
    new Vector3(+(quadrantCenters[1].x * 0.5 + prng() * 2).toFixed(2), 0, +(quadrantCenters[1].z * 0.5 + prng() * 2).toFixed(2)),
    new Vector3(+(quadrantCenters[2].x * 0.5 + prng() * 2).toFixed(2), 0, +(quadrantCenters[2].z * 0.5 + prng() * 2).toFixed(2)),
    new Vector3(+(quadrantCenters[3].x * 0.5 + prng() * 2).toFixed(2), 0, +(quadrantCenters[3].z * 0.5 + prng() * 2).toFixed(2)),
  ];

  return {
    seed,
    mastery,
    startPoint,
    initialHeading,
    markers: markerPositions,
    exitPoint,
    gateRotation,
    route,
    partitions,
    columns,
    rubble,
    grass,
    listenerPath,
  };
}
