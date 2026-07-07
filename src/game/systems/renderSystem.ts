import { type Registry } from '../../engine/registry.ts';
import { type Input } from '../input.ts';
import { createGlyphAtlasTexture } from '../../render/ascii/glyphAtlas.ts';
import { createDevice, type GLDevice } from '../../render/gl/device.ts';
import { createColorFramebuffer } from '../../render/gl/colorFramebuffer.ts';
import { createSceneFramebuffer } from '../../render/gl/framebuffer.ts';
import { createShadowFramebuffer } from '../../render/gl/shadowFramebuffer.ts';
import { ShaderProgram } from '../../render/gl/shader.ts';
import { AsciiPostProcessPass } from '../../render/passes/asciiPostProcessPass.ts';
import { ForwardPass } from '../../render/passes/forwardPass.ts';
import { PostProcessPass } from '../../render/passes/postProcessPass.ts';
import { ShadowPass } from '../../render/passes/shadowPass.ts';
import {
  asciiPostProcessFS,
  asciiPostProcessVS,
  groundFS,
  groundVS,
  litSkinnedVS,
  litTexturedFS,
  litTexturedVS,
  postProcessFS,
  postProcessVS,
  shadowDepthFS,
  shadowDepthSkinnedVS,
  shadowDepthVS,
} from '../../render/shaders.ts';
import { DIRECTIONAL_LIGHT, type Camera, type DrawItem } from '../../render/types.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type Mat4, m4, m4LookAt, m4Mul, m4Ortho, m4Perspective } from '../../math/mat4.ts';
import { type Vec3, v3, v3Copy, v3Normalize, v3Set } from '../../math/vec3.ts';

export type RenderState = {
  device: GLDevice;
  camera: Camera;
  target: Vec3;
  setGround: (ground: { mesh: DrawItem['mesh']; model: Mat4 }) => void;
  asciiEnabled: boolean;
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

function computeLightViewProj(center: Vec3): Mat4 {
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
}

export function installRenderSystem(registry: Registry, canvas: HTMLCanvasElement, input: Input): RenderState {
  const device = createDevice(canvas);
  const gl = device.gl;

  const lit = new ShaderProgram(gl, litTexturedVS, litTexturedFS);
  const litSkinned = new ShaderProgram(gl, litSkinnedVS, litTexturedFS);
  const ground = new ShaderProgram(gl, groundVS, groundFS);
  const postProcess = new ShaderProgram(gl, postProcessVS, postProcessFS);
  const asciiPostProcess = new ShaderProgram(gl, asciiPostProcessVS, asciiPostProcessFS);
  const shadowDepth = new ShaderProgram(gl, shadowDepthVS, shadowDepthFS);
  const shadowDepthSkinned = new ShaderProgram(gl, shadowDepthSkinnedVS, shadowDepthFS);
  const pass = new ForwardPass(gl, lit, litSkinned, ground);
  const shadow = new ShadowPass(gl, shadowDepth, shadowDepthSkinned);
  const post = new PostProcessPass(gl, postProcess);
  const glyphTex = createGlyphAtlasTexture(gl);
  const asciiPost = new AsciiPostProcessPass(gl, asciiPostProcess, glyphTex);
  const sceneFbo = createSceneFramebuffer(gl);
  const processedFbo = createColorFramebuffer(gl);
  const shadowFbo = createShadowFramebuffer(gl, 2048);

  let asciiEnabled = false;

  const cameraPos: Vec3 = v3(0, 8, 8);
  const target: Vec3 = v3(0, 1, 0);
  const viewProj: Mat4 = m4();
  const camera: Camera = { viewProj, position: cameraPos };

  let groundItem: DrawItem | null = null;

  function setGround(g: { mesh: DrawItem['mesh']; model: Mat4 }) {
    groundItem = {
      mesh: g.mesh,
      material: { name: 'ground', baseColorTex: null, baseColorFactor: [1, 1, 1, 1], alphaMode: 'OPAQUE' },
      model: g.model,
      sortZ: 0,
    };
  }

  registry.addAction(
    'update',
    () => {
      if (input.pressed('KeyT')) asciiEnabled = !asciiEnabled;
    },
    0,
  );

  registry.addAction(
    'draw',
    () => {
      device.resize();
      const aspect = Math.max(1e-6, device.canvas.width / device.canvas.height);
      m4Perspective(_proj, (60 * Math.PI) / 180, aspect, 0.1, 200.0);

      v3Copy(_eye, camera.position);
      v3Copy(_target, target);

      m4LookAt(_view, _eye, _target, _up);
      m4Mul(_viewProj, _proj, _view);
      viewProj.set(_viewProj);

      const items: DrawItem[] = [];
      for (const e of registry.all()) {
        const t = e.components['transform'] as Transform | undefined;
        const r = e.components['renderable'] as Renderable | undefined;
        if (!t || !r) continue;
        updateWorldMatrix(t);
        const model = r.model ?? t.world;
        items.push({
          mesh: r.mesh,
          material: r.material,
          model,
          sortZ: t.world[14], // rough Z sorting
          skin: (e.components as any)['skin'],
        });
      }

      const w = device.canvas.width;
      const h = device.canvas.height;

      computeLightViewProj(target);
      shadowFbo.bind();
      shadow.draw(lightViewProj, groundItem, items);
      shadowFbo.unbind();

      sceneFbo.resize(w, h);
      sceneFbo.bind();
      pass.draw(camera, { lightViewProj, map: shadowFbo.depthTex, mapSize: shadowFbo.size }, groundItem, items);
      sceneFbo.resolve();
      sceneFbo.bindDefault();
      gl.viewport(0, 0, w, h);

      if (asciiEnabled) {
        processedFbo.resize(w, h);
        post.draw(sceneFbo.colorTex, w, h, processedFbo.fbo);
        asciiPost.draw(processedFbo.colorTex, w, h);
      } else {
        post.draw(sceneFbo.colorTex, w, h);
      }

      const fpsEl = document.querySelector<HTMLSpanElement>('#fps');
      if (fpsEl) fpsEl.textContent = `${Math.round(1 / Math.max(1e-6, lastDt))}`;
    },
    0,
  );

  let lastDt = 1 / 60;
  registry.addAction(
    'commit',
    (ctx) => {
      lastDt = ctx.dt;
    },
    100,
  );

  // Camera updater (systems can write to camera.position)
  registry.addAction(
    'commit',
    () => {
      // no-op placeholder so commit ordering mirrors Titanium style
    },
    1000,
  );

  // Expose camera setter helpers via a pseudo-entity-free state object.
  // (Gameplay systems will mutate camera.position directly.)
  v3Set(camera.position, 0, 9, 9);

  return { device, camera, target, setGround, get asciiEnabled() { return asciiEnabled; } };
}

