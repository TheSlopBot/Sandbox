import { DIRECTIONAL_LIGHT, type Camera, type DrawItem, type ShadowState } from '../types.ts';
import { ShaderProgram } from '../gl/shader.ts';

export class ForwardPass {
  private readonly lit: ShaderProgram;
  private readonly litSkinned: ShaderProgram;
  private readonly ground: ShaderProgram;
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, lit: ShaderProgram, litSkinned: ShaderProgram, ground: ShaderProgram) {
    this.gl = gl;
    this.lit = lit;
    this.litSkinned = litSkinned;
    this.ground = ground;
  }

  draw(camera: Camera, shadow: ShadowState, groundItem: DrawItem | null, items: DrawItem[]) {
    const gl = this.gl;
    // Soft daytime sky tint.
    gl.clearColor(0.56, 0.66, 0.82, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    function bindShadowUniforms(p: ShaderProgram) {
      gl.uniformMatrix4fv(p.u('u_lightViewProj'), false, shadow.lightViewProj);
      gl.uniform1f(p.u('u_shadowMapSize'), shadow.mapSize);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, shadow.map);
      gl.uniform1i(p.u('u_shadowMap'), 1);
    }

    // Ground first (opaque)
    if (groundItem) {
      this.ground.use();
      gl.uniformMatrix4fv(this.ground.u('u_viewProj'), false, camera.viewProj);
      gl.uniformMatrix4fv(this.ground.u('u_model'), false, groundItem.model);
      gl.uniform3f(this.ground.u('u_lightDir'), DIRECTIONAL_LIGHT.dir[0], DIRECTIONAL_LIGHT.dir[1], DIRECTIONAL_LIGHT.dir[2]);
      bindShadowUniforms(this.ground);
      gl.bindVertexArray(groundItem.mesh.vao);
      gl.disable(gl.BLEND);
      // Ground is a single quad; disable culling to avoid winding mismatches.
      gl.disable(gl.CULL_FACE);
      gl.drawElements(gl.TRIANGLES, groundItem.mesh.indexCount, gl.UNSIGNED_INT, 0);
      gl.enable(gl.CULL_FACE);
    }

    const opaque: DrawItem[] = [];
    const transparent: DrawItem[] = [];
    for (const it of items) {
      (it.material.alphaMode === 'BLEND' ? transparent : opaque).push(it);
    }

    // Sort opaque by material then mesh to reduce state changes
    opaque.sort((a, b) => {
      if (a.material.baseColorTex !== b.material.baseColorTex) return a.material.baseColorTex ? 1 : -1;
      if (a.mesh.vao !== b.mesh.vao) return a.mesh.vao > b.mesh.vao ? 1 : -1;
      return 0;
    });

    // Back-to-front for transparent
    transparent.sort((a, b) => b.sortZ - a.sortZ);

    let lastTex: WebGLTexture | null = null;
    let lastVao: WebGLVertexArrayObject | null = null;
    let lastProgram: ShaderProgram | null = null;

    const self = this;
    function useProgram(p: ShaderProgram) {
      if (lastProgram === p) return;
      lastProgram = p;
      p.use();
      gl.uniformMatrix4fv(p.u('u_viewProj'), false, camera.viewProj);
      gl.uniform3f(p.u('u_lightDir'), DIRECTIONAL_LIGHT.dir[0], DIRECTIONAL_LIGHT.dir[1], DIRECTIONAL_LIGHT.dir[2]);
      gl.uniform3f(p.u('u_ambient'), DIRECTIONAL_LIGHT.ambient[0], DIRECTIONAL_LIGHT.ambient[1], DIRECTIONAL_LIGHT.ambient[2]);
      gl.uniform3f(p.u('u_lightColor'), DIRECTIONAL_LIGHT.color[0], DIRECTIONAL_LIGHT.color[1], DIRECTIONAL_LIGHT.color[2]);
      bindShadowUniforms(p);
      // Force rebinding state
      lastTex = null;
      lastVao = null;
    }

    function bindItem(it: DrawItem) {
      const program = it.skin ? self.litSkinned : self.lit;
      useProgram(program);
      gl.uniformMatrix4fv(program.u('u_model'), false, it.model);
      gl.uniform4f(
        program.u('u_baseColorFactor'),
        it.material.baseColorFactor[0],
        it.material.baseColorFactor[1],
        it.material.baseColorFactor[2],
        it.material.baseColorFactor[3],
      );
      if (it.skin) {
        const count = Math.min(64, it.skin.jointCount);
        gl.uniformMatrix4fv(program.u('u_joints'), false, it.skin.palette.subarray(0, count * 16));
      }
      if (it.material.baseColorTex !== lastTex) {
        lastTex = it.material.baseColorTex;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, lastTex);
        gl.uniform1i(program.u('u_baseColorTex'), 0);
      }
      if (it.mesh.vao !== lastVao) {
        lastVao = it.mesh.vao;
        gl.bindVertexArray(lastVao);
      }
    }

    // Opaque pass
    gl.disable(gl.BLEND);
    for (const it of opaque) {
      bindItem(it);
      gl.drawElements(gl.TRIANGLES, it.mesh.indexCount, gl.UNSIGNED_INT, 0);
    }

    // Transparent pass
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const it of transparent) {
      bindItem(it);
      gl.drawElements(gl.TRIANGLES, it.mesh.indexCount, gl.UNSIGNED_INT, 0);
    }
    gl.depthMask(true);

    gl.bindVertexArray(null);
  }
}

