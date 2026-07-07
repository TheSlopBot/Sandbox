export type ColorFramebuffer = {
  fbo: WebGLFramebuffer;
  colorTex: WebGLTexture;
  width: number;
  height: number;
  resize: (w: number, h: number) => void;
  bind: () => void;
  unbind: () => void;
};

export function createColorFramebuffer(gl: WebGL2RenderingContext): ColorFramebuffer {
  const fbo = gl.createFramebuffer();
  const colorTex = gl.createTexture();
  if (!fbo || !colorTex) throw new Error('Failed to create color framebuffer');

  let width = 0;
  let height = 0;

  function alloc(w: number, h: number) {
    width = Math.max(1, w);
    height = Math.max(1, h);

    gl.bindTexture(gl.TEXTURE_2D, colorTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Color framebuffer incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  return {
    fbo,
    colorTex,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    resize: alloc,
    bind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, width, height);
    },
    unbind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
  };
}
