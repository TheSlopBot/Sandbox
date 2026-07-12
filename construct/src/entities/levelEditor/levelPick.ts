import { type Registry, type RenderPipeline, type Transform, COMPONENT_KEYS } from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructLevelPlacement } from './levelPlacement.ts';

const PICK_RADIUS_PX = 28;

export const pickNearestLevelInstance = (
  registry: Registry,
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): string | null => {
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return null;

  const vp = pipeline.camera.viewProj;
  let bestId: string | null = null;
  let bestDist = PICK_RADIUS_PX;

  for (const e of registry.view(CONSTRUCT_KEYS.levelPlacement)) {
    const placement = e.components[CONSTRUCT_KEYS.levelPlacement] as ConstructLevelPlacement | undefined;
    const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!placement || !t) continue;

    const wx = t.world[12]!;
    const wy = t.world[13]!;
    const wz = t.world[14]!;
    const clipX = vp[0]! * wx + vp[4]! * wy + vp[8]! * wz + vp[12]!;
    const clipY = vp[1]! * wx + vp[5]! * wy + vp[9]! * wz + vp[13]!;
    const clipW = vp[3]! * wx + vp[7]! * wy + vp[11]! * wz + vp[15]!;
    if (clipW <= 0) continue;

    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    const sx = ((ndcX + 1) / 2) * width;
    const sy = ((1 - ndcY) / 2) * height;

    const dist = Math.hypot(sx - px, sy - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = placement.instanceId;
    }
  }

  return bestId;
};
