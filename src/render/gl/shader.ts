export type UniformInfo = {
  loc: WebGLUniformLocation;
  name: string;
};

export class ShaderProgram {
  readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, UniformInfo>();
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
    this.gl = gl;
    const vs = this.compile(gl.VERTEX_SHADER, vsSource);
    const fs = this.compile(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? 'unknown';
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${info}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;

    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const u = gl.getActiveUniform(program, i);
      if (!u) continue;
      const name = u.name.replace(/\[0\]$/, '');
      const loc = gl.getUniformLocation(program, name);
      if (loc) this.uniforms.set(name, { loc, name });
    }
  }

  use() {
    this.gl.useProgram(this.program);
  }

  u(name: string): WebGLUniformLocation {
    const info = this.uniforms.get(name);
    if (!info) throw new Error(`Missing uniform: ${name}`);
    return info.loc;
  }

  private compile(type: number, source: string): WebGLShader {
    const s = this.gl.createShader(type);
    if (!s) throw new Error('createShader failed');
    this.gl.shaderSource(s, source);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(s) ?? 'unknown';
      this.gl.deleteShader(s);
      throw new Error(`Shader compile failed: ${info}`);
    }
    return s;
  }
}

