import { ShaderProgram } from '../gl/shader.ts';

export class PostProcessPass {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: ShaderProgram;
  private readonly vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, program: ShaderProgram) {
    this.gl = gl;
    this.program = program;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray failed');
    this.vao = vao;
  }

  draw(sceneTex: WebGLTexture, width: number, height: number, targetFramebuffer: WebGLFramebuffer | null = null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    this.program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(this.program.u('u_scene'), 0);
    gl.uniform2f(this.program.u('u_resolution'), width, height);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }
}
