import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { createDevice, type GpuDevice } from './gl/device.ts';
import { createForwardPass } from './passes/forwardPass.ts';
import { createTonePostPass } from './passes/postProcessPass.ts';
import { createPostPingPong } from './gl/postPingPong.ts';
import { createFrustumPlanes, extractFrustumPlanes, isSphereInFrustumPlanes } from './frustum.ts';
import { DIRECTIONAL_LIGHT, type Camera, type DrawItem, type Material } from './types.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type MeshDraws } from '../components/meshDraws.ts';
import { type GroundPlane } from '../components/groundPlane.ts';
import { type Mat4, m4, m4LookAt, m4Mul, m4Ortho, m4Perspective } from '../math/mat4.ts';
import { type Vec3, v3, v3Copy, v3Normalize, v3Set } from '../math/vec3.ts';
import {
  DEFAULT_ENGINE_OPTIMIZATION,
  type EngineOptimizationOptions,
} from '../engine/optimizationOptions.ts';
import { type Mesh } from './gl/mesh.ts';
import {
  createStaticPropBatcher,
  type StaticPropBatcher,
} from './gl/staticPropBatcher.ts';

export type PostProcessStage = {
  readonly name: string;
  enabled: boolean;
  encode: (
    encoder: GPUCommandEncoder,
    inputView: GPUTextureView,
    w: number,
    h: number,
    outputView: GPUTextureView,
  ) => void;
  destroy?: () => void;
};

export type RenderPipeline = {
  readonly device: GpuDevice;
  readonly camera: Camera;
  readonly target: Vec3;
  readonly staticPropBatcher: StaticPropBatcher;
  setPreDrawEncode: (fn: ((encoder: GPUCommandEncoder) => void) | null) => void;
  addPostProcess: (stage: PostProcessStage) => () => void;
  getPostProcessStages: () => ReadonlyArray<PostProcessStage>;
  getFps: () => number;
  subscribeFps: (listener: (fps: number) => void) => () => void;
  destroy: () => void;
};

const FPS_UPDATE_INTERVAL_S = 0.25;

const _proj = m4();
const _view = m4();
const _viewProj = m4();
const _eye = v3();
const _target = v3();
const _up = v3(0, 1, 0);
const _lightDir = v3();
const _lightEye = v3();
const _lightView = m4();
const _lightProj = m4();
const _lightViewProj = m4();
const lightViewProj: Mat4 = m4();
const _frustum = createFrustumPlanes();
const _lightFrustum = createFrustumPlanes();
const _sphereCenter = new Float32Array(3);

