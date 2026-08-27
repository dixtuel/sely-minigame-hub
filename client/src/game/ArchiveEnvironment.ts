import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { assets } from "./assets";
import { MAZE_CELL_SIZE, MAZE_COLS, MAZE_ROWS } from "./maze";
import { generate3DEchoLayout, type Echo3DLayout, type WallPlacement } from "./proceduralLevel";

type Rect = { xMin: number; xMax: number; zMin: number; zMax: number };

function placementToRect([x, z, width, depth]: WallPlacement): Rect {
  return { xMin: x - width / 2, xMax: x + width / 2, zMin: z - depth / 2, zMax: z + depth / 2 };
}

/**
 * Merges many static props into a single draw call. Thin instances would do the same job
 * with less setup, but the production build's tree-shaking silently drops part of
 * Babylon's thin-instance prototype patch (thinInstanceAdd exists and runs, but the
 * instance buffer never gets allocated — instancesCount stays 0, so nothing renders).
 * Mesh.MergeMeshes is a plain static method on the always-fully-bundled Mesh class, so it
 * doesn't have that failure mode.
 */
function mergeIntoOne(name: string, material: StandardMaterial, parts: Mesh[]): Mesh | null {
  if (!parts.length) return null;
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  if (!merged) return null;
  merged.name = name;
  merged.material = material;
  return merged;
}

export type Marker = {
  id: string;
  label: string;
  point: Vector3;
  root: TransformNode;
  coreMaterial: StandardMaterial;
  ringMaterial: StandardMaterial;
  complete: boolean;
};

type RevealEntry = {
  mesh: AbstractMesh;
  point: Vector3;
  persistent: boolean;
  baseVisibility: number;
  /** Once an echo pulse reveals it for the first time, it stays dimly visible from then on. */
  sticky: boolean;
};

type RevealWave = { origin: Vector3; age: number };

const copper = Color3.FromHexString("#c9824a");
const turquoise = Color3.FromHexString("#70c6bd");
const charcoal = Color3.FromHexString("#171a1c");
// The wavefront travels roughly WAVE_SPEED * (WAVE_LIFETIME + 0.12) units before dying out —
// keep that well under the maze size (cells are MAZE_CELL_SIZE apart) so one echo reveals a
// nearby pocket of the maze, not most of the map.
const WAVE_SPEED = 5.0;
const WAVE_LIFETIME = 1.05;
const REVEAL_TRAIL = 0.85;

const staticMesh = (mesh: AbstractMesh) => {
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
};

export class ArchiveEnvironment {
  markers: Marker[] = [];
  startPoint = new Vector3(-12.0, 0, -10.2);
  initialHeading = new Vector3(0.62, 0, 0.78);
  exitPoint = new Vector3(13.2, 0, 8.4);
  listenerPath: Vector3[] = [];

  private readonly scene: Scene;
  private readonly stoneMaterial: StandardMaterial;
  private readonly ambientStoneMaterial: StandardMaterial;
  private readonly grassMaterial: StandardMaterial;
  private readonly copperMaterial: StandardMaterial;
  private gateSeal!: StandardMaterial;
  private gateRoot!: TransformNode;
  private readonly revealables: RevealEntry[] = [];
  private readonly waves: RevealWave[] = [];
  private readonly gateMeshes: AbstractMesh[] = [];
  private readonly dynamicNodes: TransformNode[] = [];
  private readonly dynamicMeshes: AbstractMesh[] = [];
  private revealClock = 0;
  private readonly boundaryRects: Rect[] = [];
  private readonly wallRects: Rect[] = [];
  private gateRect: Rect | null = null;
  private doorIsOpen = false;
  rooms: { x: number; z: number; theme: 0 | 1 | 2 | 3 }[] = [];

