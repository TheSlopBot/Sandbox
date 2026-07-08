import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { sampleClipToNodes } from '../components/animation.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type SkeletalRig } from '../components/skeletalRig.ts';
import { computeSkinPalette, snapshotPose, updateWorldFromLocals } from '../assets/gltf/runtime.ts';
import { m4, m4Copy, m4Mul } from '../math/mat4.ts';
import { type Vec3 } from '../math/vec3.ts';

const LOD_SKIP_START_DIST = 0;
const LOD_FREEZE_DIST = 80;
const SHADOW_DIST = 28;

export type SkeletalAnimationOptions = {
  getLodOrigin?: () => Vec3;
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const skipChanceForDist = (dist: number) => {
  if (dist <= LOD_SKIP_START_DIST) return 0;
  if (dist >= LOD_FREEZE_DIST) return 1;
  return (dist - LOD_SKIP_START_DIST) / (LOD_FREEZE_DIST - LOD_SKIP_START_DIST);
};

const setRigCastShadow = (registry: Registry, rig: SkeletalRig, castShadow: boolean) => {
  const ids = [...rig.renderEntityIds];
  for (const attachment of rig.attachments) ids.push(...attachment.renderEntityIds);

  for (const renderId of ids) {
    const re = registry.get(renderId);
    if (!re) continue;
    const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
    if (r) r.castShadow = castShadow;
  }
};

const updateRigAttachments = (
  registry: Registry,
  rig: SkeletalRig,
  renderRootWorld: Float32Array,
  bodyScene: SkeletalRig['bodyScene'],
  attachBoneWorld: Float32Array,
  attachRootWorld: Float32Array,
) => {
  for (const attachment of rig.attachments) {
    const boneWorld = bodyScene.nodes[attachment.boneNodeIndex]?.worldM;
    if (!boneWorld) continue;

    m4Mul(attachBoneWorld, renderRootWorld, boneWorld);
    m4Mul(attachRootWorld, attachBoneWorld, attachment.localOffset);

    for (const renderId of attachment.renderEntityIds) {
      const re = registry.get(renderId);
      if (!re) continue;

      const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
      const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
      if (!r?.model) continue;

      m4Mul(r.model as Float32Array, attachRootWorld, attachment.scene.nodes[nodeIndex]!.worldM);
    }
  }
};

export const installSkeletalAnimationSystem = (
  registry: Registry,
  options: SkeletalAnimationOptions = {},
) => {
  const bindPoseCache = new WeakMap<SkeletalRig, ReturnType<typeof snapshotPose>>();
  const renderRootByRig = new WeakMap<SkeletalRig, Float32Array>();
  const _meshWorld = m4();
  const _attachBoneWorld = m4();
  const _attachRootWorld = m4();
  const getLodOrigin = options.getLodOrigin;

  return registry.addAction('update', (ctx) => {
    const origin = getLodOrigin?.();
    const ox = origin ? origin[0] : 0;
    const oz = origin ? origin[2] : 0;
    const shadowDist2 = SHADOW_DIST * SHADOW_DIST;

    for (const e of registry.view(COMPONENT_KEYS.skeletalRig)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const rig = e.components[COMPONENT_KEYS.skeletalRig] as SkeletalRig | undefined;
      if (!t || !cc || !rig) continue;

      updateWorldMatrix(t);

      const d2 = origin ? distSqXZ(t.position[0], t.position[2], ox, oz) : 0;
      const dist = origin ? Math.sqrt(d2) : 0;
      const castShadow = !origin || d2 <= shadowDist2;
      setRigCastShadow(registry, rig, castShadow);

      if (cc.jumpPhase === 'none' && cc.movementBlend < 1) {
        cc.movementBlend = Math.min(1, cc.movementBlend + ctx.dt * 5);
      }
      cc.movementAnimTime += ctx.dt;

      let renderRootWorld = renderRootByRig.get(rig);
      if (!renderRootWorld) {
        renderRootWorld = m4();
        renderRootByRig.set(rig, renderRootWorld);
      }
      m4Copy(renderRootWorld, t.world);
      renderRootWorld[13] += rig.visualYOffset;

      const skipChance = origin ? skipChanceForDist(dist) : 0;
      if (skipChance > 0 && (skipChance >= 1 || Math.random() < skipChance)) {
        for (const renderId of rig.renderEntityIds) {
          const re = registry.get(renderId);
          if (!re) continue;
          const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
          const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
          if (!r?.model) continue;
          m4Mul(r.model as Float32Array, renderRootWorld, rig.bodyScene.nodes[nodeIndex]!.worldM);
        }

        updateRigAttachments(
          registry,
          rig,
          renderRootWorld,
          rig.bodyScene,
          _attachBoneWorld,
          _attachRootWorld,
        );
        continue;
      }

      let bindPose = bindPoseCache.get(rig);
      if (!bindPose) {
        bindPose = snapshotPose(rig.bodyScene.nodes);
        bindPoseCache.set(rig, bindPose);
      }

      for (let i = 0; i < rig.bodyScene.nodes.length; i++) {
        rig.bodyScene.nodes[i].localT.set(bindPose.t[i]);
        rig.bodyScene.nodes[i].localS.set(bindPose.s[i]);
        rig.bodyScene.nodes[i].localR.set(bindPose.r[i]);
      }

      const vx = cc.velocity[0], vz = cc.velocity[2];
      const speed = Math.hypot(vx, vz);
      const moveW = speed > 0.05 ? Math.min(1, speed / Math.max(1e-6, cc.moveSpeed)) : 0;

      const jumpW = 1 - cc.movementBlend;
      const movementW = cc.movementBlend;
      const { clips, bodyScene } = rig;

      if (jumpW > 0) {
        let jumpClip = clips.jumpIdle;
        let jumpTime = cc.jumpClipTime;
        let jumpLoop = true;

        if (cc.jumpPhase === 'start') { jumpClip = clips.jumpStart; jumpLoop = false; }
        else if (cc.jumpPhase === 'land') { jumpClip = clips.jumpLand; jumpLoop = false; }
        else if (cc.jumpPhase === 'none') { jumpClip = clips.jumpLand; jumpTime = clips.jumpLand.duration; jumpLoop = false; }

        sampleClipToNodes(jumpClip, bodyScene.nodes, jumpTime, jumpW, jumpLoop);
      }

      sampleClipToNodes(clips.idle, bodyScene.nodes, cc.movementAnimTime, movementW);
      if (moveW > 0.01) {
        sampleClipToNodes(clips.run, bodyScene.nodes, cc.movementAnimTime * cc.moveAnimSpeed, movementW * moveW);
      }

      updateWorldFromLocals(bodyScene.nodes);

      for (const renderId of rig.renderEntityIds) {
        const re = registry.get(renderId);
        if (!re) continue;
        const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
        const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
        if (!r?.model) continue;
        m4Mul(r.model as Float32Array, renderRootWorld, bodyScene.nodes[nodeIndex]!.worldM);
      }

      for (const part of rig.characterParts) {
        const si = part.skinInst;
        m4Mul(_meshWorld, renderRootWorld, bodyScene.nodes[si.rootNodeIndex]!.worldM);
        computeSkinPalette(bodyScene.nodes, si.skin, si.palette, renderRootWorld, _meshWorld);
      }

      updateRigAttachments(
        registry,
        rig,
        renderRootWorld,
        bodyScene,
        _attachBoneWorld,
        _attachRootWorld,
      );
    }
  }, 20);
};
