import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { assets } from "./assets";
import type { GridPoint } from "./types";

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
};

type RevealWave = { origin: Vector3; age: number };

const copper = Color3.FromHexString("#c9824a");
const turquoise = Color3.FromHexString("#70c6bd");
const charcoal = Color3.FromHexString("#171a1c");
const WAVE_SPEED = 6.2;
const WAVE_LIFETIME = 3.1;
const REVEAL_TRAIL = 1.55;
const point = ({ x, z }: GridPoint) => new Vector3(x, 0, z);

const staticMesh = (mesh: AbstractMesh) => {
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
};

export class ArchiveEnvironment {
  readonly markers: Marker[];
  readonly exitPoint = new Vector3(13.2, 0, 8.4);
  readonly listenerPath = [
    new Vector3(-4.8, 0, 9.3),
    new Vector3(4.4, 0, 9.5),
    new Vector3(10.2, 0, 5.2),
    new Vector3(5.8, 0, 1.2),
    new Vector3(-1.8, 0, 2.2),
  ];
  private readonly scene: Scene;
  private readonly routeMaterial: StandardMaterial;
  private gateSeal!: StandardMaterial;
  private readonly revealables: RevealEntry[] = [];
  private readonly waves: RevealWave[] = [];
  private readonly gateMeshes: AbstractMesh[] = [];
  private revealClock = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    const floorMaterial = this.createMaterial("basalt-floor", "#111817", assets.floor, 8.5, 7.5);
    floorMaterial.alpha = 0.72;
    const floor = CreateGround("archive-floor", { width: 34, height: 30, subdivisions: 2 }, scene);
    floor.material = floorMaterial;
    floor.visibility = 0.36;
    staticMesh(floor);
    floorMaterial.freeze();

    const stoneMaterial = this.createMaterial("archive-stone", "#181e1f", assets.archiveStone, 3.2, 1.5);
    this.routeMaterial = new StandardMaterial("route-slab", scene);
    this.routeMaterial.diffuseColor = Color3.FromHexString("#59605c");
    this.routeMaterial.emissiveColor = Color3.FromHexString("#101a1a");
    this.routeMaterial.specularColor = Color3.Black();
    const routeTexture = new Texture(assets.floor, scene, true, false);
    routeTexture.uScale = 0.92;
    routeTexture.vScale = 0.92;
    routeTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    routeTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    this.routeMaterial.diffuseTexture = routeTexture;

