import { type Registry } from '../engine/registry.ts';
import { createDevice, type GLDevice } from './gl/device.ts';
import { createColorFramebuffer, type ColorFramebuffer } from './gl/colorFramebuffer.ts';
import { createSceneFramebuffer } from './gl/framebuffer.ts';
import { createShadowFramebuffer } from './gl/shadowFramebuffer.ts';
import { ShaderProgram } from './gl/shader.ts';
import { ForwardPass } from './passes/forwardPass.ts';
import { PostProcessPass } from './passes/postProcessPass.ts';
import { ShadowPass } from './passes/shadowPass.ts';
import { shadowDepthVS, shadowDepthSkinnedVS, shadowDepthFS } from './shaders/shadow.ts';
import { litTexturedVS, litSkinnedVS, litTexturedFS } from './shaders/lit.ts';
import { groundVS, groundFS } from './shaders/ground.ts';
import { fullscreenVS, toneColorFS } from './shaders/post.ts';
import { DIRECTIONAL_LIGHT, type Camera, type DrawItem } from './types.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type Mat4, m4, m4LookAt, m4Mul, m4Ortho, m4Perspective } from '../math/mat4.ts';
import { type Vec3, v3, v3Copy, v3Normalize, v3Set } from '../math/vec3.ts';

export type PostProcessStage = {
  readonly name: string;
  enabled: boolean;
  draw: (inputTex: WebGLTexture, w: number, h: number, outputFbo: WebGLFramebuffer | null) => void;
};

export type RenderPipeline = {
  readonly device: GLDevice;
  readonly camera: Camera;
  readonly target: Vec3;
  setGround: (g: { mesh: DrawItem['mesh']; model: Mat4 }) => void;
  addPostProcess: (stage: PostProcessStage) => () => void;
  getPostProcessStages: () => ReadonlyArray<PostProcessStage>;
};

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

export const installRenderPipeline = (
  registry: Registry,
  canvas: HTMLCanvasElement,
): RenderPipeline => {
  const device = createDevice(canvas);
  const gl = device.gl;

  const forwardPass = new ForwardPass(
    gl,
    new ShaderProgram(gl, litTexturedVS, litTexturedFS),
    new ShaderProgram(gl, litSkinnedVS, litTexturedFS),
    new ShaderProgram(gl, groundVS, groundFS),
  );
  const shadowPass = new ShadowPass(
    gl,
    new ShaderProgram(gl, shadowDepthVS, shadowDepthFS),
    new ShaderProgram(gl, shadowDepthSkinnedVS, shadowDepthFS),
  );
  const tonePass = new PostProcessPass(gl, new ShaderProgram(gl, fullscreenVS, toneColorFS));

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
    };
  };

  let lastDt = 1 / 60;
  registry.addAction('draw', () => {
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

    const items: DrawItem[] = [];
    for (const e of registry.view('renderable')) {
      const t = e.components['transform'] as Transform | undefined;
      const r = e.components['renderable'] as Renderable | undefined;
      if (!t || !r) continue;
      updateWorldMatrix(t);
      const model = r.model ?? t.world;
      items.push({
        mesh: r.mesh,
        material: r.material,
        model,
        sortZ: t.world[14],
        skin: e.components['skin'] as DrawItem['skin'],
      });
    }

    const lvp = computeLightViewProj(target);

    shadowFbo.bind();
    shadowPass.draw(lvp, groundItem, items);
    shadowFbo.unbind();

    sceneFbo.resize(w, h);
    sceneFbo.bind();
    forwardPass.draw(camera, { lightViewProj: lvp, map: shadowFbo.depthTex, mapSize: shadowFbo.size }, groundItem, items);
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

    const fpsEl = document.querySelector<HTMLSpanElement>('#fps');
    if (fpsEl) fpsEl.textContent = `${Math.round(1 / Math.max(1e-6, lastDt))}`;
  }, 0);

  registry.addAction('commit', (ctx) => { lastDt = ctx.dt; }, 100);

  return {
    device,
    camera,
    target,
    setGround,
    addPostProcess: (stage) => {
      postStages.push(stage);
      return () => {
        const idx = postStages.indexOf(stage);
        if (idx >= 0) postStages.splice(idx, 1);
      };
    },
    getPostProcessStages: () => postStages,
  };
};