  constructor(scene: Scene, seed = 618071, mastery = 0) {
    this.scene = scene;
    const floorMaterial = this.createMaterial("basalt-floor", "#2e3d3c", assets.floor, 8.5, 7.5, assets.floorNormal);
    floorMaterial.emissiveColor = Color3.FromHexString("#040807");
    const floor = CreateGround("archive-floor", { width: 34, height: 30, subdivisions: 2 }, scene);
    floor.material = floorMaterial;
    floor.receiveShadows = true;
    staticMesh(floor);
    floorMaterial.freeze();

    this.stoneMaterial = this.createMaterial("archive-stone", "#181e1f", assets.archiveStone, 3.2, 1.5, assets.archiveStoneNormal);

    // A slightly lighter, always-visible twin of the stone material for ordinary maze walls,
    // columns, rubble and the boundary — real geometry the player's own lamp lights up as they
    // get close, dungeon-crawler style, rather than a self-glowing surface. Only a minority of
    // walls (hidden "traps") and the markers/gate stay in the pulse-only reveal system.
    this.ambientStoneMaterial = this.stoneMaterial.clone("archive-stone-ambient");
    this.ambientStoneMaterial.diffuseColor = Color3.FromHexString("#54605f");
    this.ambientStoneMaterial.emissiveColor = Color3.FromHexString("#050807");
    this.ambientStoneMaterial.freeze();

    this.grassMaterial = new StandardMaterial("dry-grass", scene);
    this.grassMaterial.diffuseColor = Color3.FromHexString("#8a7a52");
    this.grassMaterial.emissiveColor = Color3.FromHexString("#221f12");
    this.grassMaterial.alpha = 0.75;
    this.grassMaterial.freeze();

    this.copperMaterial = new StandardMaterial("gate-accent", scene);
    this.copperMaterial.diffuseColor = copper;
    this.copperMaterial.emissiveColor = Color3.FromHexString("#26150d");

    this.buildOuterPerimeter();
    this.buildLevel(seed, mastery);
  }