    this.buildPerimeter(stoneMaterial);
    this.buildRoute();
    this.buildScatteredProps(stoneMaterial);
    this.markers = this.buildMarkers();
    this.buildGate(stoneMaterial);
    stoneMaterial.freeze();
  }

  private createMaterial(name: string, color: string, textureUrl: string, uScale: number, vScale: number) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.Black();
    const texture = new Texture(textureUrl, this.scene, true, false);
    texture.uScale = uScale;
    texture.vScale = vScale;
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    return material;
  }

  private registerRevealable(mesh: AbstractMesh, position: Vector3, baseVisibility = 1) {
    mesh.isPickable = false;
    mesh.visibility = 0;
    this.revealables.push({ mesh, point: new Vector3(position.x, 0, position.z), persistent: false, baseVisibility });
    return mesh;
  }

  private registerPersistent(mesh: AbstractMesh, position: Vector3, baseVisibility = 1) {
    this.registerRevealable(mesh, position, baseVisibility);
    const entry = this.revealables[this.revealables.length - 1];
    entry.persistent = true;
    return mesh;
  }

  private buildPerimeter(stoneMaterial: StandardMaterial) {
    const addWall = (name: string, x: number, z: number, width: number, depth: number, height = 1.05) => {
      const wall = CreateBox(name, { width, height, depth }, this.scene);
      wall.position.set(x, height / 2, z);
      this.registerRevealable(wall, wall.position, 0.98);
      staticMesh(wall);
    };

    addWall("north-boundary", 0, -14.25, 32.5, 0.72, 1.18);
    addWall("south-boundary", 0, 14.25, 32.5, 0.72, 1.18);
    addWall("west-boundary", -16.25, 0, 0.72, 27.5, 1.18);
    addWall("east-boundary", 16.25, 0, 0.72, 27.5, 1.18);

    const partitions = [
      [-10.8, -8.0, 0.62, 7.2, 0.78], [-11.8, -1.5, 5.6, 0.62, 0.84],
      [-5.3, -12.0, 7.0, 0.62, 0.82], [6.5, -11.7, 8.4, 0.62, 0.88],
      [9.5, -7.3, 0.62, 4.8, 0.82], [11.8, -1.2, 6.0, 0.62, 0.8],
      [7.2, 5.0, 0.62, 5.2, 0.86], [3.6, 11.5, 8.6, 0.62, 0.8],
      [-8.8, 10.8, 0.62, 5.4, 0.84], [-12.5, 6.5, 4.2, 0.62, 0.78],
    ] as const;
    partitions.forEach(([x, z, width, depth, height], index) => addWall(`room-partition-${index}`, x, z, width, depth, height));

    const columns = [
      [-14.1, -12.1, 2.0, 0.8], [-8.0, -12.8, 1.35, 0.72], [0.2, -12.8, 1.65, 0.76],
      [8.0, -12.6, 1.45, 0.8], [14.0, -11.5, 1.9, 0.68], [-14.0, 11.9, 1.55, 0.78],
      [-4.9, 12.65, 1.9, 0.74], [2.0, 12.55, 1.3, 0.82], [10.2, 12.7, 1.75, 0.72],
      [14.0, 9.9, 1.3, 0.85], [-14.1, 3.0, 1.45, 0.7], [14.0, 2.6, 1.8, 0.76],
      [-6.7, 4.5, 1.25, 0.7], [7.8, -2.7, 1.4, 0.8],
    ] as const;
    columns.forEach(([x, z, height, width], index) => {
      const column = CreateBox(`archive-column-${index}`, { width: 0.62, height: 1, depth: 0.62 }, this.scene);
      column.material = stoneMaterial;
      column.position.set(x, height / 2, z);
      column.scaling.set(width, height, width * (index % 3 === 0 ? 1.25 : 0.92));
      column.rotation.y = (index % 4) * 0.19;
      this.registerRevealable(column, column.position, 0.82);
      staticMesh(column);
    });
  }

  private buildRoute() {
    const route = [
      { x: -12.0, z: -10.2, scale: [1.2, 1, 0.92], rotation: -0.18 },
      { x: -10.6, z: -9.4, scale: [0.94, 1, 1.14], rotation: 0.08 },
      { x: -9.0, z: -8.9, scale: [1.14, 1, 0.9], rotation: -0.12 },
      { x: -7.3, z: -8.7, scale: [0.9, 1, 1.2], rotation: 0.16 },
      { x: -6.0, z: -7.8, scale: [1.1, 1, 0.94], rotation: -0.08 },
      { x: -5.7, z: -6.0, scale: [1.04, 1, 0.92], rotation: 0.24 },
      { x: -4.8, z: -4.3, scale: [0.94, 1, 1.14], rotation: -0.16 },
      { x: -3.0, z: -3.1, scale: [1.16, 1, 0.9], rotation: 0.12 },
      { x: -1.0, z: -2.25, scale: [0.9, 1, 1.16], rotation: -0.12 },
      { x: 1.0, z: -1.65, scale: [1.12, 1, 0.92], rotation: 0.18 },
      { x: 3.0, z: -1.55, scale: [1.05, 1, 0.95], rotation: -0.08 },
      { x: 5.2, z: -1.75, scale: [1.14, 1, 0.9], rotation: 0.12 },
      { x: 6.7, z: -0.65, scale: [0.92, 1, 1.16], rotation: -0.14 },
      { x: 6.8, z: 1.25, scale: [1.13, 1, 0.9], rotation: 0.1 },
      { x: 5.4, z: 2.8, scale: [1.0, 1, 0.96], rotation: -0.06 },
      { x: 3.6, z: 4.25, scale: [0.95, 1, 1.1], rotation: 0.17 },
      { x: 1.8, z: 5.65, scale: [1.12, 1, 0.92], rotation: -0.15 },
      { x: 0.1, z: 7.1, scale: [0.9, 1, 1.16], rotation: 0.11 },
      { x: -1.25, z: 8.25, scale: [1.12, 1, 0.9], rotation: -0.1 },
      { x: 0.7, z: 9.15, scale: [1.0, 1, 0.96], rotation: 0.15 },
      { x: 3.0, z: 9.1, scale: [1.14, 1, 0.9], rotation: -0.1 },
      { x: 5.3, z: 9.0, scale: [0.95, 1, 1.14], rotation: 0.1 },
      { x: 7.6, z: 8.75, scale: [1.1, 1, 0.92], rotation: -0.08 },
      { x: 9.7, z: 8.55, scale: [0.94, 1, 1.1], rotation: 0.12 },
      { x: 11.7, z: 8.45, scale: [1.08, 1, 0.9], rotation: -0.06 },
      { x: 13.1, z: 8.4, scale: [0.82, 1, 0.88], rotation: 0.02 },
    ];
    route.forEach((position, index) => {
      const slab = CreateBox(`route-slab-${index}`, { width: 1.7, height: 0.12, depth: 1.7 }, this.scene);
      slab.material = this.routeMaterial;
      slab.position.set(position.x, 0.055, position.z);
      slab.scaling.set(position.scale[0], position.scale[1], position.scale[2]);
      slab.rotation.y = position.rotation;
      this.registerRevealable(slab, slab.position, 1);
      staticMesh(slab);
      const inlay = CreateTorus(`route-inlay-${index}`, { diameter: 1.08, thickness: 0.025, tessellation: 16 }, this.scene);
      inlay.position.set(position.x, 0.125, position.z);
      inlay.rotation.y = position.rotation;
      inlay.scaling.set(position.scale[0] * 0.82, 1, position.scale[2] * 0.82);
      inlay.material = this.routeMaterial;
      this.registerRevealable(inlay, inlay.position, 0.95);
      staticMesh(inlay);
    });
  }

  private buildScatteredProps(stoneMaterial: StandardMaterial) {
    const rockPositions = [
      [-14.0, -6.7, 0.72, 0.5], [-12.8, -2.3, 0.5, 0.8], [-10.0, -4.3, 0.44, 0.55],
      [-8.2, -1.8, 0.62, 0.46], [-6.6, -2.8, 0.5, 0.65], [-4.4, -0.9, 0.46, 0.74],
      [-2.2, -5.7, 0.58, 0.55], [1.3, -5.4, 0.68, 0.42], [4.7, -5.0, 0.48, 0.7],
      [8.7, -5.3, 0.54, 0.52], [12.4, -4.8, 0.7, 0.44], [12.3, 1.4, 0.42, 0.62],
      [10.7, 4.3, 0.46, 0.55], [8.3, 6.2, 0.52, 0.7], [5.3, 5.2, 0.66, 0.46],
      [2.4, 3.1, 0.48, 0.7], [-2.8, 2.4, 0.6, 0.48], [-5.2, 4.3, 0.5, 0.6],
      [-9.6, 5.8, 0.48, 0.55], [-12.9, 7.6, 0.62, 0.5], [-8.7, 9.5, 0.46, 0.66],
      [-4.5, 10.3, 0.54, 0.54], [1.3, 11.0, 0.42, 0.72], [6.8, 11.2, 0.58, 0.48],
      [11.8, 10.7, 0.5, 0.64], [14.0, 6.4, 0.48, 0.7],
    ] as const;
    rockPositions.forEach(([x, z, scale, rotation], index) => {
      const rock = CreateBox(`rubble-${index}`, { width: 0.7, height: 0.35, depth: 0.55 }, this.scene);
      rock.material = stoneMaterial;
      rock.position.set(x, 0.17, z);
      rock.scaling.set(scale, scale * (index % 3 === 0 ? 1.2 : 0.85), scale * 0.82);
      rock.rotation.y = rotation;
      this.registerRevealable(rock, rock.position, 0.78);
      staticMesh(rock);
    });

    const grassMaterial = new StandardMaterial("dry-grass", this.scene);
    grassMaterial.diffuseColor = Color3.FromHexString("#6a5b3d");
    grassMaterial.emissiveColor = Color3.FromHexString("#17170f");
    const grassPositions = [[-14.4, -9.5], [-11.5, -5.9], [-8.2, -10.9], [-3.3, -10.4], [2.3, -9.8], [9.2, -9.6], [13.5, -8.8], [-14.0, 9.2], [-10.4, 11.4], [-6.1, 8.5], [4.2, 11.0], [9.8, 11.0], [14.2, 10.2], [14.3, 0.2]] as const;
    grassPositions.forEach(([x, z], index) => {
      for (let blade = 0; blade < 3; blade += 1) {
        const grass = CreateBox(`dry-grass-${index}-${blade}`, { width: 0.06, height: 0.55, depth: 0.06 }, this.scene);
        grass.material = grassMaterial;
        grass.position.set(x + (blade - 1) * 0.12, 0.26, z + (blade % 2) * 0.1);
        grass.rotation.z = (blade - 1) * 0.26;
        grass.rotation.y = blade * 0.9;
        this.registerRevealable(grass, grass.position, 0.62);
        staticMesh(grass);
      }
    });
    grassMaterial.freeze();
  }

  private buildMarkers(): Marker[] {
    const definitions = [
      { id: "mark-a", label: "Kuzey ölçeği", x: -6.0, z: -7.85 },
      { id: "mark-b", label: "Sessiz kayıt", x: 5.15, z: -1.75 },
      { id: "mark-c", label: "Son yankı", x: -1.25, z: 8.25 },
    ];
    return definitions.map((definition) => {
      const root = new TransformNode(definition.id, this.scene);
      root.position.set(definition.x, 0, definition.z);
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
      [plinth, ring, core, glyph].forEach((mesh) => this.registerRevealable(mesh, root.position, 1));
      return { id: definition.id, label: definition.label, point: root.position.clone(), root, coreMaterial, ringMaterial, complete: false };
    });
  }

  private buildGate(stoneMaterial: StandardMaterial) {
    const addGateMesh = (mesh: AbstractMesh, position: Vector3, persistent = false) => {
      mesh.material = stoneMaterial;
      if (persistent) this.registerPersistent(mesh, position, 1);
      else this.registerRevealable(mesh, position, 0.95);
      this.gateMeshes.push(mesh);
      staticMesh(mesh);
      return mesh;
    };
    const left = CreateBox("gate-left", { width: 0.72, height: 3.0, depth: 0.9 }, this.scene);
    left.position.set(12.35, 1.5, 8.4);
    addGateMesh(left, left.position);
    const right = left.clone("gate-right");
    right.position.x = 14.05;
    addGateMesh(right, right.position);
    const top = CreateBox("gate-top", { width: 2.42, height: 0.62, depth: 0.9 }, this.scene);
    top.position.set(13.2, 2.72, 8.4);
    addGateMesh(top, top.position);
    const lintel = CreateBox("gate-lintel", { width: 2.8, height: 0.18, depth: 1.12 }, this.scene);
    lintel.position.set(13.2, 0.18, 8.4);
    addGateMesh(lintel, lintel.position);

    const seal = CreatePlane("exit-seal", { size: 1.35 }, this.scene);
    seal.position.set(13.2, 1.55, 7.88);
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
    this.registerRevealable(seal, seal.position, 1);
    this.gateMeshes.push(seal);

    const copperMaterial = new StandardMaterial("gate-accent", this.scene);
    copperMaterial.diffuseColor = copper;
    copperMaterial.emissiveColor = Color3.FromHexString("#26150d");
    [0.72, 1.1].forEach((diameter, index) => {
      const ring = CreateTorus(`gate-ring-${index}`, { diameter, thickness: 0.055, tessellation: 32 }, this.scene);
      ring.position.set(13.2, 1.55, 7.83);
      ring.rotation.x = Math.PI / 2;
      ring.material = copperMaterial;
      this.registerRevealable(ring, ring.position, 1);
      this.gateMeshes.push(ring);
      staticMesh(ring);
    });
    [-0.82, 0.82].forEach((offset, index) => {
      const lamp = CreateCylinder(`gate-lamp-${index}`, { diameter: 0.16, height: 0.46, tessellation: 8 }, this.scene);
      lamp.material = copperMaterial;
      lamp.position.set(13.2 + offset, 0.7, 7.9);
      this.registerRevealable(lamp, lamp.position, 1);
      this.gateMeshes.push(lamp);
      staticMesh(lamp);
    });
    copperMaterial.freeze();
    this.gateSeal = sealMaterial;
  }

  registerDynamicReveal(mesh: AbstractMesh, position: Vector3, baseVisibility = 1) {
    return this.registerRevealable(mesh, position, baseVisibility);
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
      let reveal = entry.persistent ? 0.82 : 0;
      this.waves.forEach((wave) => {
        const distance = Math.hypot(entry.point.x - wave.origin.x, entry.point.z - wave.origin.z);
        const waveTime = wave.age - distance / WAVE_SPEED;
        if (waveTime < -0.12 || waveTime > REVEAL_TRAIL) return;
        const front = waveTime < 0.18 ? Math.max(0, (waveTime + 0.12) / 0.3) : 1;
        const trail = waveTime <= 0.18 ? 1 : Math.max(0, 1 - (waveTime - 0.18) / (REVEAL_TRAIL - 0.18));
        reveal = Math.max(reveal, front * trail * entry.baseVisibility);
      });
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
