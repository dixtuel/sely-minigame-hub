import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { ArchiveEnvironment, type Marker } from "./ArchiveEnvironment";
import { CameraController } from "./CameraController";
import { InputManager } from "./InputManager";
import { movementYaw, stepFacingYaw } from "./heading";
import { createInitialSnapshot, type GameEvent, type GameSnapshot } from "./types";

type PulseRing = { mesh: ReturnType<typeof CreateTorus>; material: StandardMaterial; age: number };

const copperLamp = Color3.FromHexString("#e5b36a");
const calmLamp = Color3.FromHexString("#c9824a");

export class GameWorld {
  private readonly environment: ArchiveEnvironment;
  private readonly camera: CameraController;
  private readonly input: InputManager;
  private readonly player = new TransformNode("traveler-root", this.scene);
  private readonly playerLamp: StandardMaterial;
  private readonly listener = new TransformNode("listener-root", this.scene);
  private readonly listenerMaterial: StandardMaterial;
  private readonly heading = new Vector3(0.62, 0, 0.78);
  private facingYaw = movementYaw(0.62, 0.78);
  private readonly pulses: PulseRing[];
  private readonly coarsePointer: boolean;
  private state: GameSnapshot = createInitialSnapshot();
  private listenerIndex = 0;
  private listenerWait = 0;
  private hudTicker = 0;
  private demoTime = 0;
  private demoTarget = 0;
  private demoTargets: Vector3[];
  private seed: number;
  private mastery: number;

  constructor(
    private readonly scene: Scene,
    canvas: HTMLCanvasElement,
    private readonly emit: (event: GameEvent) => void,
    private readonly isDemo: boolean,
    seed = 618071,
    mastery = 0,
  ) {
    this.seed = seed;
    this.mastery = mastery;
    this.coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.environment = new ArchiveEnvironment(scene, seed, mastery);
    this.camera = new CameraController(scene);
    this.playerLamp = this.createPlayer();
    this.listener.position.copyFrom(this.environment.listenerPath[0]);
    this.listenerMaterial = this.createListener();
    this.pulses = this.createPulsePool();
    this.input = new InputManager(() => this.pulse());
    this.player.position.copyFrom(this.environment.startPoint);
    this.facingYaw = movementYaw(this.environment.initialHeading.x, this.environment.initialHeading.z);
    this.player.rotation.y = this.facingYaw;
    this.heading.copyFrom(this.environment.initialHeading);
    this.demoTargets = [...this.environment.markers.map((marker) => marker.point), this.environment.exitPoint];
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    if (this.isDemo) {
      this.environment.triggerPulse(this.player.position);
      this.spawnPulse();
    }
    this.emit({ type: "state", snapshot: this.state });
    this.emit({ type: "ready" });
  }

  private createPlayer() {
    const bodyMaterial = new StandardMaterial("traveler-linen", this.scene);
    bodyMaterial.diffuseColor = Color3.FromHexString("#e3d7bf");
    bodyMaterial.emissiveColor = Color3.FromHexString("#30291f");
    bodyMaterial.specularColor = Color3.Black();
    const cloakMaterial = new StandardMaterial("traveler-cloak", this.scene);
    cloakMaterial.diffuseColor = Color3.FromHexString("#315050");
    cloakMaterial.specularColor = Color3.Black();
    const lampMaterial = new StandardMaterial("traveler-lamp", this.scene);
    lampMaterial.diffuseColor = copperLamp;
    lampMaterial.emissiveColor = calmLamp;
    const body = CreateCapsule("traveler-body", { radius: 0.25, height: 1.12, tessellation: 8 }, this.scene);
    body.parent = this.player;
    body.position.y = 0.74;
    body.material = bodyMaterial;
    const cloak = CreateCylinder("traveler-cloak", { diameterTop: 0.34, diameterBottom: 0.72, height: 0.64, tessellation: 6 }, this.scene);
    cloak.parent = this.player;
    cloak.position.y = 0.37;
    cloak.material = cloakMaterial;
    const lamp = CreateSphere("traveler-lamp", { diameter: 0.18, segments: 8 }, this.scene);
    lamp.parent = this.player;
    lamp.position.set(0, 1.24, 0.35);
    lamp.material = lampMaterial;
    const frontPlate = CreateBox("traveler-front-plate", { width: 0.2, height: 0.18, depth: 0.1 }, this.scene);
    frontPlate.parent = this.player;
    frontPlate.position.set(0, 0.82, 0.34);
    frontPlate.material = lampMaterial;
    const shadowRing = CreateTorus("traveler-foot-ring", { diameter: 0.78, thickness: 0.018, tessellation: 24 }, this.scene);
    shadowRing.parent = this.player;
    shadowRing.position.y = 0.025;
    shadowRing.rotation.x = Math.PI / 2;
    shadowRing.material = lampMaterial;
    return lampMaterial;
  }

