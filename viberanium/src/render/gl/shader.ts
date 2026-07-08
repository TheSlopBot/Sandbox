export type UniformInfo = {
  loc: WebGLUniformLocation;
  name: string;
};

export type ShaderProgram = {
  readonly program: WebGLProgram;
  use: () => void;
  u: (name: string) => WebGLUniformLocation;
  destroy: () => void;
};

export const createShaderProgram = (gl: WebGL2RenderingContext, vsSource: string, fsSource: string): ShaderProgram => {
  const compile = (type: number, source: string): WebGLShader => {
    const s = gl.createShader(type);
    if (!s) throw new Error('createShader failed');

    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s) ?? 'unknown';
      gl.deleteShader(s);
      throw new Error(`Shader compile failed: ${info}`);
    }

    return s;
  };

  const uniforms = new Map<string, UniformInfo>();
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);

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

  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const u = gl.getActiveUniform(program, i);
    if (!u) continue;
    const name = u.name.replace(/\[0\]$/, '');
    const loc = gl.getUniformLocation(program, name);
    if (loc) uniforms.set(name, { loc, name });
  }

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    gl.deleteProgram(program);
  };

  return {
    program,
    use: () => gl.useProgram(program),
    u: (name) => {
      const info = uniforms.get(name);
      if (!info) throw new Error(`Missing uniform: ${name}`);
      return info.loc;
    },
    destroy,
  };
};

