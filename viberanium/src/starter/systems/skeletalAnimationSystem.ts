import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../../components/transform.ts';
import { type Renderable } from '../../components/renderable.ts';
import { sampleClipToNodes } from '../../components/animation.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type SkeletalRig } from '../components/skeletalRig.ts';
import { computeSkinPalette, snapshotPose, updateWorldFromLocals } from '../../assets/gltf/runtime.ts';
import { m4, m4Copy, m4Mul } from '../../math/mat4.ts';

export const installSkeletalAnimationSystem = (registry: Registry) => {
  const bindPoseCache = new WeakMap<SkeletalRig, ReturnType<typeof snapshotPose>>();
  const _meshWorld = m4();

  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.skeletalRig)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const rig = e.components[COMPONENT_KEYS.skeletalRig] as SkeletalRig | undefined;
      if (!t || !cc || !rig) continue;

      let bindPose = bindPoseCache.get(rig);
      if (!bindPose) {
        bindPose = snapshotPose(rig.bodyScene.nodes);
        bindPoseCache.set(rig, bindPose);
      }

      updateWorldMatrix(t);

      const renderRootWorld = m4Copy(m4(), t.world);
      renderRootWorld[13] += rig.visualYOffset;

      for (let i = 0; i < rig.bodyScene.nodes.length; i++) {
        rig.bodyScene.nodes[i].localT.set(bindPose.t[i]);
        rig.bodyScene.nodes[i].localS.set(bindPose.s[i]);
        rig.bodyScene.nodes[i].localR.set(bindPose.r[i]);
      }

      const vx = cc.velocity[0], vz = cc.velocity[2];
      const speed = Math.hypot(vx, vz);
      const moveW = speed > 0.05 ? Math.min(1, speed / Math.max(1e-6, cc.moveSpeed)) : 0;

      if (cc.jumpPhase === 'none' && cc.locomotionBlend < 1) {
        cc.locomotionBlend = Math.min(1, cc.locomotionBlend + ctx.dt * 5);
      }

      cc.locomotionAnimTime += ctx.dt;

      const jumpW = 1 - cc.locomotionBlend;
      const locoW = cc.locomotionBlend;
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

      sampleClipToNodes(clips.idle, bodyScene.nodes, cc.locomotionAnimTime, locoW);
      sampleClipToNodes(clips.run, bodyScene.nodes, cc.locomotionAnimTime * cc.moveAnimSpeed, locoW * moveW);

      updateWorldFromLocals(bodyScene.nodes);

      for (const re of registry.view(COMPONENT_KEYS.gltfNodeIndex)) {
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
    }
  }, 20);
};