const worldSphereFromLocal = (
  outCenter: Float32Array,
  model: Mat4,
  localCenter: readonly [number, number, number],
  localRadius: number,
): number => {
  const lx = localCenter[0]!;
  const ly = localCenter[1]!;
  const lz = localCenter[2]!;
  outCenter[0] = model[0]! * lx + model[4]! * ly + model[8]! * lz + model[12]!;
  outCenter[1] = model[1]! * lx + model[5]! * ly + model[9]! * lz + model[13]!;
  outCenter[2] = model[2]! * lx + model[6]! * ly + model[10]! * lz + model[14]!;

  const sx2 = model[0]! * model[0]! + model[1]! * model[1]! + model[2]! * model[2]!;
  const sy2 = model[4]! * model[4]! + model[5]! * model[5]! + model[6]! * model[6]!;
  const sz2 = model[8]! * model[8]! + model[9]! * model[9]! + model[10]! * model[10]!;
  return localRadius * Math.sqrt(Math.max(sx2, sy2, sz2));
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const computeLightViewProj = (center: Vec3): Mat4 => {
  v3Set(_lightDir, DIRECTIONAL_LIGHT.dir[0], DIRECTIONAL_LIGHT.dir[1], DIRECTIONAL_LIGHT.dir[2]);
  v3Normalize(_lightDir, _lightDir);
  const dist = 50;
  _lightEye[0] = center[0] - _lightDir[0] * dist;
  _lightEye[1] = center[1] - _lightDir[1] * dist;
  _lightEye[2] = center[2] - _lightDir[2] * dist;
  m4LookAt(_lightView, _lightEye, center, _up);
  m4Ortho(_lightProj, -35, 35, -35, 35, 1, 120);
  m4Mul(_lightViewProj, _lightProj, _lightView);
  lightViewProj.set(_lightViewProj);
  return lightViewProj;
};

export type PipelineOptions = {
  getEntityRegistry?: () => Registry;
  optimization?: EngineOptimizationOptions;
};

export const installRenderPipeline = async (
  registry: Registry,
  canvas: HTMLCanvasElement,
  options: PipelineOptions = {},
): Promise<RenderPipeline> => {
  const getEntityRegistry = options.getEntityRegistry ?? (() => registry);
  const optimization = options.optimization ?? DEFAULT_ENGINE_OPTIMIZATION;
  const device = await createDevice(canvas);
  const forwardPass = createForwardPass(device);
  const tonePass = createTonePostPass(device);
  const postPingPong = createPostPingPong(device);
  const staticPropBatcher = createStaticPropBatcher(device);
  const _camPosF32 = new Float32Array(3);

  const toneStage: PostProcessStage = {
    name: 'tone-color',
    enabled: true,
    encode: (encoder, inputView, w, h, outputView) =>
      tonePass.encode(encoder, inputView, w, h, outputView),
    destroy: () => tonePass.destroy(),
  };
  const postStages: PostProcessStage[] = [toneStage];

  const cameraPos: Vec3 = v3(0, 9, 9);
  const target: Vec3 = v3(0, 1, 0);
  const viewProj: Mat4 = m4();
  const camera: Camera = { viewProj, position: cameraPos };

  const opaqueItems: DrawItem[] = [];
  const transparentItems: DrawItem[] = [];
  const overlayItems: DrawItem[] = [];
  const shadowItems: DrawItem[] = [];
  const itemPool: DrawItem[] = [];
  let itemPoolUsed = 0;

  const acquireItem = (): DrawItem => {
    if (itemPoolUsed < itemPool.length) {
      return itemPool[itemPoolUsed++];
    }
    const item: DrawItem = {
      mesh: null as unknown as Mesh,
      material: { name: '', baseColorTex: null, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' },
      model: m4(),
      sortZ: 0,
      castShadow: true,
      overlay: false,
    };
    itemPool.push(item);
    itemPoolUsed++;
    return item;
  };

  let fpsEl: HTMLSpanElement | null | undefined;
  let fpsAccum = 0;
  let fpsFrameCount = 0;
  let lastShownFps = -1;
  let currentFps = 0;
  const fpsListeners = new Set<(fps: number) => void>();
  let preDrawEncode: ((encoder: GPUCommandEncoder) => void) | null = null;

  const removeDraw = registry.addAction('draw', () => {
    device.resize();
    const size = device.getSize();
    const aspect = Math.max(1e-6, size.width / size.height);

    m4Perspective(_proj, (60 * Math.PI) / 180, aspect, 0.1, 200.0);
    v3Copy(_eye, camera.position);
    v3Copy(_target, target);
    m4LookAt(_view, _eye, _target, _up);
    m4Mul(_viewProj, _proj, _view);
    viewProj.set(_viewProj);
    extractFrustumPlanes(_frustum, viewProj);

    const lvp = computeLightViewProj(target);
    extractFrustumPlanes(_lightFrustum, lvp);

    opaqueItems.length = 0;
    transparentItems.length = 0;
    overlayItems.length = 0;
    shadowItems.length = 0;
    itemPoolUsed = 0;

    const camX = camera.position[0];
    const camY = camera.position[1];
    const camZ = camera.position[2];
    const forwardDist2 = optimization.forwardCullDist * optimization.forwardCullDist;
    const shadowDist2 = optimization.shadowCullDist * optimization.shadowCullDist;
    const entityRegistry = getEntityRegistry();

    const pushDrawItem = (
      mesh: Mesh,
      material: Material,
      model: Mat4,
      skin: DrawItem['skin'] | undefined,
      castShadow: boolean,
      overlay = false,
      gpuModel?: DrawItem['gpuModel'],
    ) => {
      const x = model[12];
      const y = model[13];
      const z = model[14];
      const d2 = distSqXZ(x, z, camX, camZ);
      const canCastShadow =
        !overlay && castShadow && material.alphaMode !== 'BLEND' && material.alphaMode !== 'MASK';
      const withinShadowDist = canCastShadow && d2 <= shadowDist2;
      const withinForwardDist = d2 <= forwardDist2;
      if (!withinForwardDist && !withinShadowDist) return;

      const localRadius = skin ? mesh.boundsRadius * 1.5 : mesh.boundsRadius;
      const worldRadius = worldSphereFromLocal(_sphereCenter, model, mesh.boundsCenter, localRadius);
      const cx = _sphereCenter[0]!;
      const cy = _sphereCenter[1]!;
      const cz = _sphereCenter[2]!;

      const inCameraFrustum =
        withinForwardDist && (overlay || isSphereInFrustumPlanes(_frustum, cx, cy, cz, worldRadius));
      const inLightFrustum =
        withinShadowDist && isSphereInFrustumPlanes(_lightFrustum, cx, cy, cz, worldRadius);
      if (!inCameraFrustum && !inLightFrustum) return;

      const item = acquireItem();
      item.mesh = mesh;
      item.material = material;
      item.model = model;
      const dx = x - camX;
      const dy = y - camY;
      const dz = z - camZ;
      item.sortZ = dx * dx + dy * dy + dz * dz;
      item.skin = skin;
      item.gpuModel = gpuModel;
      item.castShadow = inLightFrustum;
      item.overlay = overlay;

      if (inCameraFrustum) {
        if (overlay) overlayItems.push(item);
        else if (material.alphaMode === 'BLEND') transparentItems.push(item);
        else opaqueItems.push(item);
      }
      if (inLightFrustum) shadowItems.push(item);
    };

    for (const e of entityRegistry.view(COMPONENT_KEYS.meshDraws)) {
      const meshDraws = e.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
      if (!meshDraws) continue;

      for (const part of meshDraws.parts) {
        if (part.visible === false) continue;
        const model = part.model ?? (e.components[COMPONENT_KEYS.transform] as Transform | undefined)?.world;
        if (!model) continue;
        const skin = part.skin?.paletteGpu
          ? {
              jointCount: part.skin.jointCount,
              paletteGpu: part.skin.paletteGpu,
            }
          : undefined;
        pushDrawItem(
          part.mesh,
          part.material,
          model,
          skin,
          part.castShadow !== false,
          false,
          part.gpuModel,
        );
      }
    }

    for (const e of entityRegistry.view(COMPONENT_KEYS.renderable)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const r = e.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
      if (!t || !r || r.visible === false) continue;

      updateWorldMatrix(t);
      const model = r.model ?? t.world;
      pushDrawItem(r.mesh, r.material, model, undefined, r.castShadow !== false, r.overlay === true);
    }

    let ground: { mesh: Mesh; model: Mat4; alpha: number } | null = null;
    for (const e of entityRegistry.view(COMPONENT_KEYS.groundPlane)) {
      const g = e.components[COMPONENT_KEYS.groundPlane] as GroundPlane | undefined;
      if (!g) continue;
      ground = {
        mesh: g.mesh,
        model: g.model,
        alpha: camY < 0 ? 0.25 : 1,
      };
      break;
    }

    opaqueItems.sort((a, b) => a.sortZ - b.sortZ);
    transparentItems.sort((a, b) => b.sortZ - a.sortZ);

    _camPosF32[0] = camX;
    _camPosF32[1] = camY;
    _camPosF32[2] = camZ;

    const encoder = device.gpu.createCommandEncoder();
    const poseEncode = preDrawEncode;
    preDrawEncode = null;
    poseEncode?.(encoder);
    const staticBatches = staticPropBatcher.cullAndPrepare(
      _frustum,
      _lightFrustum,
      _camPosF32,
      optimization.forwardCullDist,
      optimization.shadowCullDist,
      encoder,
    );

    const sceneSize = forwardPass.encode(
      encoder,
      camera,
      lvp,
      ground,
      opaqueItems,
      transparentItems,
      overlayItems,
      shadowItems,
      staticBatches,
    );

    const enabled = postStages.filter((s) => s.enabled);
    const canvasFrame = device.ensureFrame();
    if (enabled.length === 0) {
      device.gpu.queue.submit([encoder.finish()]);
      return;
    }

    postPingPong.resize(sceneSize.width, sceneSize.height);
    let inputView = forwardPass.getSceneView();
    let pingIdx: 0 | 1 = 0;

    for (let i = 0; i < enabled.length; i++) {
      const isLast = i === enabled.length - 1;
      const outputView = isLast ? canvasFrame.colorView : postPingPong.get(pingIdx).view;
      enabled[i]!.encode(encoder, inputView, sceneSize.width, sceneSize.height, outputView);
      if (!isLast) {
        inputView = postPingPong.get(pingIdx).view;
        pingIdx = pingIdx === 0 ? 1 : 0;
      }
    }

    device.gpu.queue.submit([encoder.finish()]);
  }, 0);

  const removeFps = registry.addAction('commit', (ctx) => {
    fpsAccum += ctx.dt;
    fpsFrameCount++;
    if (fpsAccum < FPS_UPDATE_INTERVAL_S) return;

    const fps = Math.round(fpsFrameCount / fpsAccum);
    fpsAccum = 0;
    fpsFrameCount = 0;
    currentFps = fps;

    for (const listener of fpsListeners) listener(fps);

    if (fpsEl === undefined) fpsEl = document.querySelector<HTMLSpanElement>('#fps');
    if (!fpsEl || fps === lastShownFps) return;

    lastShownFps = fps;
    fpsEl.textContent = `${fps}`;
  }, 100);

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    removeDraw();
    removeFps();
    fpsListeners.clear();

    for (const s of postStages) s.destroy?.();
    postStages.length = 0;
    postPingPong.destroy();
    forwardPass.destroy();
    staticPropBatcher.destroy();
    device.destroy();
  };

  return {
    device,
    camera,
    target,
    staticPropBatcher,
    setPreDrawEncode: (fn) => {
      preDrawEncode = fn;
    },
    addPostProcess: (stage) => {
      postStages.push(stage);
      return () => {
        const idx = postStages.indexOf(stage);
        if (idx >= 0) postStages.splice(idx, 1);
        stage.destroy?.();
      };
    },
    getPostProcessStages: () => postStages,
    getFps: () => currentFps,
    subscribeFps: (listener) => {
      fpsListeners.add(listener);
      if (currentFps > 0) listener(currentFps);
      return () => { fpsListeners.delete(listener); };
    },
    destroy,
  };
};
