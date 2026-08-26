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
import { generate3DEchoLayout, type Echo3DLayout } from "./proceduralLevel";
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
  private readonly routeMaterial: StandardMaterial;
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

  constructor(scene: Scene, seed = 618071, mastery = 0) {
    this.scene = scene;
    const floorMaterial = this.createMaterial("basalt-floor", "#111817", assets.floor, 8.5, 7.5);
    floorMaterial.alpha = 0.72;
    const floor = CreateGround("archive-floor", { width: 34, height: 30, subdivisions: 2 }, scene);
    floor.material = floorMaterial;
    floor.visibility = 0.36;
    staticMesh(floor);
    floorMaterial.freeze();

    this.stoneMaterial = this.createMaterial("archive-stone", "#181e1f", assets.archiveStone, 3.2, 1.5);
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

    this.grassMaterial = new StandardMaterial("dry-grass", scene);
    this.grassMaterial.diffuseColor = Color3.FromHexString("#6a5b3d");
    this.grassMaterial.emissiveColor = Color3.FromHexString("#17170f");

    this.copperMaterial = new StandardMaterial("gate-accent", scene);
    this.copperMaterial.diffuseColor = copper;
    this.copperMaterial.emissiveColor = Color3.FromHexString("#26150d");

    this.buildOuterPerimeter();
    this.buildLevel(seed, mastery);
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

  private buildOuterPerimeter() {
    const addWall = (name: string, x: number, z: number, width: number, depth: number, height = 1.18) => {
      const wall = CreateBox(name, { width, height, depth }, this.scene);
      wall.material = this.stoneMaterial;
      wall.position.set(x, height / 2, z);
      this.registerRevealable(wall, wall.position, 0.98);
      staticMesh(wall);
    };

    addWall("north-boundary", 0, -14.25, 32.5, 0.72, 1.18);
    addWall("south-boundary", 0, 14.25, 32.5, 0.72, 1.18);
    addWall("west-boundary", -16.25, 0, 0.72, 27.5, 1.18);
    addWall("east-boundary", 16.25, 0, 0.72, 27.5, 1.18);
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

    // Re-register outer perimeter walls
    this.scene.meshes.forEach((mesh) => {
      if (mesh.name.endsWith("-boundary")) {
        this.registerRevealable(mesh, mesh.position, 0.98);
      }
    });

    this.buildLevel(seed, mastery);
  }

  private buildLevel(seed: number, mastery: number) {
    const layout = generate3DEchoLayout(seed, mastery);

    this.startPoint.copyFrom(layout.startPoint);
    this.initialHeading.copyFrom(layout.initialHeading);
    this.exitPoint.copyFrom(layout.exitPoint);
    this.listenerPath = layout.listenerPath.map((p) => p.clone());

    // 1. Procedural Partitions
    layout.partitions.forEach(([x, z, width, depth, height], index) => {
      const wall = CreateBox(`room-partition-${index}`, { width, height, depth }, this.scene);
      wall.material = this.stoneMaterial;
      wall.position.set(x, height / 2, z);
      this.registerRevealable(wall, wall.position, 0.98);
      staticMesh(wall);
      this.dynamicMeshes.push(wall);
    });

    // 2. Procedural Columns
    layout.columns.forEach(([x, z, height, width], index) => {
      const column = CreateBox(`archive-column-${index}`, { width: 0.62, height: 1, depth: 0.62 }, this.scene);
      column.material = this.stoneMaterial;
      column.position.set(x, height / 2, z);
      column.scaling.set(width, height, width * (index % 3 === 0 ? 1.25 : 0.92));
      column.rotation.y = (index % 4) * 0.19;
      this.registerRevealable(column, column.position, 0.82);
      staticMesh(column);
      this.dynamicMeshes.push(column);
    });

    // 3. Procedural Walkable Slabs
    layout.route.forEach((position, index) => {
      const slab = CreateBox(`route-slab-${index}`, { width: 1.7, height: 0.12, depth: 1.7 }, this.scene);
      slab.material = this.routeMaterial;
      slab.position.set(position.x, 0.055, position.z);
      slab.scaling.set(position.scale[0], position.scale[1], position.scale[2]);
      slab.rotation.y = position.rotation;
      this.registerRevealable(slab, slab.position, 1);
      staticMesh(slab);
      this.dynamicMeshes.push(slab);

      const inlay = CreateTorus(`route-inlay-${index}`, { diameter: 1.08, thickness: 0.025, tessellation: 16 }, this.scene);
      inlay.position.set(position.x, 0.125, position.z);
      inlay.rotation.y = position.rotation;
      inlay.scaling.set(position.scale[0] * 0.82, 1, position.scale[2] * 0.82);
      inlay.material = this.routeMaterial;
      this.registerRevealable(inlay, inlay.position, 0.95);
      staticMesh(inlay);
      this.dynamicMeshes.push(inlay);
    });

    // 4. Procedural Rubble & Grass Props
    layout.rubble.forEach(([x, z, scale, rotation], index) => {
      const rock = CreateBox(`rubble-${index}`, { width: 0.7, height: 0.35, depth: 0.55 }, this.scene);
      rock.material = this.stoneMaterial;
      rock.position.set(x, 0.17, z);
      rock.scaling.set(scale, scale * (index % 3 === 0 ? 1.2 : 0.85), scale * 0.82);
      rock.rotation.y = rotation;
      this.registerRevealable(rock, rock.position, 0.78);
      staticMesh(rock);
      this.dynamicMeshes.push(rock);
    });

    layout.grass.forEach(([x, z], index) => {
      for (let blade = 0; blade < 3; blade += 1) {
        const grassMesh = CreateBox(`dry-grass-${index}-${blade}`, { width: 0.06, height: 0.55, depth: 0.06 }, this.scene);
        grassMesh.material = this.grassMaterial;
        grassMesh.position.set(x + (blade - 1) * 0.12, 0.26, z + (blade % 2) * 0.1);
        grassMesh.rotation.z = (blade - 1) * 0.26;
        grassMesh.rotation.y = blade * 0.9;
        this.registerRevealable(grassMesh, grassMesh.position, 0.62);
        staticMesh(grassMesh);
        this.dynamicMeshes.push(grassMesh);
      }
    });

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
