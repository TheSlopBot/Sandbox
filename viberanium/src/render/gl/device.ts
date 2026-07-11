export type GLDevice = {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  resize: () => void;
  destroy: () => void;
};

export const createDevice = (canvas: HTMLCanvasElement): GLDevice => {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('WebGL2 not supported');
  const gl2: WebGL2RenderingContext = gl;

  gl2.enable(gl2.DEPTH_TEST);
  gl2.depthFunc(gl2.LEQUAL);
  gl2.enable(gl2.CULL_FACE);
  gl2.cullFace(gl2.BACK);

  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let sizeDirty = true;

  const measure = () => {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    sizeDirty = true;
  };

  measure();

  const onWindowResize = () => {
    measure();
  };

  window.addEventListener('resize', onWindowResize);

  const observer =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          measure();
        })
      : null;
  observer?.observe(canvas);

  const resize = () => {
    if (!sizeDirty) return;

    sizeDirty = false;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl2.viewport(0, 0, w, h);
    }
  };

  const destroy = () => {
    window.removeEventListener('resize', onWindowResize);
    observer?.disconnect();
  };

  return { gl: gl2, canvas, resize, destroy };
};
