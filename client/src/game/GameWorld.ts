import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { ArchiveEnvironment, type Marker } from "./ArchiveEnvironment";
import { CameraController } from "./CameraController";
import { InputManager } from "./InputManager";
import { movementYaw, stepFacingYaw } from "./heading";
import { createInitialSnapshot, type GameEvent, type GameSnapshot } from "./types";
import { GameAudio } from "./audio";

type PulseRing = { mesh: ReturnType<typeof CreateTorus>; material: StandardMaterial; age: number };

const copperLamp = Color3.FromHexString("#e5b36a");
const calmLamp = Color3.FromHexString("#c9824a");

const ZONE_FOG: Record<0 | 1 | 2 | 3, Color3> = {
  0: Color3.FromHexString("#040f0e"), // çökük arşiv
  1: Color3.FromHexString("#0a140a"), // yosunlu avlu
  2: Color3.FromHexString("#050b16"), // su basmış mahzen
  3: Color3.FromHexString("#130c07"), // kemik kasa
};

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
  private gateHintCooldown = 0;
  private demoTime = 0;
  private demoHeading = new Vector3(1, 0, 0);
  private seed: number;
  private mastery: number;
  private readonly playerLight: PointLight;
  private currentFogTheme: 0 | 1 | 2 | 3 = 0;
  private readonly audio = new GameAudio();
  private moveClock = 0;

  constructor(
    private readonly scene: Scene,
    canvas: HTMLCanvasElement,
    private readonly emit: (event: GameEvent) => void,
    private readonly isDemo: boolean,
    seed = 618071,
    mastery = 0,
    private readonly shadowGenerator: ShadowGenerator | null = null,
  ) {
    this.seed = seed;
    this.mastery = mastery;
    this.coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.environment = new ArchiveEnvironment(scene, seed, mastery);
    this.camera = new CameraController(scene);
    this.playerLamp = this.createPlayer();
    this.playerLight = new PointLight("traveler-light", new Vector3(0, 1.3, 0), scene);
    this.playerLight.diffuse = copperLamp;
    this.playerLight.intensity = 0.55;
    this.playerLight.range = 6.5;
    this.listener.position.copyFrom(this.environment.listenerPath[0]);
    this.listenerMaterial = this.createListener();
    this.pulses = this.createPulsePool();
    this.input = new InputManager(() => this.pulse());
    this.player.position.copyFrom(this.environment.startPoint);
    this.facingYaw = movementYaw(this.environment.initialHeading.x, this.environment.initialHeading.z);
    this.player.rotation.y = this.facingYaw;
    this.heading.copyFrom(this.environment.initialHeading);
    this.demoHeading.copyFrom(this.environment.initialHeading);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    if (this.isDemo) {
      this.environment.triggerPulse(this.player.position);
      this.spawnPulse();
    }
    this.emit({ type: "state", snapshot: this.state });
    this.emit({ type: "ready" });
  }

  private createPlayer() {
    const skinMaterial = new StandardMaterial("traveler-skin", this.scene);
    skinMaterial.diffuseColor = Color3.FromHexString("#f0dfc4");
    skinMaterial.emissiveColor = Color3.FromHexString("#3a3122");
    skinMaterial.specularColor = Color3.Black();
    const cloakMaterial = new StandardMaterial("traveler-cloak", this.scene);
    cloakMaterial.diffuseColor = Color3.FromHexString("#3a6362");
    cloakMaterial.emissiveColor = Color3.FromHexString("#0e1c1b");
    cloakMaterial.specularColor = Color3.Black();
    const eyeMaterial = new StandardMaterial("traveler-eyes", this.scene);
    eyeMaterial.diffuseColor = Color3.FromHexString("#1b2a29");
    eyeMaterial.emissiveColor = Color3.FromHexString("#70c6bd");
    eyeMaterial.specularColor = Color3.Black();
    const lampMaterial = new StandardMaterial("traveler-lamp", this.scene);
    lampMaterial.diffuseColor = copperLamp;
    lampMaterial.emissiveColor = calmLamp;

    // A small round-headed, hooded traveler — friendlier silhouette than a plain capsule.
    const robe = CreateCylinder("traveler-robe", { diameterTop: 0.32, diameterBottom: 0.64, height: 0.76, tessellation: 12 }, this.scene);
    robe.parent = this.player;
    robe.position.y = 0.4;
    robe.material = cloakMaterial;

    const head = CreateSphere("traveler-head", { diameter: 0.44, segments: 14 }, this.scene);
    head.parent = this.player;
    head.position.y = 0.98;
    head.material = skinMaterial;

    const hood = CreateCylinder("traveler-hood", { diameterTop: 0.12, diameterBottom: 0.5, height: 0.3, tessellation: 12 }, this.scene);
    hood.parent = this.player;
    hood.position.set(0, 1.16, -0.06);
    hood.rotation.x = -0.2;
    hood.material = cloakMaterial;

    [-0.09, 0.09].forEach((offset, index) => {
      const eye = CreateSphere(`traveler-eye-${index}`, { diameter: 0.055, segments: 8 }, this.scene);
      eye.parent = this.player;
      eye.position.set(offset, 0.97, 0.195);
      eye.material = eyeMaterial;
    });

    const lamp = CreateSphere("traveler-lamp", { diameter: 0.19, segments: 10 }, this.scene);
    lamp.parent = this.player;
    lamp.position.set(0, 1.08, 0.34);
    lamp.material = lampMaterial;
    const lampHandle = CreateBox("traveler-lamp-handle", { width: 0.05, height: 0.16, depth: 0.05 }, this.scene);
    lampHandle.parent = this.player;
    lampHandle.position.set(0, 0.86, 0.32);
    lampHandle.material = lampMaterial;
    const shadowRing = CreateTorus("traveler-foot-ring", { diameter: 0.7, thickness: 0.018, tessellation: 24 }, this.scene);
    shadowRing.parent = this.player;
    shadowRing.position.y = 0.025;
    shadowRing.rotation.x = Math.PI / 2;
    shadowRing.material = lampMaterial;
    this.shadowGenerator?.addShadowCaster(robe);
    this.shadowGenerator?.addShadowCaster(head);
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
    this.audio.unlock();
    this.state.echoes -= 1;
    this.environment.triggerPulse(this.player.position);
    this.spawnPulse();
    this.audio.playPulse();
    this.emitState();
  }

  setSound(on: boolean) {
    this.audio.setMuted(!on);
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
    this.updateAmbiance(delta);
    if (this.gateHintCooldown > 0) this.gateHintCooldown -= delta;
    this.camera.update(this.player.position, this.heading, this.getObjectivePoint(), delta);
    this.hudTicker += delta;
    if (this.hudTicker >= 0.25) {
      this.hudTicker = 0;
      this.emitState();
    }
  }

  private updateDemo(delta: number) {
    this.demoTime += delta;
    const speed = 2.2;
    const resolved = this.environment.resolveMove(
      this.player.position.x,
      this.player.position.z,
      this.demoHeading.x * speed * delta,
      this.demoHeading.z * speed * delta,
      0.34,
    );
    const moved = Math.hypot(resolved.x - this.player.position.x, resolved.z - this.player.position.z) > 0.0005;
    if (moved) {
      this.player.position.x = resolved.x;
      this.player.position.z = resolved.z;
    } else {
      const cardinals = [
        { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
      ].sort(() => Math.random() - 0.5);
      for (const dir of cardinals) {
        const probe = this.environment.resolveMove(this.player.position.x, this.player.position.z, dir.x * 0.4, dir.z * 0.4, 0.34);
        if (Math.hypot(probe.x - this.player.position.x, probe.z - this.player.position.z) > 0.0005) {
          this.demoHeading.set(dir.x, 0, dir.z);
          break;
        }
      }
    }
    this.heading.copyFrom(this.demoHeading);
    this.facingYaw = stepFacingYaw(this.facingYaw, this.demoHeading.x, this.demoHeading.z, delta, 9.5);
    this.player.rotation.y = this.facingYaw;
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
      this.audio.unlock();
      this.moveClock += delta;
      this.audio.playFootstep(this.moveClock);
      this.facingYaw = stepFacingYaw(this.facingYaw, move.x, move.z, delta, 11.0);
      this.player.rotation.y = this.facingYaw;
      this.heading.set(move.x, 0, move.z);
      const resolved = this.environment.resolveMove(
        this.player.position.x,
        this.player.position.z,
        move.x * speed * delta,
        move.z * speed * delta,
        0.34,
      );
      this.player.position.x = resolved.x;
      this.player.position.z = resolved.z;
      this.state.noise = Math.min(100, this.state.noise + delta * 2.1);
      this.playerLamp.emissiveColor.copyFrom(copperLamp.scale(0.85 + Math.sin(Date.now() * 0.008) * 0.15));
    } else {
      this.state.noise = Math.max(0, this.state.noise - delta * 4.8);
      this.playerLamp.emissiveColor.copyFrom(calmLamp);
    }
    this.checkObjectives();
  }

  private updateAmbiance(delta: number) {
    this.playerLight.position.set(this.player.position.x, 1.3, this.player.position.z);
    const flicker = 0.5 + Math.sin(Date.now() * 0.006) * 0.06;
    this.playerLight.intensity = flicker;

    const theme = this.environment.themeAt(this.player.position.x, this.player.position.z);
    if (theme !== this.currentFogTheme) this.currentFogTheme = theme;
    const target = ZONE_FOG[this.currentFogTheme];
    const lerp = Math.min(1, delta * 0.8);
    this.scene.fogColor = Color3.Lerp(this.scene.fogColor, target, lerp);
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
    if (!this.isDemo && this.distanceTo(this.listener.position) < 0.86) {
      this.audio.playCaught();
      this.finish("failed", "Dinleyici seni duydu. Siper al ve yankıyı daha erken kullan.");
    }
  }

  private checkObjectives() {
    this.environment.markers.filter((marker) => !marker.complete).forEach((marker) => {
      if (this.distanceTo(marker.point) < 1.1) this.collectMarker(marker);
    });
    if (this.state.doorOpen && this.distanceTo(this.environment.exitPoint) < 1.2) {
      this.finish("won", "Arşiv seni tanıdı. Çıkış yolu artık senin.");
    } else if (!this.state.doorOpen && this.gateHintCooldown <= 0 && this.distanceTo(this.environment.exitPoint) < 2.4) {
      // Reachable but revealed via a pulse: without this, the gate looks just like a
      // "hidden wall" that stubbornly won't open once you've echoed it.
      this.gateHintCooldown = 7;
      this.emit({ type: "toast", message: `Mühür kilitli — ${this.state.marks}/3 işaret bulmadan açılmaz.` });
    }
  }

  private collectMarker(marker: Marker) {
    this.environment.activateMarker(marker);
    this.audio.playMark();
    this.state.marks += 1;
    this.state.message = `${marker.label} kayda geçti.`;
    this.emit({ type: "toast", message: `${this.state.marks}/3 işaret etkin.` });
    if (this.state.marks === 3) {
      this.state.doorOpen = true;
      this.state.objective = "Açılan mühre ulaş";
      this.environment.setDoorOpen(true);
      this.audio.playGate();
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
    this.demoHeading.copyFrom(this.environment.initialHeading);
    this.demoTime = 0;
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
    this.audio.dispose();
    this.pulses.forEach((pulse) => {
      pulse.mesh.dispose();
      pulse.material.dispose();
    });
    this.pulses.length = 0;
  }
}
