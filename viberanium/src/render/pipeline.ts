import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { createDevice, type GLDevice } from './gl/device.ts';
import { createColorFramebuffer, type ColorFramebuffer } from './gl/colorFramebuffer.ts';
import { createSceneFramebuffer } from './gl/framebuffer.ts';
import { createShadowFramebuffer } from './gl/shadowFramebuffer.ts';
import { createShaderProgram } from './gl/shader.ts';
import { createForwardPass } from './passes/forwardPass.ts';
import { createPostProcessPass } from './passes/postProcessPass.ts';
import { createShadowPass } from './passes/shadowPass.ts';
import { shadowDepthVS, shadowDepthSkinnedVS, shadowDepthFS } from './shaders/shadow.ts';
import { litTexturedVS, litSkinnedVS, litTexturedFS } from './shaders/lit.ts';
import { groundVS, groundFS } from './shaders/ground.ts';
import { fullscreenVS, toneColorFS } from './shaders/post.ts';
import { createFrustumPlanes, extractFrustumPlanes, isSphereInFrustumPlanes } from './frustum.ts';
import { DIRECTIONAL_LIGHT, type Camera, type DrawItem } from './types.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type MeshDraws } from '../components/meshDraws.ts';
import { type SkinInstance } from '../components/skin.ts';
import { type GroundPlane } from '../components/groundPlane.ts';
import { type Mat4, m4, m4LookAt, m4Mul, m4Ortho, m4Perspective } from '../math/mat4.ts';
import { type Vec3, v3, v3Copy, v3Normalize, v3Set } from '../math/vec3.ts';
import {
  DEFAULT_ENGINE_OPTIMIZATION,
  type EngineOptimizationOptions,
} from '../engine/optimizationOptions.ts';

export type PostProcessStage = {
  readonly name: string;
  enabled: boolean;
  draw: (inputTex: WebGLTexture, w: number, h: number, outputFbo: WebGLFramebuffer | null) => void;
  destroy?: () => void;
};

