import { useRegistry } from '../engine/registry.ts';
import { useGame } from '../engine/game.ts';
import { createInput } from '../game/input.ts';
import { installRenderSystem } from '../game/systems/renderSystem.ts';
import { installCharacterSystem } from '../game/systems/characterSystem.ts';
import { installCameraSystem } from '../game/systems/cameraSystem.ts';
import { createInterleavedMesh } from '../render/gl/mesh.ts';
import { TextureCache } from '../render/gl/texture.ts';
import { loadGltf } from '../assets/gltf/loader.ts';
import { buildRuntimeModel } from '../assets/gltf/buildRuntime.ts';
import { buildRuntimeScene, computeSkinPalette, snapshotPose, updateWorldFromLocals } from '../assets/gltf/runtime.ts';
import { createTransform, updateWorldMatrix } from '../game/components/transform.ts';
import { type Material } from '../render/types.ts';
import { createCharacterController } from '../game/components/characterController.ts';
import { createCameraFollow } from '../game/components/cameraFollow.ts';
import { aabb, type Collider } from '../game/components/collider.ts';
import { createSkinnedMesh } from '../render/gl/mesh.ts';
import { createSkinInstance, type SkinInstance } from '../game/components/skin.ts';
import { buildRetargetedClips, sampleClipToNodes, type AnimClip } from '../game/components/animation.ts';
import { m4, m4Copy, m4Mul } from '../math/mat4.ts';

const KAYKIT = `${import.meta.env.BASE_URL}assets/kaykit`;
const CUBE_GLTF = `${KAYKIT}/prototype-bits/Cube_Prototype_Small.gltf`;
const CUBE_LARGE_B_GLTF = `${KAYKIT}/prototype-bits/Cube_Prototype_Large_B.gltf`;
const SPACE_RANGER_GLB = `${KAYKIT}/space-ranger/SpaceRanger.glb`;
const ANIM_GENERAL_GLB = `${KAYKIT}/animations/Rig_Medium_General.glb`;
const ANIM_MOVEMENT_GLB = `${KAYKIT}/animations/Rig_Medium_MovementBasic.glb`;

