import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Scene } from "@babylonjs/core/scene";
import { GameWorld } from "./GameWorld";
import type { GameEvent, GameHandle } from "./types";

export async function createGameScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  onEvent: (event: GameEvent) => void,
  demo = false,
): Promise<GameHandle> {
  const scene = new Scene(engine);
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  scene.clearColor = new Color4(0.006, 0.012, 0.013, 1);
  scene.ambientColor = Color3.FromHexString("#070d0d");
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = coarsePointer ? 0.038 : 0.031;
  scene.fogColor = Color3.FromHexString("#030707");
  scene.skipPointerMovePicking = true;
  scene.constantlyUpdateMeshUnderPointer = false;

  const skyLight = new HemisphericLight("archive-sky-light", new Vector3(0, 1, 0), scene);
  skyLight.diffuse = Color3.FromHexString("#8ba5a0");
  skyLight.groundColor = Color3.FromHexString("#121313");
  skyLight.intensity = coarsePointer ? 0.86 : 1.0;

  const sun = new DirectionalLight("archive-sun", new Vector3(-0.4, -1, -0.5), scene);
  sun.diffuse = Color3.FromHexString("#e6b176");
  sun.intensity = coarsePointer ? 1.05 : 1.28;

  const world = new GameWorld(scene, canvas, onEvent, demo);
  const observer = scene.onBeforeRenderObservable.add(() => {
    world.update(Math.min(0.05, scene.getEngine().getDeltaTime() / 1000));
  });

  return {
    scene,
    setVirtualMove: (x, z) => world.setVirtualMove(x, z),
    pulse: () => world.pulse(),
    restart: () => world.restart(),
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      world.dispose();
      scene.dispose();
    },
  };
}