  private createMaterial(name: string, color: string, textureUrl: string, uScale: number, vScale: number, normalUrl?: string) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.Black();
    const texture = new Texture(textureUrl, this.scene, true, false);
    texture.uScale = uScale;
    texture.vScale = vScale;
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    if (normalUrl) {
      const bump = new Texture(normalUrl, this.scene, true, false);
      bump.uScale = uScale;
      bump.vScale = vScale;
      bump.wrapU = Texture.WRAP_ADDRESSMODE;
      bump.wrapV = Texture.WRAP_ADDRESSMODE;
      material.bumpTexture = bump;
    }
    return material;
  }

  private registerRevealable(mesh: AbstractMesh, position: Vector3, baseVisibility = 1, sticky = false) {
    mesh.isPickable = false;
    // Hidden traps get a faint "tell" even before an echo hits them — a wall that pops out of
    // pure black with zero warning feels unfair. Everything else (markers, the gate) stays
    // fully hidden until deliberately revealed, which is the actual point of finding them.
    mesh.visibility = sticky ? 0.07 : 0;
    this.revealables.push({ mesh, point: new Vector3(position.x, 0, position.z), persistent: false, baseVisibility, sticky });
    return mesh;
  }

  private registerPersistent(mesh: AbstractMesh, position: Vector3, baseVisibility = 1) {
    this.registerRevealable(mesh, position, baseVisibility);
    const entry = this.revealables[this.revealables.length - 1];
    entry.persistent = true;
    return mesh;
  }

  private buildOuterPerimeter() {
    const thickness = 0.72;
    const halfW = (MAZE_COLS * MAZE_CELL_SIZE) / 2;
    const halfH = (MAZE_ROWS * MAZE_CELL_SIZE) / 2;
    const height = 1.18;

    const parts: Mesh[] = [];
    const addWall = (x: number, z: number, width: number, depth: number) => {
      const box = CreateBox("boundary-part", { width, height, depth }, this.scene);
      box.position.set(x, height / 2, z);
      parts.push(box);
      this.boundaryRects.push({ xMin: x - width / 2, xMax: x + width / 2, zMin: z - depth / 2, zMax: z + depth / 2 });
    };

    addWall(0, -halfH - thickness / 2, halfW * 2 + thickness * 2, thickness);
    addWall(0, halfH + thickness / 2, halfW * 2 + thickness * 2, thickness);
    addWall(-halfW - thickness / 2, 0, thickness, halfH * 2);
    addWall(halfW + thickness / 2, 0, thickness, halfH * 2);

    const boundary = mergeIntoOne("boundary-walls", this.ambientStoneMaterial, parts);
    if (boundary) staticMesh(boundary);
  }

  rebuild(seed: number, mastery: number) {
    for (const mesh of this.dynamicMeshes) {
      mesh.dispose(false, true);
    }
    this.dynamicMeshes.length = 0;

    for (const node of this.dynamicNodes) {
      node.dispose(false, true);
    }
    this.dynamicNodes.length = 0;

    this.revealables.length = 0;
    this.waves.length = 0;
    this.gateMeshes.length = 0;
    this.markers.length = 0;
    this.wallRects.length = 0;
    this.gateRect = null;
    this.rooms = [];

    this.buildLevel(seed, mastery);
  }

  private buildLevel(seed: number, mastery: number) {
    const layout = generate3DEchoLayout(seed, mastery);

    this.startPoint.copyFrom(layout.startPoint);
    this.initialHeading.copyFrom(layout.initialHeading);
    this.exitPoint.copyFrom(layout.exitPoint);
    this.listenerPath = layout.listenerPath.map((p) => p.clone());

    // 1. Maze walls. Most stay ambiently visible (merged into one draw call) so the
    // corridors actually read as a maze; a minority — always off the solution route to
    // every marker and the gate (see selectHiddenWalls) — are hidden "traps" that only
    // an echo pulse reveals. Once a pulse has hit one, it stays dimly visible for good.
    const hiddenKeys = new Set(layout.hiddenWalls.map((wall) => wall.join(",")));
    const ambientWallParts: Mesh[] = [];

    layout.walls.forEach((placement, index) => {
      const [x, z, width, depth, height] = placement;
      this.wallRects.push(placementToRect(placement));
      if (hiddenKeys.has(placement.join(","))) {
        const wall = CreateBox(`maze-wall-hidden-${index}`, { width, height, depth }, this.scene);
        wall.material = this.stoneMaterial;
        wall.position.set(x, height / 2, z);
        this.registerRevealable(wall, wall.position, 0.9, true);
        staticMesh(wall);
        this.dynamicMeshes.push(wall);
      } else {
        const box = CreateBox(`maze-wall-part-${index}`, { width, height, depth }, this.scene);
        box.position.set(x, height / 2, z);
        ambientWallParts.push(box);
      }
    });
    const ambientWallMesh = mergeIntoOne("maze-walls-ambient", this.ambientStoneMaterial, ambientWallParts);
    if (ambientWallMesh) {
      staticMesh(ambientWallMesh);
      this.dynamicMeshes.push(ambientWallMesh);
    }

    this.gateRect = placementToRect(layout.gateWallPlacement);
    this.rooms = layout.rooms;

    // 2. Procedural Columns — ambient decor, merged into one draw call.
    const columnParts: Mesh[] = layout.columns.map(([x, z, height, width], index) => {
      const column = CreateBox(`column-part-${index}`, { width: 0.62, height: 1, depth: 0.62 }, this.scene);
      column.position.set(x, height / 2, z);
      column.scaling.set(width, height, width * (index % 3 === 0 ? 1.25 : 0.92));
      column.rotation.y = (index % 4) * 0.19;
      return column;
    });
    const columnMesh = mergeIntoOne("archive-columns", this.ambientStoneMaterial, columnParts);
    if (columnMesh) {
      staticMesh(columnMesh);
      this.dynamicMeshes.push(columnMesh);
    }

    // 3. Procedural Rubble & Grass Props — ambient decor, merged into one draw call each.
    const rubbleParts: Mesh[] = layout.rubble.map(([x, z, scale, rotation], index) => {
      const rock = CreateBox(`rubble-part-${index}`, { width: 0.7, height: 0.35, depth: 0.55 }, this.scene);
      rock.position.set(x, 0.17, z);
      rock.scaling.set(scale, scale * (index % 3 === 0 ? 1.2 : 0.85), scale * 0.82);
      rock.rotation.y = rotation;
      return rock;
    });
    const rubbleMesh = mergeIntoOne("archive-rubble", this.ambientStoneMaterial, rubbleParts);
    if (rubbleMesh) {
      staticMesh(rubbleMesh);
      this.dynamicMeshes.push(rubbleMesh);
    }

    const grassParts: Mesh[] = [];
    layout.grass.forEach(([x, z], index) => {
      for (let blade = 0; blade < 3; blade += 1) {
        const grassBlade = CreateBox(`grass-part-${index}-${blade}`, { width: 0.06, height: 0.55, depth: 0.06 }, this.scene);
        grassBlade.position.set(x + (blade - 1) * 0.12, 0.26, z + (blade % 2) * 0.1);
        grassBlade.rotation.z = (blade - 1) * 0.26;
        grassBlade.rotation.y = blade * 0.9;
        grassParts.push(grassBlade);
      }
    });
    const grassMesh = mergeIntoOne("archive-grass", this.grassMaterial, grassParts);
    if (grassMesh) {
      staticMesh(grassMesh);
      this.dynamicMeshes.push(grassMesh);
    }

    // 5. Procedural Markers
    this.markers = layout.markers.map((definition) => {
      const root = new TransformNode(definition.id, this.scene);
      root.position.copyFrom(definition.point);
      this.dynamicNodes.push(root);

      const baseMaterial = new StandardMaterial(`${definition.id}-base`, this.scene);
      baseMaterial.diffuseColor = Color3.FromHexString("#293033");
      baseMaterial.specularColor = Color3.Black();

      const ringMaterial = new StandardMaterial(`${definition.id}-ring`, this.scene);
      ringMaterial.diffuseColor = Color3.FromHexString("#273738");
      ringMaterial.emissiveColor = Color3.FromHexString("#142425");

      const coreMaterial = new StandardMaterial(`${definition.id}-core`, this.scene);
      coreMaterial.diffuseColor = Color3.FromHexString("#553b2c");
      coreMaterial.emissiveColor = Color3.FromHexString("#201510");

      const plinth = CreateCylinder(`${definition.id}-plinth`, { diameterTop: 0.95, diameterBottom: 1.3, height: 0.5, tessellation: 8 }, this.scene);
      plinth.parent = root;
      plinth.position.y = 0.25;
      plinth.material = baseMaterial;

      const ring = CreateCylinder(`${definition.id}-ring-geometry`, { diameter: 0.92, height: 0.13, tessellation: 32 }, this.scene);
      ring.parent = root;
      ring.position.y = 0.53;
      ring.material = ringMaterial;

      const core = CreateCylinder(`${definition.id}-core-geometry`, { diameter: 0.22, height: 0.9, tessellation: 6 }, this.scene);
      core.parent = root;
      core.position.y = 0.85;
      core.material = coreMaterial;

      const glyph = CreatePlane(`${definition.id}-glyph`, { size: 1.1 }, this.scene);
      glyph.parent = root;
      glyph.rotation.x = Math.PI / 2;
      glyph.position.y = 0.61;
      const glyphMaterial = new StandardMaterial(`${definition.id}-glyph-material`, this.scene);
      const glyphTexture = new Texture(assets.echoGlyph, this.scene, true, false);
      glyphTexture.hasAlpha = true;
      glyphMaterial.diffuseTexture = glyphTexture;
      glyphMaterial.emissiveTexture = glyphTexture;
      glyphMaterial.useAlphaFromDiffuseTexture = true;
      glyphMaterial.backFaceCulling = false;
      glyphMaterial.emissiveColor = Color3.FromHexString("#507f7b");
      glyph.material = glyphMaterial;

      [plinth, ring, core, glyph].forEach((mesh) => {
        this.registerRevealable(mesh, root.position, 1);
        this.dynamicMeshes.push(mesh);
      });

      return { id: definition.id, label: definition.label, point: root.position.clone(), root, coreMaterial, ringMaterial, complete: false };
    });

    // 6. Procedural Exit Gate
    this.buildGate(layout.exitPoint, layout.gateRotation);
  }

  private buildGate(position: Vector3, rotationY: number) {
    this.gateRoot = new TransformNode("gate-root", this.scene);
    this.gateRoot.position.copyFrom(position);
    this.gateRoot.rotation.y = rotationY;
    this.dynamicNodes.push(this.gateRoot);

    const addGateChild = (mesh: AbstractMesh, persistent = false) => {
      mesh.material = this.stoneMaterial;
      mesh.parent = this.gateRoot;
      if (persistent) this.registerPersistent(mesh, position, 1);
      else this.registerRevealable(mesh, position, 0.95);
      this.gateMeshes.push(mesh);
      this.dynamicMeshes.push(mesh);
      staticMesh(mesh);
      return mesh;
    };

    const left = CreateBox("gate-left", { width: 0.72, height: 3.0, depth: 0.9 }, this.scene);
    left.position.set(-0.85, 1.5, 0);
    addGateChild(left);

    const right = CreateBox("gate-right", { width: 0.72, height: 3.0, depth: 0.9 }, this.scene);
    right.position.set(0.85, 1.5, 0);
    addGateChild(right);

    const top = CreateBox("gate-top", { width: 2.42, height: 0.62, depth: 0.9 }, this.scene);
    top.position.set(0, 2.72, 0);
    addGateChild(top);

    const lintel = CreateBox("gate-lintel", { width: 2.8, height: 0.18, depth: 1.12 }, this.scene);
    lintel.position.set(0, 0.18, 0);
    addGateChild(lintel);

    const seal = CreatePlane("exit-seal", { size: 1.35 }, this.scene);
    seal.parent = this.gateRoot;
    seal.position.set(0, 1.55, -0.52);
    seal.rotation.y = Math.PI;
    const sealMaterial = new StandardMaterial("exit-seal-material", this.scene);
    const sealTexture = new Texture(assets.echoGlyph, this.scene, true, false);
    sealTexture.hasAlpha = true;
    sealMaterial.diffuseTexture = sealTexture;
    sealMaterial.emissiveTexture = sealTexture;
    sealMaterial.useAlphaFromDiffuseTexture = true;
    sealMaterial.backFaceCulling = false;
    sealMaterial.diffuseColor = Color3.FromHexString("#3d2b20");
    sealMaterial.emissiveColor = Color3.FromHexString("#1d110d");
    seal.material = sealMaterial;
    this.registerRevealable(seal, position, 1);
    this.gateMeshes.push(seal);
    this.dynamicMeshes.push(seal);
    this.gateSeal = sealMaterial;

    [0.72, 1.1].forEach((diameter, index) => {
      const ring = CreateTorus(`gate-ring-${index}`, { diameter, thickness: 0.055, tessellation: 32 }, this.scene);
      ring.parent = this.gateRoot;
      ring.position.set(0, 1.55, -0.57);
      ring.rotation.x = Math.PI / 2;
      ring.material = this.copperMaterial;
      this.registerRevealable(ring, position, 1);
      this.gateMeshes.push(ring);
      this.dynamicMeshes.push(ring);
      staticMesh(ring);
    });

    [-0.82, 0.82].forEach((offset, index) => {
      const lamp = CreateCylinder(`gate-lamp-${index}`, { diameter: 0.16, height: 0.46, tessellation: 8 }, this.scene);
      lamp.parent = this.gateRoot;
      lamp.material = this.copperMaterial;
      lamp.position.set(offset, 0.7, -0.5);
      this.registerRevealable(lamp, position, 1);
      this.gateMeshes.push(lamp);
      this.dynamicMeshes.push(lamp);
      staticMesh(lamp);
    });
  }

  registerDynamicReveal(mesh: AbstractMesh, position: Vector3, baseVisibility = 1) {
    return this.registerRevealable(mesh, position, baseVisibility);
  }

  private nearRect(px: number, pz: number, radius: number, rect: Rect) {
    return px > rect.xMin - radius && px < rect.xMax + radius && pz > rect.zMin - radius && pz < rect.zMax + radius;
  }

  private blocked(px: number, pz: number, radius: number) {
    for (const rect of this.boundaryRects) {
      if (this.nearRect(px, pz, radius, rect)) return true;
    }
    for (const rect of this.wallRects) {
      if (this.nearRect(px, pz, radius, rect)) return true;
    }
    if (!this.doorIsOpen && this.gateRect && this.nearRect(px, pz, radius, this.gateRect)) return true;
    return false;
  }

  /** Axis-separated slide collision against maze walls + the locked gate. */
  resolveMove(x: number, z: number, dx: number, dz: number, radius = 0.34) {
    let nx = x + dx;
    if (this.blocked(nx, z, radius)) nx = x;
    let nz = z + dz;
    if (this.blocked(nx, nz, radius)) nz = z;
    return { x: nx, z: nz };
  }

  themeAt(x: number, z: number): 0 | 1 | 2 | 3 {
    let best: { x: number; z: number; theme: 0 | 1 | 2 | 3 } | null = null;
    let bestDist = Infinity;
    for (const room of this.rooms) {
      const d = Math.hypot(room.x - x, room.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = room;
      }
    }
    return best?.theme ?? 0;
  }

  private setReveal(entry: RevealEntry, reveal: number) {
    entry.mesh.visibility = reveal;
  }

  triggerPulse(origin: Vector3) {
    this.waves.push({ origin: origin.clone(), age: 0 });
    if (this.waves.length > 3) this.waves.shift();
  }

  update(delta: number) {
    this.revealClock += delta;
    this.waves.forEach((wave) => { wave.age += delta; });
    while (this.waves[0] && this.waves[0].age > WAVE_LIFETIME) this.waves.shift();

    this.revealables.forEach((entry) => {
      let waveReveal = 0;
      this.waves.forEach((wave) => {
        const distance = Math.hypot(entry.point.x - wave.origin.x, entry.point.z - wave.origin.z);
        const waveTime = wave.age - distance / WAVE_SPEED;
        if (waveTime < -0.12 || waveTime > REVEAL_TRAIL) return;
        const front = waveTime < 0.18 ? Math.max(0, (waveTime + 0.12) / 0.3) : 1;
        const trail = waveTime <= 0.18 ? 1 : Math.max(0, 1 - (waveTime - 0.18) / (REVEAL_TRAIL - 0.18));
        waveReveal = Math.max(waveReveal, front * trail * entry.baseVisibility);
      });
      // A hidden trap that an echo has ever touched stays dimly visible from then on —
      // you shouldn't have to keep re-pinging a wall you already found. The 0.05 threshold
      // is deliberately above the passive "tell" baseline (0.07 visibility but no actual
      // wave contribution) so just standing near one doesn't count as discovering it.
      if (entry.sticky && !entry.persistent && waveReveal > 0.05) entry.persistent = true;
      const reveal = entry.persistent
        ? Math.max(waveReveal, (entry.sticky ? 0.55 : 0.82) * entry.baseVisibility)
        : entry.sticky
          ? Math.max(waveReveal, 0.07)
          : waveReveal;
      this.setReveal(entry, reveal);
    });
  }

  activateMarker(marker: Marker) {
    marker.complete = true;
    marker.coreMaterial.emissiveColor.copyFrom(copper.scale(0.95));
    marker.coreMaterial.diffuseColor.copyFrom(copper);
    marker.ringMaterial.emissiveColor.copyFrom(turquoise.scale(0.65));
    marker.root.scaling.setAll(1.08);
    const markerMeshes = new Set(marker.root.getChildMeshes());
    this.revealables.forEach((entry) => {
      if (markerMeshes.has(entry.mesh)) {
        entry.persistent = true;
        this.setReveal(entry, 0.82);
      }
    });
  }

  setDoorOpen(open: boolean) {
    this.doorIsOpen = open;
    this.gateSeal.emissiveColor.copyFrom(open ? copper.scale(0.92) : Color3.FromHexString("#1d110d"));
    this.gateSeal.diffuseColor.copyFrom(open ? Color3.FromHexString("#c9824a") : Color3.FromHexString("#3d2b20"));
    this.revealables.forEach((entry) => {
      if (this.gateMeshes.includes(entry.mesh)) {
        entry.persistent = open;
        if (!open) {
          this.setReveal(entry, 0);
        } else {
          this.setReveal(entry, 0.9);
        }
      }
    });
  }

  reset() {
    this.waves.length = 0;
    this.revealClock = 0;
    this.markers.forEach((marker) => {
      marker.complete = false;
      marker.root.scaling.setAll(1);
      marker.coreMaterial.diffuseColor.copyFrom(Color3.FromHexString("#553b2c"));
      marker.coreMaterial.emissiveColor.copyFrom(Color3.FromHexString("#201510"));
      marker.ringMaterial.emissiveColor.copyFrom(Color3.FromHexString("#142425"));
    });
    this.revealables.forEach((entry) => {
      entry.persistent = false;
      this.setReveal(entry, 0);
    });
    this.setDoorOpen(false);
  }
}
