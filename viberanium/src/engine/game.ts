import { type Registry, useRegistry } from './registry.ts';
import { type Scene } from './scene.ts';

export type Game = {
  readonly registry: Registry;
  setActiveScene: (scene: Scene | null) => void;
  start: () => void;
  stop: () => void;
};

export const useGame = (): Game => {
  const gameRegistry = useRegistry();
  let activeScene: Scene | null = null;
  let raf = 0;
  let last = performance.now();
  let simTime = 0;
  let running = false;

  const runPhase = (name: string, ctx: { dt: number; time: number }) => {
    for (const fn of gameRegistry.getActionsByName(name)) fn(ctx);
    if (activeScene) {
      for (const fn of activeScene.registry.getActionsByName(name)) fn(ctx);
    }
  };

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    simTime += dt;

    const ctx = { dt, time: simTime };
    runPhase('update', ctx);
    runPhase('draw', ctx);
    runPhase('commit', ctx);

    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    simTime = 0;
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const setActiveScene = (scene: Scene | null) => {
    if (activeScene && activeScene !== scene) activeScene.unload();
    activeScene = scene;
  };

  return { registry: gameRegistry, setActiveScene, start, stop };
};
