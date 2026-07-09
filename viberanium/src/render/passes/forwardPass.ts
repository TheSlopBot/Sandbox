import { DIRECTIONAL_LIGHT, type Camera, type DrawItem, type ShadowState } from '../types.ts';
import { type ShaderProgram } from '../gl/shader.ts';

export type ForwardPass = {
  draw: (camera: Camera, shadow: ShadowState, groundItem: DrawItem | null, items: DrawItem[]) => void;
  destroy: () => void;
};

const skinSortIds = new WeakMap<Float32Array, number>();
let nextSkinSortId = 1;
const skinSortId = (palette: Float32Array) => {
  let id = skinSortIds.get(palette);
  if (id === undefined) {
    id = nextSkinSortId++;
    skinSortIds.set(palette, id);
  }
  return id;
};

export const createForwardPass = (
  gl: WebGL2RenderingContext,
  lit: ShaderProgram,
  litSkinned: ShaderProgram,
  ground: ShaderProgram,
): ForwardPass => {
  const whiteTex = gl.createTexture();
  if (!whiteTex) throw new Error('Failed to create white texture');

  gl.bindTexture(gl.TEXTURE_2D, whiteTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    gl.deleteTexture(whiteTex);
    lit.destroy();
    litSkinned.destroy();
    ground.destroy();
  };

  const opaque: DrawItem[] = [];
  const transparent: DrawItem[] = [];
  const jointViewCache = new WeakMap<Float32Array, Float32Array>();

  const jointsView = (palette: Float32Array, jointCount: number) => {
    const floats = Math.min(64, jointCount) * 16;
    let view = jointViewCache.get(palette);
    if (!view || view.length !== floats) {
      view = palette.subarray(0, floats);
      jointViewCache.set(palette, view);
    }
    return view;
  };

  return {
    draw: (camera, shadow, groundItem, items) => {
    gl.clearColor(0.56, 0.66, 0.82, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const bindShadowUniforms = (p: ShaderProgram) => {
      gl.uniformMatrix4fv(p.u('u_lightViewProj'), false, shadow.lightViewProj);
      gl.uniform1f(p.u('u_shadowMapSize'), shadow.mapSize);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, shadow.map);
      gl.uniform1i(p.u('u_shadowMap'), 1);
    };

    const groundY = groundItem ? groundItem.model[13] : 0;
    const groundAlpha = groundItem && camera.position[1] < groundY ? 0.25 : 1.0;
    const groundIsTransparent = groundItem ? groundAlpha < 0.999 : false;

    if (groundItem && !groundIsTransparent) {
      ground.use();
      gl.uniformMatrix4fv(ground.u('u_viewProj'), false, camera.viewProj);
      gl.uniformMatrix4fv(ground.u('u_model'), false, groundItem.model);
      gl.uniform3f(ground.u('u_lightDir'), DIRECTIONAL_LIGHT.dir[0], DIRECTIONAL_LIGHT.dir[1], DIRECTIONAL_LIGHT.dir[2]);
      gl.uniform1f(ground.u('u_alpha'), 1.0);
      bindShadowUniforms(ground);
      gl.bindVertexArray(groundItem.mesh.vao);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.drawElements(gl.TRIANGLES, groundItem.mesh.indexCount, gl.UNSIGNED_INT, 0);
      gl.enable(gl.CULL_FACE);
    }

    opaque.length = 0;
    transparent.length = 0;
    for (const it of items) {
      (it.material.alphaMode === 'BLEND' ? transparent : opaque).push(it);
    }

    opaque.sort((a, b) => {
      const aSkin = a.skin?.palette;
      const bSkin = b.skin?.palette;
      if (aSkin !== bSkin) {
        if (!aSkin) return -1;
        if (!bSkin) return 1;
        return skinSortId(aSkin) - skinSortId(bSkin);
      }
      if (a.material.baseColorTex !== b.material.baseColorTex) return a.material.baseColorTex ? 1 : -1;
      if (a.mesh.vao !== b.mesh.vao) return a.mesh.vao > b.mesh.vao ? 1 : -1;
      return a.sortZ - b.sortZ;
    });

    transparent.sort((a, b) => b.sortZ - a.sortZ);

    let lastTex: WebGLTexture | null = null;
    let lastVao: WebGLVertexArrayObject | null = null;
    let lastProgram: ShaderProgram | null = null;
    let lastJoints: Float32Array | null = null;
    let lastBaseColor: DrawItem['material']['baseColorFactor'] | null = null;

    const useProgram = (p: ShaderProgram) => {
      if (lastProgram === p) return;
      lastProgram = p;
      p.use();
      gl.uniformMatrix4fv(p.u('u_viewProj'), false, camera.viewProj);
      gl.uniform3f(p.u('u_lightDir'), DIRECTIONAL_LIGHT.dir[0], DIRECTIONAL_LIGHT.dir[1], DIRECTIONAL_LIGHT.dir[2]);
      gl.uniform3f(p.u('u_ambient'), DIRECTIONAL_LIGHT.ambient[0], DIRECTIONAL_LIGHT.ambient[1], DIRECTIONAL_LIGHT.ambient[2]);
      gl.uniform3f(p.u('u_lightColor'), DIRECTIONAL_LIGHT.color[0], DIRECTIONAL_LIGHT.color[1], DIRECTIONAL_LIGHT.color[2]);
      bindShadowUniforms(p);
      lastTex = null;
      lastVao = null;
      lastJoints = null;
      lastBaseColor = null;
    };

    const bindItem = (it: DrawItem) => {
      const program = it.skin ? litSkinned : lit;
      useProgram(program);
      gl.uniformMatrix4fv(program.u('u_model'), false, it.model);
      if (it.material.baseColorFactor !== lastBaseColor) {
        lastBaseColor = it.material.baseColorFactor;
        gl.uniform4f(
          program.u('u_baseColorFactor'),
          lastBaseColor[0],
          lastBaseColor[1],
          lastBaseColor[2],
          lastBaseColor[3],
        );
      }
      if (it.skin) {
        const joints = jointsView(it.skin.palette, it.skin.jointCount);
        if (joints !== lastJoints) {
          lastJoints = joints;
          gl.uniformMatrix4fv(program.u('u_joints'), false, joints);
        }
      }
      const desiredTex = it.material.baseColorTex ?? whiteTex;
      if (desiredTex !== lastTex) {
        lastTex = desiredTex;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, desiredTex);
        gl.uniform1i(program.u('u_baseColorTex'), 0);
      }
      if (it.mesh.vao !== lastVao) {
        lastVao = it.mesh.vao;
        gl.bindVertexArray(lastVao);
      }
    };

    let lastDoubleSided = false;
    const applyCull = (doubleSided: boolean) => {
      if (doubleSided === lastDoubleSided) return;
      lastDoubleSided = doubleSided;
      if (doubleSided) gl.disable(gl.CULL_FACE);
      else gl.enable(gl.CULL_FACE);
    };

    gl.disable(gl.BLEND);
    for (const it of opaque) {
      bindItem(it);
      applyCull(it.material.doubleSided === true);
      gl.drawElements(gl.TRIANGLES, it.mesh.indexCount, gl.UNSIGNED_INT, 0);
    }

    if (groundItem && groundIsTransparent) {
      ground.use();
      gl.uniformMatrix4fv(ground.u('u_viewProj'), false, camera.viewProj);
      gl.uniformMatrix4fv(ground.u('u_model'), false, groundItem.model);
      gl.uniform3f(ground.u('u_lightDir'), DIRECTIONAL_LIGHT.dir[0], DIRECTIONAL_LIGHT.dir[1], DIRECTIONAL_LIGHT.dir[2]);
      gl.uniform1f(ground.u('u_alpha'), groundAlpha);
      bindShadowUniforms(ground);
      gl.bindVertexArray(groundItem.mesh.vao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.drawElements(gl.TRIANGLES, groundItem.mesh.indexCount, gl.UNSIGNED_INT, 0);
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const it of transparent) {
      bindItem(it);
      applyCull(it.material.doubleSided === true);
      gl.drawElements(gl.TRIANGLES, it.mesh.indexCount, gl.UNSIGNED_INT, 0);
    }
    gl.depthMask(true);

    if (lastDoubleSided) gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    },
    destroy,
  };
};
