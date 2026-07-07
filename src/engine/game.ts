import { type Registry } from './registry.ts';

export type Game = {
  start: () => void;
  stop: () => void;
};

export function useGame(registry: Registry): Game {
  let raf = 0;
  let last = performance.now();
  let running = false;

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    const ctx = { dt, time: now / 1000 };
    for (const fn of registry.getActionsByName('update')) fn(ctx);
    for (const fn of registry.getActionsByName('draw')) fn(ctx);
    for (const fn of registry.getActionsByName('commit')) fn(ctx);

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  return { start, stop };
}

