import {
  type Registry,
  type Material,
  type Transform,
  type SkeletalModel,
  type Mat4,
  type Quat,
  m4FromTRSQuat,
  q4,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructSkeletonOverlay } from './skeletonOverlay.ts';
import { type ConstructActorSelection } from './actorSelection.ts';

const WHITE: [number, number, number, number] = [1, 1, 1, 0.95];
const RED: [number, number, number, number] = [1, 0.2, 0.2, 0.95];

const translationFromMat4 = (out: ReturnType<typeof v3>, m: Mat4) => {
  out[0] = m[12]!;
  out[1] = m[13]!;
  out[2] = m[14]!;
  return out;
};

const quatFromYToDir = (out: Quat, dx: number, dy: number, dz: number) => {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-8) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
  }

  const x = dx / len;
  const y = dy / len;
  const z = dz / len;
  const dot = y;

  if (dot > 0.999999) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
  }

  if (dot < -0.999999) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    return out;
  }

  const cx = 1 * z - 0 * y;
  const cy = 0 * x - 0 * z;
  const cz = 0 * y - 1 * x;
  const w = 1 + dot;
  const inv = 1 / Math.hypot(cx, cy, cz, w);
  out[0] = cx * inv;
  out[1] = cy * inv;
  out[2] = cz * inv;
  out[3] = w * inv;
  return out;
};

const setColor = (material: Material, selected: boolean) => {
  const c = selected ? RED : WHITE;
  material.baseColorFactor[0] = c[0];
  material.baseColorFactor[1] = c[1];
  material.baseColorFactor[2] = c[2];
  material.baseColorFactor[3] = c[3];
};

export const installSkeletonOverlaySystem = (registry: Registry) =>
  registry.addAction(
    'update',
    () => {
      const characterEnt = registry.view(CONSTRUCT_KEYS.actorCharacter)[0];
      const skeletal = characterEnt?.components[COMPONENT_KEYS.skeletalModel] as
        | SkeletalModel
        | undefined;
      if (!skeletal) return;

      const selEnt = registry.view(CONSTRUCT_KEYS.actorSelection)[0];
      const actorSel = selEnt?.components[CONSTRUCT_KEYS.actorSelection] as
        | ConstructActorSelection
        | undefined;
      const selectedBone =
        actorSel && actorSel.kind === 'bone' ? actorSel.boneName : null;

      const nodes = skeletal.bodyScene.nodes;
      const nameToWorld = new Map<string, Mat4>();

      for (const node of nodes) {
        if (node.name) nameToWorld.set(node.name, node.worldM);
      }

      const _pos = v3();
      const _rot = q4();
      const _scale = v3(1, 1, 1);

      for (const e of registry.view(CONSTRUCT_KEYS.skeletonOverlay)) {
        const overlay = e.components[CONSTRUCT_KEYS.skeletonOverlay] as
          | ConstructSkeletonOverlay
          | undefined;
        const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
        const renderable = e.components[COMPONENT_KEYS.renderable] as
          | { material?: Material }
          | undefined;
        if (!overlay || !t || !renderable?.material) continue;

        const selected =
          selectedBone !== null &&
          (overlay.boneName === selectedBone ||
            (overlay.role === 'bone' &&
              (overlay.boneName === selectedBone ||
                overlay.parentBoneName === selectedBone)));

        if (overlay.role === 'joint') {
          const worldM = nameToWorld.get(overlay.boneName);
          if (!worldM) continue;

          translationFromMat4(_pos, worldM);
          t.position[0] = _pos[0];
          t.position[1] = _pos[1];
          t.position[2] = _pos[2];
          m4FromTRSQuat(t.world, _pos, q4(0, 0, 0, 1), _scale);
          t.dirty = false;
          setColor(renderable.material, selected);
          continue;
        }

        if (!overlay.parentBoneName) continue;

        const childM = nameToWorld.get(overlay.boneName);
        const parentM = nameToWorld.get(overlay.parentBoneName);
        if (!childM || !parentM) continue;

        const cx = childM[12]!;
        const cy = childM[13]!;
        const cz = childM[14]!;
        const px = parentM[12]!;
        const py = parentM[13]!;
        const pz = parentM[14]!;
        const dx = cx - px;
        const dy = cy - py;
        const dz = cz - pz;
        const dist = Math.hypot(dx, dy, dz);

        _pos[0] = (px + cx) * 0.5;
        _pos[1] = (py + cy) * 0.5;
        _pos[2] = (pz + cz) * 0.5;
        quatFromYToDir(_rot, dx, dy, dz);
        _scale[0] = 1;
        _scale[1] = Math.max(dist, 1e-4);
        _scale[2] = 1;
        t.position[0] = _pos[0];
        t.position[1] = _pos[1];
        t.position[2] = _pos[2];
        m4FromTRSQuat(t.world, _pos, _rot, _scale);
        t.dirty = false;
        setColor(renderable.material, selected);
      }
    },
    21,
  );
