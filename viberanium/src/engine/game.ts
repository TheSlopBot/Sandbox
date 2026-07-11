import { type Registry, useRegistry } from './registry.ts';
import { type Scene } from './scene.ts';

export type Game = {
  readonly registry: Registry;
  setActiveScene: (scene: Scene | null) => void;
  setSimFlush: (fn: (() => Promise<void>) | null) => void;
  setAfterUpdate: (fn: (() => void) | null) => void;
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
  let inFrame = false;
  let simFlush: (() => Promise<void>) | null = null;
  let afterUpdate: (() => void) | null = null;

  const runPhase = (name: string, ctx: { dt: number; time: number }) => {
    for (const fn of gameRegistry.getActionsByName(name)) fn(ctx);
    if (activeScene) {
      for (const fn of activeScene.registry.getActionsByName(name)) fn(ctx);
    }
  };

  const frame = async (now: number) => {
    if (!running || inFrame) return;
    inFrame = true;

    try {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      simTime += dt;

      const ctx = { dt, time: simTime };
      runPhase('update', ctx);
      afterUpdate?.();
      if (simFlush) await simFlush();
      runPhase('postUpdate', ctx);
      runPhase('draw', ctx);
      runPhase('commit', ctx);
    } finally {
      inFrame = false;
      if (running) raf = requestAnimationFrame(frame);
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    inFrame = false;
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

  return {
    registry: gameRegistry,
    setActiveScene,
    setSimFlush: (fn) => {
      simFlush = fn;
    },
    setAfterUpdate: (fn) => {
      afterUpdate = fn;
    },
    start,
    stop,
  };
};
