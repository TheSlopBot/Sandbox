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
import { DIRECTIONAL_LIGHT, type Camera, type DrawItem } from './types.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type SkinInstance } from '../components/skin.ts';
import { type Mat4, m4, m4LookAt, m4Mul, m4Ortho, m4Perspective } from '../math/mat4.ts';
import { type Vec3, v3, v3Copy, v3Normalize, v3Set } from '../math/vec3.ts';

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
  setGround: (g: { mesh: DrawItem['mesh']; model: Mat4 }) => void;
  clearGround: () => void;
  addPostProcess: (stage: PostProcessStage) => () => void;
  getPostProcessStages: () => ReadonlyArray<PostProcessStage>;
  destroy: () => void;
};

const CULL_FORWARD_DIST = 90;
const CULL_SHADOW_DIST = 28;
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
};

export const installRenderPipeline = (
  registry: Registry,
  canvas: HTMLCanvasElement,
  options: PipelineOptions = {},
): RenderPipeline => {
  const getEntityRegistry = options.getEntityRegistry ?? (() => registry);
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

  let groundItem: DrawItem | null = null;
  const setGround = (g: { mesh: DrawItem['mesh']; model: Mat4 }) => {
    groundItem = {
      mesh: g.mesh,
      material: { name: 'ground', baseColorTex: null, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' },
      model: g.model,
      sortZ: 0,
      castShadow: true,
    };
  };

  const clearGround = () => { groundItem = null; };

  const forwardItems: DrawItem[] = [];
  const shadowItems: DrawItem[] = [];
  const itemPool: DrawItem[] = [];
  let itemPoolUsed = 0;

  const acquireItem = (): DrawItem => {
    if (itemPoolUsed < itemPool.length) {
      return itemPool[itemPoolUsed++];
    }
    const item: DrawItem = {
      mesh: { vao: null as unknown as WebGLVertexArrayObject, indexCount: 0 },
      material: { name: '', baseColorTex: null, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' },
      model: m4(),
      sortZ: 0,
      castShadow: true,
      skin: { palette: new Float32Array(0), jointCount: 0 },
    };
    itemPool.push(item);
    itemPoolUsed++;
    return item;
  };

  let lastDt = 1 / 60;
  let fpsEl: HTMLSpanElement | null | undefined;
  let fpsAccum = 0;
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

    forwardItems.length = 0;
    shadowItems.length = 0;
    itemPoolUsed = 0;

    const camX = camera.position[0];
    const camZ = camera.position[2];
    const forwardDist2 = CULL_FORWARD_DIST * CULL_FORWARD_DIST;
    const shadowDist2 = CULL_SHADOW_DIST * CULL_SHADOW_DIST;
    const entityRegistry = getEntityRegistry();

    for (const e of entityRegistry.view(COMPONENT_KEYS.renderable)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const r = e.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
      if (!t || !r || r.visible === false) continue;

      updateWorldMatrix(t);
      const model = r.model ?? t.world;
      const x = model[12];
      const z = model[14];
      const d2 = distSqXZ(x, z, camX, camZ);
      if (d2 > forwardDist2) continue;

      const item = acquireItem();
      item.mesh = r.mesh;
      item.material = r.material;
      item.model = model;
      item.sortZ = model[14];
      const skin = e.components[COMPONENT_KEYS.skin] as SkinInstance | undefined;
      if (skin) {
        if (!item.skin) item.skin = { palette: skin.palette, jointCount: skin.jointCount };
        else {
          item.skin.palette = skin.palette;
          item.skin.jointCount = skin.jointCount;
        }
      } else {
        item.skin = undefined;
      }
      item.castShadow = r.castShadow !== false && d2 <= shadowDist2;
      forwardItems.push(item);
      if (item.castShadow) shadowItems.push(item);
    }

    const lvp = computeLightViewProj(target);

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

    fpsAccum += lastDt;
    if (fpsAccum >= FPS_UPDATE_INTERVAL_S) {
      fpsAccum = 0;
      if (fpsEl === undefined) fpsEl = document.querySelector<HTMLSpanElement>('#fps');
      if (fpsEl) {
        const fps = Math.round(1 / Math.max(1e-6, lastDt));
        if (fps !== lastShownFps) {
          lastShownFps = fps;
          fpsEl.textContent = `${fps}`;
        }
      }
    }
  }, 0);

  const removeCommit = registry.addAction('commit', (ctx) => { lastDt = ctx.dt; }, 100);

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    removeDraw();
    removeCommit();

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
    setGround,
    clearGround,
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
