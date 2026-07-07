export type GLDevice = {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  resize: () => void;
};

export function createDevice(canvas: HTMLCanvasElement): GLDevice {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('WebGL2 not supported');
  const gl2: WebGL2RenderingContext = gl;

  gl2.enable(gl2.DEPTH_TEST);
  gl2.depthFunc(gl2.LEQUAL);
  gl2.enable(gl2.CULL_FACE);
  gl2.cullFace(gl2.BACK);

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl2.viewport(0, 0, w, h);
    }
  }

  return { gl: gl2, canvas, resize };
}

