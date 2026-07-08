import { type DrawItem } from '../types.ts';
import { type ShaderProgram } from '../gl/shader.ts';
import { type Mat4 } from '../../math/mat4.ts';

export type ShadowPass = {
  draw: (lightViewProj: Mat4, groundItem: DrawItem | null, items: DrawItem[]) => void;
  destroy: () => void;
};

export const createShadowPass = (gl: WebGL2RenderingContext, depth: ShaderProgram, depthSkinned: ShaderProgram): ShadowPass => {
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    depth.destroy();
    depthSkinned.destroy();
  };

  const opaque: DrawItem[] = [];
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
    draw: (lightViewProj, groundItem, items) => {
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 4.0);

    opaque.length = 0;
    for (const it of items) {
      if (it.material.alphaMode !== 'BLEND' && it.castShadow) opaque.push(it);
    }

    opaque.sort((a, b) => {
      if (a.mesh.vao !== b.mesh.vao) return a.mesh.vao > b.mesh.vao ? 1 : -1;
      return 0;
    });

    let lastProgram: ShaderProgram | null = null;
    let lastVao: WebGLVertexArrayObject | null = null;

    const useProgram = (p: ShaderProgram) => {
      if (lastProgram === p) return;
      lastProgram = p;
      p.use();
      gl.uniformMatrix4fv(p.u('u_lightViewProj'), false, lightViewProj);
      lastVao = null;
    };

    const drawItem = (it: DrawItem) => {
      const program = it.skin ? depthSkinned : depth;
      useProgram(program);
      gl.uniformMatrix4fv(program.u('u_model'), false, it.model);
      if (it.skin) {
        gl.uniformMatrix4fv(program.u('u_joints'), false, jointsView(it.skin.palette, it.skin.jointCount));
      }
      if (it.mesh.vao !== lastVao) {
        lastVao = it.mesh.vao;
        gl.bindVertexArray(lastVao);
      }
      gl.drawElements(gl.TRIANGLES, it.mesh.indexCount, gl.UNSIGNED_INT, 0);
    };

    if (groundItem) {
      drawItem(groundItem);
    }

    gl.disable(gl.CULL_FACE);
    for (const it of opaque) {
      drawItem(it);
    }
    gl.enable(gl.CULL_FACE);

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindVertexArray(null);
    },
    destroy,
  };
};
