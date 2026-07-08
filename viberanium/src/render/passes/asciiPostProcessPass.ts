import { ASCII_DENSITY } from '../ascii/glyphAtlas.ts';
import { type ShaderProgram } from '../gl/shader.ts';

export type AsciiPostProcessPass = {
  draw: (sceneTex: WebGLTexture, width: number, height: number, targetFramebuffer?: WebGLFramebuffer | null) => void;
  destroy: () => void;
};

export const createAsciiPostProcessPass = (
  gl: WebGL2RenderingContext,
  program: ShaderProgram,
  glyphTex: WebGLTexture,
): AsciiPostProcessPass => {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('createVertexArray failed');

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    gl.deleteVertexArray(vao);
    program.destroy();
  };

  return {
    draw: (sceneTex, width, height, targetFramebuffer = null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);

      program.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(program.u('u_scene'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glyphTex);
      gl.uniform1i(program.u('u_glyphAtlas'), 1);

      gl.uniform2f(program.u('u_resolution'), width, height);
      gl.uniform1f(program.u('u_glyphCount'), ASCII_DENSITY.length);

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
    },
    destroy,
  };
};
