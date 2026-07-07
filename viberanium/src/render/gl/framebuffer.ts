export type SceneFramebuffer = {
  colorTex: WebGLTexture;
  samples: number;
  width: number;
  height: number;
  resize: (w: number, h: number) => void;
  bind: () => void;
  resolve: () => void;
  bindDefault: () => void;
};

export function createSceneFramebuffer(gl: WebGL2RenderingContext, requestedSamples = 4): SceneFramebuffer {
  const msaaFbo = gl.createFramebuffer();
  const resolveFbo = gl.createFramebuffer();
  const colorTex = gl.createTexture();
  const colorRb = gl.createRenderbuffer();
  const depthRb = gl.createRenderbuffer();
  if (!msaaFbo || !resolveFbo || !colorTex || !colorRb || !depthRb) {
    throw new Error('Failed to create scene framebuffer');
  }

  const maxSamples = gl.getParameter(gl.MAX_SAMPLES) as number;
  const samples = Math.max(1, Math.min(requestedSamples, maxSamples));

  let width = 0;
  let height = 0;

  function alloc(w: number, h: number) {
    width = Math.max(1, w);
    height = Math.max(1, h);

    gl.bindRenderbuffer(gl.RENDERBUFFER, colorRb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, width, height);

    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);

    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`MSAA framebuffer incomplete: ${status}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, colorTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);

    status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Resolve framebuffer incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  return {
    colorTex,
    samples,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    resize: alloc,
    bind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFbo);
      gl.viewport(0, 0, width, height);
    },
    resolve() {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaaFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFbo);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    },
    bindDefault() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
  };
}
