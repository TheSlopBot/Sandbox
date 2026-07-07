import { ASCII_DENSITY } from '../ascii/glyphAtlas.ts';
import { ShaderProgram } from '../gl/shader.ts';

export class AsciiPostProcessPass {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: ShaderProgram;
  private readonly glyphTex: WebGLTexture;
  private readonly vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, program: ShaderProgram, glyphTex: WebGLTexture) {
    this.gl = gl;
    this.program = program;
    this.glyphTex = glyphTex;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray failed');
    this.vao = vao;
  }

  draw(sceneTex: WebGLTexture, width: number, height: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    this.program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(this.program.u('u_scene'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glyphTex);
    gl.uniform1i(this.program.u('u_glyphAtlas'), 1);

    gl.uniform2f(this.program.u('u_resolution'), width, height);
    gl.uniform1f(this.program.u('u_glyphCount'), ASCII_DENSITY.length);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }
}