export async function bootstrap() {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) throw new Error('Missing #game canvas');

  const registry = useRegistry();
  const game = useGame(registry);
  const input = createInput(window, canvas);

  const render = installRenderSystem(registry, canvas, input);
  installCharacterSystem(registry, input);
  installCameraSystem(registry, render, input);

  registry.addAction(
    'commit',
    () => {
      input.commitFrame();
    },
    0,
  );

  const gl = render.device.gl;
  const textures = new TextureCache(gl);

  // Ground mesh (big quad)
  {
    const size = 60;
    const y = 0;
    const v = new Float32Array([
      // x,y,z nx,ny,nz u,v
      -size,
      y,
      -size,
      0,
      1,
      0,
      0,
      0,
      size,
      y,
      -size,
      0,
      1,
      0,
      1,
      0,
      size,
      y,
      size,
      0,
      1,
      0,
      1,
      1,
      -size,
      y,
      size,
      0,
      1,
      0,
      0,
      1,
    ]);
    const idx = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const mesh = createInterleavedMesh(gl, v, idx);
    const model = createTransform().world;
    render.setGround({ mesh, model });
  }

  async function instantiateGltf(
    gltfUrl: string,
    materialNamePrefix: string,
    opts?: { x?: number; y?: number; z?: number; scale?: number; yaw?: number },
  ) {
    function expandBoundsFromInterleaved(
      min: [number, number, number],
      max: [number, number, number],
      vertices: Float32Array,
    ) {
      // vertices are interleaved as: x,y,z nx,ny,nz u,v (stride=8)
      for (let i = 0; i < vertices.length; i += 8) {
        const x = vertices[i + 0]!;
        const y = vertices[i + 1]!;
        const z = vertices[i + 2]!;
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
    }

    function worldAabbFromLocal(
      localMin: [number, number, number],
      localMax: [number, number, number],
      pos: [number, number, number],
      scale: number,
      yaw: number,
    ) {
      // Rotate (yaw about Y), scale, then translate; compute conservative AABB by transforming 8 corners.
      const sx = scale;
      const sy = scale;
      const sz = scale;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);

      const corners: [number, number, number][] = [
        [localMin[0], localMin[1], localMin[2]],
        [localMin[0], localMin[1], localMax[2]],
        [localMin[0], localMax[1], localMin[2]],
        [localMin[0], localMax[1], localMax[2]],
        [localMax[0], localMin[1], localMin[2]],
        [localMax[0], localMin[1], localMax[2]],
        [localMax[0], localMax[1], localMin[2]],
        [localMax[0], localMax[1], localMax[2]],
      ];

      let wMinX = Number.POSITIVE_INFINITY;
      let wMinY = Number.POSITIVE_INFINITY;
      let wMinZ = Number.POSITIVE_INFINITY;
      let wMaxX = Number.NEGATIVE_INFINITY;
      let wMaxY = Number.NEGATIVE_INFINITY;
      let wMaxZ = Number.NEGATIVE_INFINITY;

      for (const [lx0, ly0, lz0] of corners) {
        const lx = lx0 * sx;
        const ly = ly0 * sy;
        const lz = lz0 * sz;

        // Must match `m4FromTRS` yaw convention:
        // x' = c*x + s*z
        // z' = -s*x + c*z
        const rx = lx * c + lz * s;
        const rz = -lx * s + lz * c;

        const wx = rx + pos[0];
        const wy = ly + pos[1];
        const wz = rz + pos[2];

        if (wx < wMinX) wMinX = wx;
        if (wy < wMinY) wMinY = wy;
        if (wz < wMinZ) wMinZ = wz;
        if (wx > wMaxX) wMaxX = wx;
        if (wy > wMaxY) wMaxY = wy;
        if (wz > wMaxZ) wMaxZ = wz;
      }

      return aabb(wMinX, wMinY, wMinZ, wMaxX, wMaxY, wMaxZ);
    }

    function worldObbFromLocal(
      localMin: [number, number, number],
      localMax: [number, number, number],
      pos: [number, number, number],
      scale: number,
      yaw: number,
    ) {
      // Build a yaw-only OBB in world space from local bounds.
      const cxL = (localMin[0] + localMax[0]) * 0.5;
      const cyL = (localMin[1] + localMax[1]) * 0.5;
      const czL = (localMin[2] + localMax[2]) * 0.5;
      const hx = (localMax[0] - localMin[0]) * 0.5 * scale;
      const hy = (localMax[1] - localMin[1]) * 0.5 * scale;
      const hz = (localMax[2] - localMin[2]) * 0.5 * scale;

      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const cxS = cxL * scale;
      const cyS = cyL * scale;
      const czS = czL * scale;

      // rotate center about Y then translate
      const rcx = cxS * c + czS * s;
      const rcz = -cxS * s + czS * c;

      return {
        center: new Float32Array([rcx + pos[0], cyS + pos[1], rcz + pos[2]]),
        halfExtents: new Float32Array([hx, hy, hz]),
        yaw,
      };
    }

    const loaded = await loadGltf(gltfUrl);
    const runtimeMeshes = buildRuntimeModel(loaded);

    // Map glTF materials to runtime materials
    const mats: Material[] = [];
    const gltfMats = loaded.gltf.materials ?? [];
    for (let i = 0; i < gltfMats.length; i++) {
      const gm = gltfMats[i];
      const pbr = gm.pbrMetallicRoughness;
      const baseFactor = pbr?.baseColorFactor ?? [1, 1, 1, 1];
      const texIndex = pbr?.baseColorTexture?.index;
      let baseTex: WebGLTexture | null = null;
      if (texIndex !== undefined && texIndex >= 0) {
        const tex = loaded.gltf.textures?.[texIndex];
        const src = tex?.source ?? -1;
        if (src >= 0 && loaded.images[src]) {
          baseTex = textures.getOrCreate(loaded.resolvedImageUris[src], loaded.images[src]);
        }
      }
      const alphaMode = (gm.alphaMode ?? 'OPAQUE') === 'BLEND' ? 'BLEND' : 'OPAQUE';
      mats.push({
        name: `${materialNamePrefix}_${gm.name ?? i}`,
        baseColorTex: baseTex,
        baseColorFactor: [baseFactor[0], baseFactor[1], baseFactor[2], baseFactor[3]],
        alphaMode,
      });
    }

    // If a file has no materials, create a default (and we'll still bind a texture if any image exists)
    if (mats.length === 0) {
      const fallbackTex = loaded.images[0] ? textures.getOrCreate(loaded.resolvedImageUris[0], loaded.images[0]) : null;
      mats.push({ name: `${materialNamePrefix}_default`, baseColorTex: fallbackTex, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' });
    }

    const t = createTransform();
    t.position[0] = opts?.x ?? 0;
    // If y isn't provided, we'll "snap" the model to sit on the ground once we know its bounds.
    t.position[1] = opts?.y ?? 0;
    t.position[2] = opts?.z ?? 0;
    const s = opts?.scale ?? 1;
    t.scale[0] = s;
    t.scale[1] = s;
    t.scale[2] = s;
    t.yaw = opts?.yaw ?? 0;
    t.dirty = true;

    // Compute a combined local-space AABB across all primitives, then create a world-space collider.
    const localMin: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const localMax: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (const rm of runtimeMeshes) {
      for (const prim of rm.primitives) {
        const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
        const material =
          prim.materialIndex >= 0 && prim.materialIndex < mats.length ? mats[prim.materialIndex] : mats[0];

        expandBoundsFromInterleaved(localMin, localMax, prim.vertices);

        const e = registry.create();
        e.components['transform'] = t;
        e.components['renderable'] = { mesh, material };
      }
    }

    if (Number.isFinite(localMin[0]) && Number.isFinite(localMax[0])) {
      // Snap-to-ground: place the model so its lowest point rests on y=0.
      // (Yaw doesn't affect Y; scale does.)
      if (opts?.y === undefined) {
        t.position[1] = -localMin[1] * s;
        t.dirty = true;
      }

      const obbY = worldObbFromLocal(localMin, localMax, [t.position[0], t.position[1], t.position[2]], s, t.yaw);
      const c: Collider = {
        aabb: worldAabbFromLocal(
          localMin,
          localMax,
          [t.position[0], t.position[1], t.position[2]],
          s,
          t.yaw,
        ),
        isStatic: true,
        obbY,
      };
      const ce = registry.create();
      ce.components['collider'] = c;
    }
  }

  // Environment platforms (Prototype Bits)
  // These particular filenames exist in your pack (verified via listing).
  // Only place 10 small prototype cubes in various rotations.
  const cube = CUBE_GLTF;
  await instantiateGltf(cube, 'proto', { x: -7.5, z: -2.0, scale: 1, yaw: 0 });
  await instantiateGltf(cube, 'proto', { x: -4.2, z: -8.0, scale: 1, yaw: Math.PI / 6 });
  await instantiateGltf(cube, 'proto', { x: -1.0, z: -4.5, scale: 1, yaw: Math.PI / 3 });
  await instantiateGltf(cube, 'proto', { x: 2.8, z: -9.5, scale: 1, yaw: Math.PI / 2 });
  await instantiateGltf(cube, 'proto', { x: 6.7, z: -5.8, scale: 1, yaw: (2 * Math.PI) / 3 });

  await instantiateGltf(cube, 'proto', { x: 8.5, z: 1.2, scale: 1, yaw: (5 * Math.PI) / 6 });
  await instantiateGltf(cube, 'proto', { x: 3.3, z: 4.8, scale: 1, yaw: Math.PI });
  await instantiateGltf(cube, 'proto', { x: -2.6, z: 6.4, scale: 1, yaw: (7 * Math.PI) / 6 });
  await instantiateGltf(cube, 'proto', { x: -6.8, z: 3.0, scale: 1, yaw: (4 * Math.PI) / 3 });
  await instantiateGltf(cube, 'proto', { x: 5.8, z: -1.0, scale: 1, yaw: (3 * Math.PI) / 2 });

  // Large cubes on the outer ring of the small-cube cluster (just beyond the furthest small cubes).
  const largeCube = CUBE_LARGE_B_GLTF;
  await instantiateGltf(largeCube, 'proto_large', { x: 5.5, z: -13.5, scale: 1, yaw: Math.PI / 7 });
  await instantiateGltf(largeCube, 'proto_large', { x: 14.0, z: 4.5, scale: 1, yaw: -Math.PI / 5 }); // east/north perimeter, clear of (8.5, 1.2)
  await instantiateGltf(largeCube, 'proto_large', { x: -11.5, z: 7.0, scale: 1, yaw: -Math.PI / 3 }); // northwest perimeter, opposite south/east pair

  // Space Ranger parts (we'll place them together as the "character")
  const characterEntity = registry.create();
  const charT = createTransform();
  // Visual/physics root height. 1.6 keeps the rig above ground without floating.
  charT.position[1] = 1.6;
  characterEntity.components['transform'] = charT;
  characterEntity.components['character'] = createCharacterController();
  characterEntity.components['cameraFollow'] = createCameraFollow();

  function buildMaterials(loaded: Awaited<ReturnType<typeof loadGltf>>, prefix: string): Material[] {
    const mats: Material[] = [];
    const gltfMats = loaded.gltf.materials ?? [];
    for (let i = 0; i < gltfMats.length; i++) {
      const gm = gltfMats[i];
      const pbr = gm.pbrMetallicRoughness;
      const baseFactor = pbr?.baseColorFactor ?? [1, 1, 1, 1];
      const texIndex = pbr?.baseColorTexture?.index;
      let baseTex: WebGLTexture | null = null;
      if (texIndex !== undefined && texIndex >= 0) {
        const tex = loaded.gltf.textures?.[texIndex];
        const src = tex?.source ?? -1;
        if (src >= 0 && loaded.images[src]) {
          baseTex = textures.getOrCreate(loaded.resolvedImageUris[src], loaded.images[src]);
        }
      }
      mats.push({
        name: `${prefix}_${gm.name ?? i}`,
        baseColorTex: baseTex,
        baseColorFactor: [baseFactor[0], baseFactor[1], baseFactor[2], baseFactor[3]],
        alphaMode: (gm.alphaMode ?? 'OPAQUE') === 'BLEND' ? 'BLEND' : 'OPAQUE',
      });
    }
    if (mats.length === 0) {
      const fallbackTex = loaded.images[0] ? textures.getOrCreate(loaded.resolvedImageUris[0], loaded.images[0]) : null;
      mats.push({ name: `${prefix}_default`, baseColorTex: fallbackTex, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' });
    }
    return mats;
  }

  // Load Space Ranger body scene (skinned)
  const bodyLoaded = await loadGltf(SPACE_RANGER_GLB);
  const bodyScene = buildRuntimeScene(bodyLoaded);
  const bindPose = snapshotPose(bodyScene.nodes);

  // Load animation clips and retarget by node name
  const idleAnimLoaded = await loadGltf(ANIM_GENERAL_GLB);
  const moveAnimLoaded = await loadGltf(ANIM_MOVEMENT_GLB);
  const idleClips = buildRetargetedClips(idleAnimLoaded, bodyScene.nodes);
  const moveClips = buildRetargetedClips(moveAnimLoaded, bodyScene.nodes);
  function pickClip(clips: AnimClip[], preferredName: string): AnimClip | undefined {
    const exact = clips.find((c) => c.name === preferredName);
    if (exact) return exact;
    const ci = clips.find((c) => c.name.toLowerCase().includes(preferredName.toLowerCase()));
    return ci ?? clips[0];
  }
  const idleClip = pickClip(idleClips, 'idle_a');
  const moveClip = pickClip(moveClips, 'running_a');
  const jumpStartClip = pickClip(moveClips, 'jump_start');
  const jumpIdleClip = pickClip(moveClips, 'jump_idle');
  const jumpLandClip = pickClip(moveClips, 'jump_land');
  if (!idleClip || !moveClip || !jumpStartClip || !jumpIdleClip || !jumpLandClip) {
    throw new Error('Missing animation clips in Rig_Medium GLBs');
  }

  const characterController = characterEntity.components['character'] as ReturnType<typeof createCharacterController>;
  characterController.jumpStartDuration = jumpStartClip.duration;
  characterController.jumpLandDuration = jumpLandClip.duration;

  const characterParts: Array<{ skinInst: SkinInstance; renderEntityIds: number[] }> = [];

  function createSkinnedEntitiesForScene(
    sceneLoaded: Awaited<ReturnType<typeof loadGltf>>,
    scenePrefix: string,
    sceneRuntime: ReturnType<typeof buildRuntimeScene>,
    targetNodesForSkin: typeof bodyScene.nodes,
    skinRemapByName: boolean,
  ) {
    const mats = buildMaterials(sceneLoaded, scenePrefix);
    const nameToBody = new Map<string, number>();
    for (let i = 0; i < bodyScene.nodes.length; i++) nameToBody.set(bodyScene.nodes[i].name, i);

    for (const pair of sceneRuntime.meshNodePairs) {
      const model = sceneRuntime.models[pair.meshIndex];
      if (!model) continue;

      // If this node uses skinning, create a skin instance (possibly remapped to body nodes)
      let skinInst: SkinInstance | null = null;
      if (pair.skinIndex >= 0) {
        if (!skinRemapByName) {
          skinInst = createSkinInstance(sceneRuntime, pair.skinIndex, pair.nodeIndex);
        } else {
          const srcSkin = sceneRuntime.skins[pair.skinIndex];
          if (!srcSkin) continue;
          const remappedJoints: number[] = [];
          for (const jNode of srcSkin.joints) {
            const jName = sceneRuntime.nodes[jNode]?.name;
            const mapped = jName ? nameToBody.get(jName) : undefined;
            remappedJoints.push(mapped ?? 0);
          }
          // Create a throwaway skin instance that points at body nodes but keeps invBind from the accessory.
          const fakeScene = { ...sceneRuntime, nodes: targetNodesForSkin, skins: [{ ...srcSkin, joints: remappedJoints }] } as any;
          skinInst = createSkinInstance(fakeScene, 0, pair.nodeIndex);
        }
      }

      const renderEntityIds: number[] = [];
      for (const prim of model.primitives) {
        const material =
          prim.materialIndex >= 0 && prim.materialIndex < mats.length ? mats[prim.materialIndex] : mats[0];

        if (prim.kind === 'skinned' && skinInst) {
          const mesh = createSkinnedMesh(gl, prim.vertices, prim.joints, prim.weights, prim.indices, skinInst.jointCount);
          const e = registry.create();
          e.components['transform'] = charT;
          e.components['skin'] = skinInst;
          (e.components as any)['gltfNodeIndex'] = pair.nodeIndex;
          e.components['renderable'] = { mesh, material, model: m4() };
          renderEntityIds.push(e.id);
        } else {
          const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
          const e = registry.create();
          e.components['transform'] = charT;
          (e.components as any)['gltfNodeIndex'] = pair.nodeIndex;
          e.components['renderable'] = { mesh, material, model: m4() };
          renderEntityIds.push(e.id);
        }
      }

      if (skinInst) characterParts.push({ skinInst, renderEntityIds });
    }
  }

  // Body uses its own skin + nodes
  createSkinnedEntitiesForScene(bodyLoaded, 'spaceranger_body', bodyScene, bodyScene.nodes, false);

  // Helmet + jetpack removed for now per request.

  // Animation + skinning update (runs before draw)
  registry.addAction(
    'update',
    (ctx) => {
      // Ensure the character root world matrix is up-to-date for palette calc.
      updateWorldMatrix(charT);
      const visualYOffset = -0.55;
      const renderRootWorld = m4Copy(m4(), charT.world);
      renderRootWorld[13] += visualYOffset;

      // Reset to bind pose
      for (let i = 0; i < bodyScene.nodes.length; i++) {
        bodyScene.nodes[i].localT.set(bindPose.t[i]);
        bodyScene.nodes[i].localS.set(bindPose.s[i]);
        bodyScene.nodes[i].localR.set(bindPose.r[i]);
      }

      const cc = characterEntity.components['character'] as ReturnType<typeof createCharacterController>;
      const vx = cc.velocity[0];
      const vz = cc.velocity[2];
      const speed = Math.hypot(vx, vz);
      const moveW = speed > 0.05 ? Math.min(1, speed / Math.max(1e-6, cc.moveSpeed)) : 0;

      if (cc.jumpPhase === 'none' && cc.locomotionBlend < 1) {
        const blendSpeed = 1 / 0.2;
        cc.locomotionBlend = Math.min(1, cc.locomotionBlend + ctx.dt * blendSpeed);
      }

      cc.locomotionAnimTime += ctx.dt;

      const jumpW = 1 - cc.locomotionBlend;
      const locoW = cc.locomotionBlend;

      if (jumpW > 0) {
        let jumpClip = jumpIdleClip;
        let jumpTime = cc.jumpClipTime;
        let jumpLoop = true;

        if (cc.jumpPhase === 'start') {
          jumpClip = jumpStartClip;
          jumpLoop = false;
        } else if (cc.jumpPhase === 'air') {
          jumpClip = jumpIdleClip;
          jumpLoop = true;
        } else if (cc.jumpPhase === 'land') {
          jumpClip = jumpLandClip;
          jumpLoop = false;
        } else {
          jumpClip = jumpLandClip;
          jumpTime = jumpLandClip.duration;
          jumpLoop = false;
        }

        sampleClipToNodes(jumpClip, bodyScene.nodes, jumpTime, jumpW, jumpLoop);
      }

      sampleClipToNodes(idleClip, bodyScene.nodes, cc.locomotionAnimTime, locoW);
      sampleClipToNodes(moveClip, bodyScene.nodes, cc.locomotionAnimTime * cc.moveAnimSpeed, locoW * moveW);

      // Recompute node world matrices from animated locals
      updateWorldFromLocals(bodyScene.nodes);

      // Update per-renderable model matrices using the mesh node transform:
      // model = characterRootWorld * meshNodeWorld
      for (const e of registry.all()) {
        const r = e.components['renderable'] as any;
        const nodeIndex = (e.components as any)['gltfNodeIndex'] as number | undefined;
        if (!r?.model || nodeIndex === undefined) continue;
        m4Mul(r.model, renderRootWorld, bodyScene.nodes[nodeIndex]!.worldM);
      }

      // Update skinned palettes (computed relative to each mesh's world matrix)
      const _meshWorld = m4();
      for (const part of characterParts) {
        const skinInst = part.skinInst;
        m4Mul(_meshWorld, renderRootWorld, bodyScene.nodes[skinInst.rootNodeIndex]!.worldM);
        computeSkinPalette(bodyScene.nodes, skinInst.skin, skinInst.palette, renderRootWorld, _meshWorld);
        // ensure skin object has palette/jointCount for render
        (skinInst as any).palette = skinInst.palette;
        (skinInst as any).jointCount = skinInst.jointCount;
      }
    },
    20,
  );

  // (No extra hand-authored platform colliders; each glTF instance creates its own static collider.)

  game.start();
}

