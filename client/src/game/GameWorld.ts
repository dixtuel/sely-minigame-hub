import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateIcoSphere } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
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
  private readonly listenerShards: ReturnType<typeof CreateCylinder>[] = [];
  private listenerVortexOuter?: ReturnType<typeof CreateTorus>;
  private listenerVortexInner?: ReturnType<typeof CreateTorus>;
  private listenerCoreMesh?: ReturnType<typeof CreateIcoSphere>;
  private listenerShroudMesh?: ReturnType<typeof CreateCylinder>;
  private listenerClock = 0;
  private readonly heading = new Vector3(0.62, 0, 0.78);
  private facingYaw = movementYaw(0.62, 0.78);
  private readonly pulses: PulseRing[];

  private readonly coarsePointer: boolean;
  private state: GameSnapshot = createInitialSnapshot();
  private listenerIndex = 0;
  private listenerWait = 0;
  private listenerState: "patrol" | "investigate" = "patrol";
  private investigateTarget: Vector3 = new Vector3(0, 0, 0);
  private listenerFacingYaw = 0;
  private listenerInvestigateTimer = 0;
  private listenerPingTimer = 2.0;
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
    this.playerLight.intensity = 3.2;
    this.playerLight.range = 8.5;
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
      this.spawnPulse(this.player.position, false);
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
    const obsidian = new StandardMaterial("listener-obsidian", this.scene);
    obsidian.diffuseColor = Color3.FromHexString("#0d0914");
    obsidian.emissiveColor = Color3.FromHexString("#190620");
    obsidian.specularColor = Color3.FromHexString("#441126");

    const eyeMaterial = new StandardMaterial("listener-eye", this.scene);
    eyeMaterial.diffuseColor = Color3.FromHexString("#ff1133");
    eyeMaterial.emissiveColor = Color3.FromHexString("#ff002b");
    eyeMaterial.specularColor = Color3.White();

    // 1. Shroud / Phantom Torso (Tapered, faceted obsidian body hovering above ground)
    const shroud = CreateCylinder(
      "listener-shroud",
      { height: 1.52, diameterTop: 0.22, diameterBottom: 0.86, tessellation: 8 },
      this.scene,
    );
    shroud.parent = this.listener;
    shroud.position.y = 0.86;
    shroud.material = obsidian;
    this.listenerShroudMesh = shroud;

    // 2. Pulsing Resonator Heart / Eye of Agony (Icosahedron faceted ruby crystal)
    const core = CreateIcoSphere(
      "listener-core",
      { radius: 0.29, subdivisions: 2 },
      this.scene,
    );
    core.parent = this.listener;
    core.position.y = 1.2;
    core.material = eyeMaterial;
    this.listenerCoreMesh = core;

    // 3. Floating Acoustic Shards / Resonance Horns (Levitating obelisks forming a sinister crown)
    const shards: ReturnType<typeof CreateCylinder>[] = [];
    const shardAngles = [0.42, -0.42, 1.88, -1.88];
    shardAngles.forEach((ang, idx) => {
      const shard = CreateCylinder(
        `listener-shard-${idx}`,
        { height: 0.68, diameterTop: 0.015, diameterBottom: 0.08, tessellation: 5 },
        this.scene,
      );
      shard.parent = this.listener;
      shard.material = obsidian;
      const rad = 0.44;
      shard.position.set(Math.cos(ang) * rad, 1.66, Math.sin(ang) * rad);
      shard.rotation.z = Math.cos(ang) * 0.35;
      shard.rotation.x = Math.sin(ang) * 0.35;
      shards.push(shard);
    });
    this.listenerShards.push(...shards);

    // 4. Acoustic Rib Spines / Sensor Claws (3 pairs of menacing rib tendrils)
    const ribs: ReturnType<typeof CreateBox>[] = [];
    for (let r = 0; r < 3; r++) {
      const ribY = 0.68 + r * 0.25;
      const ribLeft = CreateBox(`listener-rib-l-${r}`, { width: 0.42, height: 0.038, depth: 0.07 }, this.scene);
      ribLeft.parent = this.listener;
      ribLeft.position.set(-0.3, ribY, 0.04);
      ribLeft.rotation.z = 0.3;
      ribLeft.rotation.y = 0.22;
      ribLeft.material = obsidian;

      const ribRight = CreateBox(`listener-rib-r-${r}`, { width: 0.42, height: 0.038, depth: 0.07 }, this.scene);
      ribRight.parent = this.listener;
      ribRight.position.set(0.3, ribY, 0.04);
      ribRight.rotation.z = -0.3;
      ribRight.rotation.y = -0.22;
      ribRight.material = obsidian;
      ribs.push(ribLeft, ribRight);
    }

    // 5. Swirling Abyssal Ground Void (Dual-layer shadow vortex at feet)
    const vortexOuter = CreateTorus("listener-vortex-outer", { diameter: 1.8, thickness: 0.042, tessellation: 32 }, this.scene);
    vortexOuter.parent = this.listener;
    vortexOuter.position.y = 0.035;
    vortexOuter.material = obsidian;
    this.listenerVortexOuter = vortexOuter;

    const vortexInner = CreateTorus("listener-vortex-inner", { diameter: 1.2, thickness: 0.038, tessellation: 24 }, this.scene);
    vortexInner.parent = this.listener;
    vortexInner.position.y = 0.045;
    vortexInner.material = eyeMaterial;
    this.listenerVortexInner = vortexInner;

    // Register all components with dynamic reveal so echo pulses illuminate the whole creature
    const allMeshes: (AbstractMesh | ReturnType<typeof CreateCylinder> | ReturnType<typeof CreateBox> | ReturnType<typeof CreateTorus>)[] = [
      shroud,
      core,
      ...shards,
      ...ribs,
      vortexOuter,
      vortexInner,
    ];

    allMeshes.forEach((mesh) => {
      this.environment.registerDynamicReveal(
        mesh,
        () => this.listener.position,
        1,
        {
          proximityRadius: 3.8,
          proximityCap: 0.85,
          apply: (reveal) => {
            const glow = Math.max(0.12, reveal);
            mesh.visibility = glow;
            eyeMaterial.emissiveColor = Color3.FromHexString("#ff002b").scale(glow * 1.6);
            obsidian.emissiveColor = Color3.FromHexString("#220810").scale(glow * 0.9);
          },
        },
      );
    });

    return eyeMaterial;
  }

  private createPulsePool(): PulseRing[] {
    const rings: PulseRing[] = [];
    // 4 player pulses (indices 0-3) + 4 enemy acoustic shockwave ripples (indices 4-7)
    for (let index = 0; index < 8; index += 1) {
      const isEnemyRing = index >= 4;
      const isHarmonicSecondary = index >= 6;
      const material = new StandardMaterial(`pulse-ring-${index}`, this.scene);
      material.diffuseColor = isEnemyRing
        ? (isHarmonicSecondary ? Color3.FromHexString("#ff0055") : Color3.FromHexString("#ff1122"))
        : Color3.FromHexString("#c9824a");
      material.emissiveColor = isEnemyRing
        ? (isHarmonicSecondary ? Color3.FromHexString("#ff2277") : Color3.FromHexString("#ff0033"))
        : Color3.FromHexString("#f0c38d");
      material.alpha = 0;
      material.backFaceCulling = false;
      const mesh = CreateTorus(
        `pulse-mesh-${index}`,
        {
          diameter: isEnemyRing ? (isHarmonicSecondary ? 1.3 : 1.9) : 1.6,
          thickness: isEnemyRing ? 0.058 : 0.045,
          tessellation: 32,
        },
        this.scene,
      );
      mesh.position.y = isHarmonicSecondary ? 0.09 : 0.08;
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
    this.spawnPulse(this.player.position, false);
    this.audio.playPulse();

    // Acoustic hearing AI: The listener senses strong acoustic pulses within 16 meters!
    const distToListener = this.distanceTo(this.listener.position);
    if (distToListener < 16.0) {
      this.listenerState = "investigate";
      this.investigateTarget.copyFrom(this.player.position);
      this.listenerInvestigateTimer = 6.0; // Investigate for 6 seconds
      this.emit({ type: "toast", message: "Yankı bir şeyin dikkatini çekti!" });
    }

    this.emitState();
  }

  setSound(on: boolean) {
    this.audio.setMuted(!on);
  }

  private spawnPulse(pos: Vector3, isEnemy = false) {
    if (isEnemy) {
      // Dual-frequency acoustic shockwave: primary sharp wave + trailing harmonic resonance ring
      const primaryRings = this.pulses.slice(4, 6);
      const harmonicRings = this.pulses.slice(6, 8);

      const r1 = primaryRings.find((item) => item.age > 2.2) || primaryRings[0];
      r1.age = 0;
      r1.mesh.position.copyFrom(pos);
      r1.mesh.position.y = 0.08;
      r1.mesh.scaling.setAll(1);
      r1.material.alpha = 0.9;

      const r2 = harmonicRings.find((item) => item.age > 2.2) || harmonicRings[0];
      r2.age = -0.12; // slight phase lag for multi-frequency echo effect
      r2.mesh.position.copyFrom(pos);
      r2.mesh.position.y = 0.09;
      r2.mesh.scaling.setAll(0.7);
      r2.material.alpha = 0.7;
    } else {
      const playerRings = this.pulses.slice(0, 4);
      const ring = playerRings.find((item) => item.age > 3.0) || playerRings[0];
      ring.age = 0;
      ring.mesh.position.copyFrom(pos);
      ring.mesh.position.y = 0.08;
      ring.mesh.scaling.setAll(1);
      ring.material.alpha = 0.78;
    }
  }


  update(delta: number) {
    this.environment.update(delta, this.player.position.x, this.player.position.z);
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
      this.spawnPulse(this.player.position, false);
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
    const flicker = 3.2 + Math.sin(Date.now() * 0.006) * 0.25;
    this.playerLight.intensity = flicker;

    const theme = this.environment.themeAt(this.player.position.x, this.player.position.z);
    if (theme !== this.currentFogTheme) this.currentFogTheme = theme;
    const target = ZONE_FOG[this.currentFogTheme];
    const lerp = Math.min(1, delta * 0.8);
    this.scene.fogColor = Color3.Lerp(this.scene.fogColor, target, lerp);
  }

  private updateListener(delta: number) {
    if (this.state.phase !== "explore") return;
    const isInvestigating = this.listenerState === "investigate";

    // 1. Emit terrifying dual-frequency red acoustic warning shockwave:
    // When investigating: every 2.8s. During normal patrol: every 5.2s (calibrated for atmosphere and tension, not spamming)
    const pingInterval = isInvestigating ? 2.8 : 5.2;
    this.listenerPingTimer += delta;
    if (this.listenerPingTimer >= pingInterval) {
      this.listenerPingTimer = 0;
      this.spawnPulse(this.listener.position, true);
    }

    // 2. Noise detection: running or loud actions alert the listener from afar
    if (this.state.noise > 65 && this.distanceTo(this.listener.position) < 12.0) {
      if (this.listenerState !== "investigate") {
        this.listenerState = "investigate";
        this.emit({ type: "toast", message: "Dinleyici adımlarını duydu!" });
      }
      this.investigateTarget.copyFrom(this.player.position);
      this.listenerInvestigateTimer = 5.5;
    }

    const route = this.environment.listenerPath;
    if (!route.length) return;

    if (this.listenerState === "investigate") {
      this.listenerInvestigateTimer -= delta;
      const dx = this.investigateTarget.x - this.listener.position.x;
      const dz = this.investigateTarget.z - this.listener.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance < 0.6 || this.listenerInvestigateTimer <= 0) {
        // Investigation target reached or timer expired; resume normal patrol
        this.listenerState = "patrol";
        // Seamlessly rejoin the nearest waypoint on the connected patrol route
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < route.length; i++) {
          const d = Math.hypot(route[i].x - this.listener.position.x, route[i].z - this.listener.position.z);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        this.listenerIndex = bestIdx;
      } else {
        const pace = 1.75; // Faster investigation pace
        const stepX = (dx / distance) * pace * delta;
        const stepZ = (dz / distance) * pace * delta;
        const resolved = this.environment.resolveMove(this.listener.position.x, this.listener.position.z, stepX, stepZ, 0.38);
        this.listener.position.x = resolved.x;
        this.listener.position.z = resolved.z;
        this.listenerFacingYaw = stepFacingYaw(this.listenerFacingYaw, dx, dz, delta, 9.0);
        this.listener.rotation.y = this.listenerFacingYaw;
      }
    } else {
      // Normal continuous patrol along connected maze corridor waypoints
      const current = route[this.listenerIndex];
      const dx = current.x - this.listener.position.x;
      const dz = current.z - this.listener.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.42) {
        // Advanced to next cell in corridor patrol loop
        this.listenerIndex = (this.listenerIndex + 1) % route.length;
      } else {
        const pace = 1.15; // Smooth patrolling pace through corridors
        const stepX = (dx / distance) * pace * delta;
        const stepZ = (dz / distance) * pace * delta;
        const resolved = this.environment.resolveMove(this.listener.position.x, this.listener.position.z, stepX, stepZ, 0.38);
        const moved = Math.hypot(resolved.x - this.listener.position.x, resolved.z - this.listener.position.z) > 0.0001;
        this.listener.position.x = resolved.x;
        this.listener.position.z = resolved.z;
        this.listenerFacingYaw = stepFacingYaw(this.listenerFacingYaw, dx, dz, delta, 7.5);
        this.listener.rotation.y = this.listenerFacingYaw;

        // If unexpectedly held up on a sharp corner edge for more than 0.8s, advance to next waypoint
        if (!moved) {
          this.listenerWait += delta;
          if (this.listenerWait > 0.8) {
            this.listenerWait = 0;
            this.listenerIndex = (this.listenerIndex + 1) % route.length;
          }
        } else {
          this.listenerWait = 0;
        }
      }
    }

    // 3. Dynamic animation of the menacing 3D creature
    this.listenerClock += delta;
    const hoverOffset = Math.sin(this.listenerClock * 2.8) * 0.08;
    if (this.listenerCoreMesh) this.listenerCoreMesh.position.y = 1.2 + hoverOffset;
    if (this.listenerShroudMesh) this.listenerShroudMesh.position.y = 0.86 + hoverOffset * 0.6;
    if (this.listenerVortexOuter) this.listenerVortexOuter.rotation.y += delta * (isInvestigating ? 1.8 : 0.8);
    if (this.listenerVortexInner) this.listenerVortexInner.rotation.y -= delta * (isInvestigating ? 2.5 : 1.2);

    this.listenerShards.forEach((shard, idx) => {
      shard.position.y = 1.66 + hoverOffset + Math.sin(this.listenerClock * 3.4 + idx * 1.2) * 0.05;
      shard.rotation.y += delta * (idx % 2 === 0 ? 0.7 : -0.7);
      const flare = isInvestigating ? 1.22 : 1.0;
      shard.scaling.set(flare, flare, flare);
    });

    const pulseIntensity = isInvestigating ? 2.2 : 0.9;
    const pulseSpeed = isInvestigating ? 12.0 : 4.5;
    this.listenerMaterial.emissiveColor.copyFrom(
      Color3.FromHexString(isInvestigating ? "#ff0044" : "#ff1122").scale(
        pulseIntensity + Math.sin(this.listenerClock * pulseSpeed) * 0.35,
      ),
    );

    if (!this.isDemo && this.distanceTo(this.listener.position) < 0.86) {
      this.audio.playCaught();
      this.finish("failed", "Dinleyici seni yakaladı. Siper al ve yankıyı daha erken kullan.");
    }
  }

  private checkObjectives() {
    // 1. Check acoustic floor traps
    const triggeredTrap = this.environment.checkTrap(this.player.position.x, this.player.position.z);
    if (triggeredTrap) {
      this.state.noise = 100;
      this.environment.triggerPulse(triggeredTrap.point);
      this.spawnPulse(triggeredTrap.point, true);
      this.audio.playTrap();
      this.listenerState = "investigate";
      this.investigateTarget.copyFrom(triggeredTrap.point);
      this.listenerInvestigateTimer = 7.0;
      this.emit({ type: "toast", message: "Tuzak tetiklendi! Dinleyici sese koşuyor!" });
    }

    // 2. Check markers
    this.environment.markers.filter((marker) => !marker.complete).forEach((marker) => {
      if (this.distanceTo(marker.point) < 1.1) this.collectMarker(marker);
    });

    // 3. Check exit gate
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
    this.pulses.forEach((pulse, index) => {
      pulse.age += delta;
      if (pulse.age < 0) return;
      const isEnemy = index >= 4;
      if (isEnemy) {
        // Fast, menacing acoustic shockwave that sweeps across corridors
        const growth = 1 + Math.pow(pulse.age, 0.85) * 8.6;
        pulse.mesh.scaling.set(growth, growth, growth);
        pulse.material.alpha = Math.max(0, 0.88 - pulse.age * 0.42);
      } else {
        const growth = 1 + pulse.age * 5.4;
        pulse.mesh.scaling.set(growth, growth, growth);
        pulse.material.alpha = Math.max(0, 0.78 - pulse.age * 0.33);
      }
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
    this.listenerState = "patrol";
    this.listenerInvestigateTimer = 0;
    this.listenerPingTimer = 0;
    this.demoHeading.copyFrom(this.environment.initialHeading);
    this.demoTime = 0;
    this.pulses.forEach((pulse) => {
      pulse.age = 99;
      pulse.material.alpha = 0;
    });
    if (this.isDemo) {
      this.environment.triggerPulse(this.player.position);
      this.spawnPulse(this.player.position, false);
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
