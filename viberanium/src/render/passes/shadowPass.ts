import { type DrawItem } from '../types.ts';
import { ShaderProgram } from '../gl/shader.ts';
import { type Mat4 } from '../../math/mat4.ts';

export class ShadowPass {
  private readonly gl: WebGL2RenderingContext;
  private readonly depth: ShaderProgram;
  private readonly depthSkinned: ShaderProgram;

  constructor(gl: WebGL2RenderingContext, depth: ShaderProgram, depthSkinned: ShaderProgram) {
    this.gl = gl;
    this.depth = depth;
    this.depthSkinned = depthSkinned;
  }

  draw(lightViewProj: Mat4, groundItem: DrawItem | null, items: DrawItem[]) {
    const gl = this.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 4.0);

    const opaque: DrawItem[] = [];
    for (const it of items) {
      if (it.material.alphaMode !== 'BLEND') opaque.push(it);
    }

    opaque.sort((a, b) => {
      if (a.mesh.vao !== b.mesh.vao) return a.mesh.vao > b.mesh.vao ? 1 : -1;
      return 0;
    });

    let lastProgram: ShaderProgram | null = null;
    let lastVao: WebGLVertexArrayObject | null = null;

    const self = this;
    function useProgram(p: ShaderProgram) {
      if (lastProgram === p) return;
      lastProgram = p;
      p.use();
      gl.uniformMatrix4fv(p.u('u_lightViewProj'), false, lightViewProj);
      lastVao = null;
    }

    function drawItem(it: DrawItem) {
      const program = it.skin ? self.depthSkinned : self.depth;
      useProgram(program);
      gl.uniformMatrix4fv(program.u('u_model'), false, it.model);
      if (it.skin) {
        const count = Math.min(64, it.skin.jointCount);
        gl.uniformMatrix4fv(program.u('u_joints'), false, it.skin.palette.subarray(0, count * 16));
      }
      if (it.mesh.vao !== lastVao) {
        lastVao = it.mesh.vao;
        gl.bindVertexArray(lastVao);
      }
      gl.drawElements(gl.TRIANGLES, it.mesh.indexCount, gl.UNSIGNED_INT, 0);
    }

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
  }
}