export type RenderPipeline = {
  readonly device: GLDevice;
  readonly camera: Camera;
  readonly target: Vec3;
  addPostProcess: (stage: PostProcessStage) => () => void;
  getPostProcessStages: () => ReadonlyArray<PostProcessStage>;
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

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

export type PipelineOptions = {
  getEntityRegistry?: () => Registry;
  optimization?: EngineOptimizationOptions;
};

export const installRenderPipeline = (
  registry: Registry,
  canvas: HTMLCanvasElement,
  options: PipelineOptions = {},
): RenderPipeline => {
  const getEntityRegistry = options.getEntityRegistry ?? (() => registry);
  const optimization = options.optimization ?? DEFAULT_ENGINE_OPTIMIZATION;
  const device = createDevice(canvas);
  const gl = device.gl;

  const forwardPass = createForwardPass(
    gl,
    createShaderProgram(gl, litTexturedVS, litTexturedFS),
    createShaderProgram(gl, litSkinnedVS, litTexturedFS),
    createShaderProgram(gl, groundVS, groundFS),
  );
  const shadowPass = createShadowPass(
    gl,
    createShaderProgram(gl, shadowDepthVS, shadowDepthFS),
    createShaderProgram(gl, shadowDepthSkinnedVS, shadowDepthFS),
  );
  const tonePass = createPostProcessPass(gl, createShaderProgram(gl, fullscreenVS, toneColorFS));

  const sceneFbo = createSceneFramebuffer(gl);
  const shadowFbo = createShadowFramebuffer(gl, 2048);
  const pingFbos: [ColorFramebuffer, ColorFramebuffer] = [
    createColorFramebuffer(gl),
    createColorFramebuffer(gl),
  ];

  const toneStage: PostProcessStage = {
    name: 'tone-color',
    enabled: true,
    draw: (inputTex, w, h, outputFbo) => tonePass.draw(inputTex, w, h, outputFbo),
  };
  const postStages: PostProcessStage[] = [toneStage];

  const cameraPos: Vec3 = v3(0, 9, 9);
  const target: Vec3 = v3(0, 1, 0);
  const viewProj: Mat4 = m4();
  const camera: Camera = { viewProj, position: cameraPos };

  const groundMaterial = {
    name: 'ground',
    baseColorTex: null as WebGLTexture | null,
    baseColorFactor: [1, 1, 1, 1] as [number, number, number, number],
    alphaMode: 'OPAQUE' as const,
    doubleSided: true,
  };

  const forwardItems: DrawItem[] = [];
  const shadowItems: DrawItem[] = [];
  const itemPool: DrawItem[] = [];
  let itemPoolUsed = 0;

  const acquireItem = (): DrawItem => {
    if (itemPoolUsed < itemPool.length) {
      return itemPool[itemPoolUsed++];
    }
    const item: DrawItem = {
      mesh: {
        vao: null as unknown as WebGLVertexArrayObject,
        indexCount: 0,
        boundsMin: [0, 0, 0],
        boundsMax: [0, 0, 0],
        boundsCenter: [0, 0, 0],
        boundsRadius: 0,
      },
      material: { name: '', baseColorTex: null, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' },
      model: m4(),
      sortZ: 0,
      castShadow: true,
      skin: { palette: new Float32Array(0), jointCount: 0 },
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

  const removeDraw = registry.addAction('draw', () => {
    device.resize();
    const w = device.canvas.width;
    const h = device.canvas.height;
    const aspect = Math.max(1e-6, w / h);

    m4Perspective(_proj, (60 * Math.PI) / 180, aspect, 0.1, 200.0);
    v3Copy(_eye, camera.position);
    v3Copy(_target, target);
    m4LookAt(_view, _eye, _target, _up);
    m4Mul(_viewProj, _proj, _view);
    viewProj.set(_viewProj);
    extractFrustumPlanes(_frustum, viewProj);

    const lvp = computeLightViewProj(target);
    extractFrustumPlanes(_lightFrustum, lvp);

    forwardItems.length = 0;
    shadowItems.length = 0;
    itemPoolUsed = 0;

    const camX = camera.position[0];
    const camY = camera.position[1];
    const camZ = camera.position[2];
    const forwardDist2 = optimization.forwardCullDist * optimization.forwardCullDist;
    const shadowDist2 = optimization.shadowCullDist * optimization.shadowCullDist;
    const entityRegistry = getEntityRegistry();

    const pushDrawItem = (
      mesh: DrawItem['mesh'],
      material: DrawItem['material'],
      model: Mat4,
      skin: SkinInstance | undefined,
      castShadow: boolean,
      overlay = false,
    ) => {
      const x = model[12];
      const y = model[13];
      const z = model[14];
      const d2 = distSqXZ(x, z, camX, camZ);
      const withinShadowDist = !overlay && castShadow && d2 <= shadowDist2;
      const withinForwardDist = d2 <= forwardDist2;
      if (!withinForwardDist && !withinShadowDist) return;

      const localRadius = skin ? mesh.boundsRadius * 1.5 : mesh.boundsRadius;
      const worldRadius = worldSphereFromLocal(_sphereCenter, model, mesh.boundsCenter, localRadius);
      const cx = _sphereCenter[0]!;
      const cy = _sphereCenter[1]!;
      const cz = _sphereCenter[2]!;

      const inCameraFrustum = withinForwardDist && (overlay || isSphereInFrustumPlanes(_frustum, cx, cy, cz, worldRadius));
      const inLightFrustum = withinShadowDist && isSphereInFrustumPlanes(_lightFrustum, cx, cy, cz, worldRadius);
      if (!inCameraFrustum && !inLightFrustum) return;

      const item = acquireItem();
      item.mesh = mesh;
      item.material = material;
      item.model = model;
      const dx = x - camX;
      const dy = y - camY;
      const dz = z - camZ;
      item.sortZ = dx * dx + dy * dy + dz * dz;
      if (skin) {
        if (!item.skin) item.skin = { palette: skin.palette, jointCount: skin.jointCount };
        else {
          item.skin.palette = skin.palette;
          item.skin.jointCount = skin.jointCount;
        }
      } else {
        item.skin = undefined;
      }
      item.castShadow = inLightFrustum;
      item.overlay = overlay;
      if (inCameraFrustum) forwardItems.push(item);
      if (inLightFrustum) shadowItems.push(item);
    };

    for (const e of entityRegistry.view(COMPONENT_KEYS.meshDraws)) {
      const meshDraws = e.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
      if (!meshDraws) continue;

      for (const part of meshDraws.parts) {
        if (part.visible === false) continue;
        const model = part.model ?? (e.components[COMPONENT_KEYS.transform] as Transform | undefined)?.world;
        if (!model) continue;
        pushDrawItem(part.mesh, part.material, model, part.skin, part.castShadow !== false, false);
      }
    }

    for (const e of entityRegistry.view(COMPONENT_KEYS.renderable)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const r = e.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
      if (!t || !r || r.visible === false) continue;

      updateWorldMatrix(t);
      const model = r.model ?? t.world;
      const skin = e.components[COMPONENT_KEYS.skin] as SkinInstance | undefined;
      pushDrawItem(r.mesh, r.material, model, skin, r.castShadow !== false, r.overlay === true);
    }

    let groundItem: DrawItem | null = null;
    for (const e of entityRegistry.view(COMPONENT_KEYS.groundPlane)) {
      const ground = e.components[COMPONENT_KEYS.groundPlane] as GroundPlane | undefined;
      if (!ground) continue;
      groundItem = {
        mesh: ground.mesh,
        material: groundMaterial,
        model: ground.model,
        sortZ: 0,
        castShadow: true,
      };
      break;
    }

    shadowFbo.bind();
    shadowPass.draw(lvp, groundItem, shadowItems);
    shadowFbo.unbind();

    sceneFbo.resize(w, h);
    sceneFbo.bind();
    forwardPass.draw(camera, { lightViewProj: lvp, map: shadowFbo.depthTex, mapSize: shadowFbo.size }, groundItem, forwardItems);
    sceneFbo.resolve();
    sceneFbo.bindDefault();
    gl.viewport(0, 0, w, h);

    const enabled = postStages.filter(s => s.enabled);
    if (enabled.length > 0) {
      let inputTex = sceneFbo.colorTex;
      let pingIdx = 0;

      for (let i = 0; i < enabled.length; i++) {
        const isLast = i === enabled.length - 1;
        let outputFbo: WebGLFramebuffer | null = null;

        if (!isLast) {
          pingFbos[pingIdx].resize(w, h);
          outputFbo = pingFbos[pingIdx].fbo;
        }

        enabled[i].draw(inputTex, w, h, outputFbo);

        if (!isLast) {
          inputTex = pingFbos[pingIdx].colorTex;
          pingIdx ^= 1;
        }
      }
    }

  }, 0);

  const removeFps = registry.addAction('commit', (ctx) => {
    fpsAccum += ctx.dt;
    fpsFrameCount++;
    if (fpsAccum < FPS_UPDATE_INTERVAL_S) return;

    const fps = Math.round(fpsFrameCount / fpsAccum);
    fpsAccum = 0;
    fpsFrameCount = 0;
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

    for (const s of postStages) s.destroy?.();
    postStages.length = 0;

    forwardPass.destroy();
    shadowPass.destroy();
    tonePass.destroy();

    sceneFbo.destroy();
    shadowFbo.destroy();
    pingFbos[0].destroy();
    pingFbos[1].destroy();
  };

  return {
    device,
    camera,
    target,
    addPostProcess: (stage) => {
      postStages.push(stage);
      return () => {
        const idx = postStages.indexOf(stage);
        if (idx >= 0) postStages.splice(idx, 1);
        stage.destroy?.();
      };
    },
    getPostProcessStages: () => postStages,
    destroy,
  };
};
