import { type Registry } from '../../engine/registry.ts';
import { type Entity } from '../../engine/entity.ts';
import { type Transform, updateWorldMatrix } from '../../components/transform.ts';
import { type Renderable } from '../../components/renderable.ts';
import { type SkinInstance } from '../../components/skin.ts';
import { type AnimClip, sampleClipToNodes } from '../../components/animation.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type RuntimeScene, computeSkinPalette, snapshotPose, updateWorldFromLocals } from '../../assets/gltf/runtime.ts';
import { m4, m4Copy, m4Mul } from '../../math/mat4.ts';

export type AnimClips = {
  idle: AnimClip;
  run: AnimClip;
  jumpStart: AnimClip;
  jumpIdle: AnimClip;
  jumpLand: AnimClip;
};

export type CharacterPart = {
  skinInst: SkinInstance;
  renderEntityIds: number[];
};

export const installAnimationSystem = (
  registry: Registry,
  characterEntity: Entity,
  charT: Transform,
  bodyScene: RuntimeScene,
  characterParts: CharacterPart[],
  clips: AnimClips,
) => {
  const bindPose = snapshotPose(bodyScene.nodes);
  const _meshWorld = m4();

  registry.addAction('update', (ctx) => {
    updateWorldMatrix(charT);

    const visualYOffset = -0.55;
    const renderRootWorld = m4Copy(m4(), charT.world);
    renderRootWorld[13] += visualYOffset;

    for (let i = 0; i < bodyScene.nodes.length; i++) {
      bodyScene.nodes[i].localT.set(bindPose.t[i]);
      bodyScene.nodes[i].localS.set(bindPose.s[i]);
      bodyScene.nodes[i].localR.set(bindPose.r[i]);
    }

    const cc = characterEntity.components['character'] as CharacterController;
    const vx = cc.velocity[0], vz = cc.velocity[2];
    const speed = Math.hypot(vx, vz);
    const moveW = speed > 0.05 ? Math.min(1, speed / Math.max(1e-6, cc.moveSpeed)) : 0;

    if (cc.jumpPhase === 'none' && cc.locomotionBlend < 1) {
      cc.locomotionBlend = Math.min(1, cc.locomotionBlend + ctx.dt * 5);
    }

    cc.locomotionAnimTime += ctx.dt;

    const jumpW = 1 - cc.locomotionBlend;
    const locoW = cc.locomotionBlend;

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

    for (const e of registry.view('gltfNodeIndex')) {
      const r = e.components['renderable'] as Renderable | undefined;
      const nodeIndex = e.components['gltfNodeIndex'] as number;
      if (!r?.model) continue;
      m4Mul(r.model as Float32Array, renderRootWorld, bodyScene.nodes[nodeIndex]!.worldM);
    }

    for (const part of characterParts) {
      const si = part.skinInst;
      m4Mul(_meshWorld, renderRootWorld, bodyScene.nodes[si.rootNodeIndex]!.worldM);
      computeSkinPalette(bodyScene.nodes, si.skin, si.palette, renderRootWorld, _meshWorld);
    }
  }, 20);
};