  private createListener() {
    const material = new StandardMaterial("listener-glass", this.scene);
    material.diffuseColor = Color3.FromHexString("#100c14");
    material.emissiveColor = Color3.FromHexString("#1b1022");
    material.specularColor = Color3.Black();
    const eye = CreateSphere("listener-core", { diameter: 0.62, segments: 8 }, this.scene);
    eye.parent = this.listener;
    eye.position.y = 1.0;
    eye.material = material;
    const ring = CreateTorus("listener-ring", { diameter: 1.02, thickness: 0.045, tessellation: 24 }, this.scene);
    ring.parent = this.listener;
    ring.position.y = 1.0;
    ring.rotation.x = Math.PI / 3;
    ring.material = material;
    const aura = CreateTorus("listener-aura", { diameter: 1.4, thickness: 0.025, tessellation: 24 }, this.scene);
    aura.parent = this.listener;
    aura.position.y = 0.05;
    aura.rotation.x = Math.PI / 2;
    aura.material = material;
    [eye, ring, aura].forEach((mesh) => this.environment.registerDynamicReveal(mesh, this.listener.position, 1));
    return material;
  }

  private createPulsePool(): PulseRing[] {
    const rings: PulseRing[] = [];
    for (let index = 0; index < 4; index += 1) {
      const material = new StandardMaterial(`pulse-ring-${index}`, this.scene);
      material.diffuseColor = Color3.FromHexString("#c9824a");
      material.emissiveColor = Color3.FromHexString("#f0c38d");
      material.alpha = 0;
      material.backFaceCulling = false;
      const mesh = CreateTorus(`pulse-mesh-${index}`, { diameter: 1.6, thickness: 0.045, tessellation: 24 }, this.scene);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 0.08;
      mesh.material = material;
      mesh.isPickable = false;
      rings.push({ mesh, material, age: 99 });
    }
    return rings;
  }

  setVirtualMove(x: number, z: number) {
    this.input.setVirtualMove(x, z);
  }

  pulse() {
    if (this.state.phase !== "explore" || this.state.echoes <= 0) return;
    this.state.echoes -= 1;
    this.environment.triggerPulse(this.player.position);
    this.spawnPulse();
    this.emitState();
  }

  private spawnPulse() {
    const ring = this.pulses.find((item) => item.age > 3.0) || this.pulses[0];
    ring.age = 0;
    ring.mesh.position.copyFrom(this.player.position);
    ring.mesh.position.y = 0.08;
    ring.mesh.scaling.setAll(1);
    ring.material.alpha = 0.78;
  }

  update(delta: number) {
    this.environment.update(delta);
    this.updatePulses(delta);
    if (this.isDemo) this.updateDemo(delta);
    else this.updatePlayer(delta);
    this.updateListener(delta);
    this.camera.update(this.player.position, this.heading, this.getObjectivePoint(), delta);
    this.hudTicker += delta;
    if (this.hudTicker >= 0.25) {
      this.hudTicker = 0;
      this.emitState();
    }
  }

