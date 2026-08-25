import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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
import { createInitialSnapshot, type GameEvent, type GameSnapshot } from "./types";

type PulseRing = { mesh: ReturnType<typeof CreateTorus>; material: StandardMaterial; age: number };

const startPoint = new Vector3(-12.0, 0, -10.2);
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
  private readonly pulses: PulseRing[];
  private readonly coarsePointer: boolean;
  private state: GameSnapshot = createInitialSnapshot();
  private listenerIndex = 0;
  private listenerWait = 0;
  private hudTicker = 0;
  private demoTime = 0;
  private demoTarget = 0;
  private readonly demoTargets: Vector3[];

  constructor(
    private readonly scene: Scene,
    canvas: HTMLCanvasElement,
    private readonly emit: (event: GameEvent) => void,
    private readonly isDemo: boolean,
  ) {
    this.coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.environment = new ArchiveEnvironment(scene);
    this.camera = new CameraController(scene);
    this.playerLamp = this.createPlayer();
    this.listener.position.copyFrom(this.environment.listenerPath[0]);
    this.listenerMaterial = this.createListener();
    this.pulses = this.createPulsePool();
    this.input = new InputManager(() => this.pulse());
    this.player.position.copyFrom(startPoint);
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
    const shadowRing = CreateTorus("traveler-foot-ring", { diameter: 0.78, thickness: 0.018, tessellation: 24 }, this.scene);
    shadowRing.parent = this.player;
    shadowRing.position.y = 0.025;
    shadowRing.rotation.x = Math.PI / 2;
    shadowRing.material = lampMaterial;
    return lampMaterial;
  }

  private createListener() {
    const material = new StandardMaterial("listener-material", this.scene);
    material.diffuseColor = Color3.FromHexString("#3b394a");
    material.emissiveColor = Color3.FromHexString("#1f1124");
    const body = CreateCylinder("listener-body", { diameterTop: 0.26, diameterBottom: 0.72, height: 1.35, tessellation: 6 }, this.scene);
    body.parent = this.listener;
    body.position.y = 0.68;
    body.material = material;
    this.environment.registerDynamicReveal(body, this.listener.position, 0.72);
    const shoulder = CreateTorus("listener-shoulder-ring", { diameter: 0.76, thickness: 0.05, tessellation: 20 }, this.scene);
    shoulder.parent = this.listener;
    shoulder.position.y = 0.72;
    shoulder.material = material;
    this.environment.registerDynamicReveal(shoulder, this.listener.position, 0.82);
    const eye = CreateSphere("listener-eye", { diameter: 0.14, segments: 6 }, this.scene);
    eye.parent = this.listener;
    eye.position.set(0, 0.9, -0.34);
    this.environment.registerDynamicReveal(eye, this.listener.position, 1);
    const eyeMaterial = new StandardMaterial("listener-eye-material", this.scene);
    eyeMaterial.diffuseColor = copperLamp;
    eyeMaterial.emissiveColor = copperLamp;
    eye.material = eyeMaterial;
    return material;
  }

  private createPulsePool() {
    return Array.from({ length: 3 }, (_, index) => {
      const mesh = CreateTorus(`echo-ring-${index}`, { diameter: 1.1 + index * 0.45, thickness: 0.045, tessellation: 24 }, this.scene);
      const material = new StandardMaterial(`echo-ring-material-${index}`, this.scene);
      material.diffuseColor = Color3.FromHexString("#70c6bd");
      material.emissiveColor = Color3.FromHexString("#70c6bd");
      material.alpha = 0;
      material.backFaceCulling = false;
      mesh.material = material;
      mesh.isPickable = false;
      return { mesh, material, age: 99 };
    });
  }

  setVirtualMove(x: number, z: number) {
    this.input.setVirtualMove(x, z);
  }

  pulse() {
    if (this.state.phase !== "explore") return;
    if (this.state.echoes <= 0) {
      this.emit({ type: "toast", message: "Yankı bütçesi bitti. Rotayı hatırla." });
      return;
    }
    this.state.echoes -= 1;
    this.state.noise = Math.min(32, this.state.noise + 2);
    this.environment.triggerPulse(this.player.position);
    this.spawnPulse();
    this.playerLamp.emissiveColor.copyFrom(copperLamp);
    this.emit({ type: "toast", message: "Yankı yayıldı — işaretleri izle." });
    this.emitState();
  }

  private spawnPulse() {
    this.pulses.forEach((pulse, index) => {
      pulse.age = -index * 0.1;
      pulse.mesh.position.copyFrom(this.player.position);
      pulse.mesh.position.y = 0.08 + index * 0.012;
      pulse.mesh.scaling.setAll(1);
      pulse.material.alpha = 0.82 - index * 0.12;
    });
  }

  update(delta: number) {
    this.environment.update(delta);
    this.updatePulses(delta);
    if (this.state.phase === "explore") {
      if (this.isDemo) this.updateDemo(delta);
      else this.updatePlayer(delta);
      this.updateListener(delta);
      this.checkObjectives();
    }
    const objective = this.getObjectivePoint();
    this.camera.update(this.player.position, this.heading, objective, delta);
    this.playerLamp.emissiveColor = Color3.Lerp(this.playerLamp.emissiveColor, calmLamp, Math.min(1, delta * 3.5));
    this.hudTicker += delta;
    if (this.hudTicker > 0.18) {
      this.hudTicker = 0;
      this.emitState();
    }
  }

  private updatePlayer(delta: number) {
    const move = this.input.getMove();
    const moving = Math.hypot(move.x, move.z) > 0.01;
    if (!moving) return;
    const speed = this.coarsePointer ? 3.75 : 4.45;
    const nextX = Math.max(-15.2, Math.min(15.2, this.player.position.x + move.x * speed * delta));
    const nextZ = Math.max(-13.2, Math.min(13.2, this.player.position.z + move.z * speed * delta));
    this.player.position.x = nextX;
    this.player.position.z = nextZ;
    this.heading.x += (move.x - this.heading.x) * Math.min(1, delta * 10);
    this.heading.z += (move.z - this.heading.z) * Math.min(1, delta * 10);
    this.player.rotation.y = Math.atan2(this.heading.x, this.heading.z);
    this.state.noise = Math.min(32, this.state.noise + delta * 0.46);
    if (this.state.noise >= 32) this.finish("failed", "Oda seni duydu. Daha az adım, daha doğru yankı.");
  }

  private updateDemo(delta: number) {
    this.demoTime += delta;
    if (this.demoTime < 0.85) return;
    const goal = this.demoTargets[this.demoTarget];
    if (!goal) return;
    const dx = goal.x - this.player.position.x;
    const dz = goal.z - this.player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.24) {
      this.demoTarget += 1;
      this.pulse();
      return;
    }
    const speed = 2.6;
    const x = dx / distance;
    const z = dz / distance;
    this.player.position.x += x * speed * delta;
    this.player.position.z += z * speed * delta;
    this.heading.x += (x - this.heading.x) * Math.min(1, delta * 7);
    this.heading.z += (z - this.heading.z) * Math.min(1, delta * 7);
    this.player.rotation.y = Math.atan2(this.heading.x, this.heading.z);
  }

  private updateListener(delta: number) {
    this.listenerWait += delta;
    const target = this.environment.listenerPath[(this.listenerIndex + 1) % this.environment.listenerPath.length];
    const dx = target.x - this.listener.position.x;
    const dz = target.z - this.listener.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) this.listenerIndex = (this.listenerIndex + 1) % this.environment.listenerPath.length;
    else {
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

  restart() {
    this.state = createInitialSnapshot();
    this.player.position.copyFrom(startPoint);
    this.player.rotation.set(0, 0, 0);
    this.heading.set(0.62, 0, 0.78);
    this.listener.position.copyFrom(this.environment.listenerPath[0]);
    this.listenerIndex = 0;
    this.demoTime = 0;
    this.demoTarget = 0;
    this.environment.reset();
    this.pulses.forEach((pulse) => {
      pulse.age = 99;
      pulse.material.alpha = 0;
    });
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