  private updateDemo(delta: number) {
    this.demoTime += delta;
    const target = this.demoTargets[this.demoTarget] || this.environment.exitPoint;
    const dx = target.x - this.player.position.x;
    const dz = target.z - this.player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.8) {
      this.demoTarget = (this.demoTarget + 1) % this.demoTargets.length;
      return;
    }
    const moveX = dx / distance;
    const moveZ = dz / distance;
    this.facingYaw = stepFacingYaw(this.facingYaw, moveX, moveZ, delta, 9.5);
    this.player.rotation.y = this.facingYaw;
    this.heading.set(moveX, 0, moveZ);
    this.player.position.x += moveX * 2.2 * delta;
    this.player.position.z += moveZ * 2.2 * delta;
    if (Math.sin(this.demoTime * 1.8) > 0.94) {
      this.environment.triggerPulse(this.player.position);
      this.spawnPulse();
    }
  }

  private updatePlayer(delta: number) {
    if (this.state.phase !== "explore") return;
    const move = this.input.getMove();
    const active = move.x !== 0 || move.z !== 0;
    const speed = 3.65;
    if (active) {
      this.facingYaw = stepFacingYaw(this.facingYaw, move.x, move.z, delta, 11.0);
      this.player.rotation.y = this.facingYaw;
      this.heading.set(move.x, 0, move.z);
      const nextX = Math.max(-15.4, Math.min(15.4, this.player.position.x + move.x * speed * delta));
      const nextZ = Math.max(-13.4, Math.min(13.4, this.player.position.z + move.z * speed * delta));
      this.player.position.x = nextX;
      this.player.position.z = nextZ;
      this.state.noise = Math.min(100, this.state.noise + delta * 2.1);
      this.playerLamp.emissiveColor.copyFrom(copperLamp.scale(0.85 + Math.sin(Date.now() * 0.008) * 0.15));
    } else {
      this.state.noise = Math.max(0, this.state.noise - delta * 4.8);
      this.playerLamp.emissiveColor.copyFrom(calmLamp);
    }
    this.checkObjectives();
  }

  private updateListener(delta: number) {
    const route = this.environment.listenerPath;
    if (!route.length) return;
    const current = route[this.listenerIndex];
    const dx = current.x - this.listener.position.x;
    const dz = current.z - this.listener.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.35) {
      this.listenerWait += delta;
      if (this.listenerWait >= 1.6) {
        this.listenerWait = 0;
        this.listenerIndex = (this.listenerIndex + 1) % route.length;
      }
    } else {
      const pace = 1.05;
      this.listener.position.x += (dx / distance) * pace * delta;
      this.listener.position.z += (dz / distance) * pace * delta;
      this.listener.rotation.y = Math.atan2(dx, dz);
    }
    this.listenerMaterial.emissiveColor.copyFrom(Color3.FromHexString("#1f1124").scale(0.8 + Math.sin(this.listenerWait * 3) * 0.12));
    if (!this.isDemo && this.distanceTo(this.listener.position) < 0.86) this.finish("failed", "Dinleyici seni duydu. Siper al ve yankıyı daha erken kullan.");
  }

  private checkObjectives() {
    this.environment.markers.filter((marker) => !marker.complete).forEach((marker) => {
      if (this.distanceTo(marker.point) < 1.1) this.collectMarker(marker);
    });
    if (this.state.doorOpen && this.distanceTo(this.environment.exitPoint) < 1.2) this.finish("won", "Arşiv seni tanıdı. Çıkış yolu artık senin.");
  }

  private collectMarker(marker: Marker) {
    this.environment.activateMarker(marker);
    this.state.marks += 1;
    this.state.message = `${marker.label} kayda geçti.`;
    this.emit({ type: "toast", message: `${this.state.marks}/3 işaret etkin.` });
    if (this.state.marks === 3) {
      this.state.doorOpen = true;
      this.state.objective = "Açılan mühre ulaş";
      this.environment.setDoorOpen(true);
      this.emit({ type: "toast", message: "Mühür açıldı. Çıkış ışığını takip et." });
    } else {
      this.state.objective = `Sonraki işareti bul · ${this.state.marks}/3`;
    }
    this.emitState();
  }

  private getObjectivePoint() {
    const next = this.environment.markers.find((marker) => !marker.complete)?.point;
    return next ?? this.environment.exitPoint;
  }

  private distanceTo(point: Vector3) {
    return Math.hypot(this.player.position.x - point.x, this.player.position.z - point.z);
  }

  private updatePulses(delta: number) {
    this.pulses.forEach((pulse) => {
      pulse.age += delta;
      if (pulse.age < 0) return;
      const growth = 1 + pulse.age * 5.4;
      pulse.mesh.scaling.set(growth, growth, growth);
      pulse.material.alpha = Math.max(0, 0.78 - pulse.age * 0.33);
    });
  }

  private finish(phase: "won" | "failed", message: string) {
    if (this.state.phase !== "explore") return;
    this.state.phase = phase;
    this.state.message = message;
    this.state.objective = phase === "won" ? "Tur tamamlandı" : "Rota kesildi";
    this.emitState();
  }

  restart(seed?: number, mastery?: number) {
    if (seed !== undefined) {
      this.seed = seed;
      if (mastery !== undefined) this.mastery = mastery;
      this.environment.rebuild(this.seed, this.mastery);
    } else {
      this.environment.reset();
    }

    this.state = createInitialSnapshot();
    this.player.position.copyFrom(this.environment.startPoint);
    this.facingYaw = movementYaw(this.environment.initialHeading.x, this.environment.initialHeading.z);
    this.player.rotation.y = this.facingYaw;
    this.heading.copyFrom(this.environment.initialHeading);
    this.listener.position.copyFrom(this.environment.listenerPath[0]);
    this.listenerIndex = 0;
    this.listenerWait = 0;
    this.demoTargets = [...this.environment.markers.map((marker) => marker.point), this.environment.exitPoint];
    this.demoTime = 0;
    this.demoTarget = 0;
    this.pulses.forEach((pulse) => {
      pulse.age = 99;
      pulse.material.alpha = 0;
    });
    if (this.isDemo) {
      this.environment.triggerPulse(this.player.position);
      this.spawnPulse();
    }
    this.emitState();
  }

  private emitState() {
    this.emit({ type: "state", snapshot: { ...this.state, noise: Math.round(this.state.noise) } });
  }

  dispose() {
    this.input.dispose();
    this.pulses.forEach((pulse) => {
      pulse.mesh.dispose();
      pulse.material.dispose();
    });
    this.pulses.length = 0;
  }
}
