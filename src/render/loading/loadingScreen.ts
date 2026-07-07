import { ASCII_DENSITY, createGlyphAtlasTexture } from '../ascii/glyphAtlas.ts';
import { ShaderProgram } from '../gl/shader.ts';
import { loadingBokehFS, loadingBokehVS } from './loadingBokehShaders.ts';

const MAX_DPR = 2;
const FADE_MS = 420;

// Game palette: navy, cyan, burnt orange, vibrant orange, light grey.
const COLORS = {
  bgDeep: [18 / 255, 40 / 255, 56 / 255] as const,
  textMuted: [204 / 255, 204 / 255, 204 / 255] as const,
  accentCyan: [85 / 255, 178 / 255, 208 / 255] as const,
  accentBlue: [22 / 255, 48 / 255, 72 / 255] as const,
  accentPrimary: [74 / 255, 158 / 255, 192 / 255] as const,
  accentPurple: [189 / 255, 115 / 255, 38 / 255] as const,
  accentOrange: [235 / 255, 132 / 255, 23 / 255] as const,
};

export type LoadingScreen = {
  destroy: () => void;
};

export function createLoadingScreen(canvas: HTMLCanvasElement): LoadingScreen {
  const glCtx = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!glCtx) throw new Error('WebGL2 unavailable for loading screen');
  const gl = glCtx;

  const program = new ShaderProgram(gl, loadingBokehVS, loadingBokehFS);
  const glyphTex = createGlyphAtlasTexture(gl);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('createVertexArray failed');

  let running = true;
  let animating = false;
  let start = performance.now();
  let frameId = 0;
  let cssWidth = 0;
  let cssHeight = 0;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    cssWidth = width;
    cssHeight = height;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(time: number) {
    if (!running || cssWidth === 0 || cssHeight === 0) return;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(COLORS.bgDeep[0] * 0.92, COLORS.bgDeep[1] * 0.92, COLORS.bgDeep[2] * 0.92, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    program.use();
    gl.uniform1f(program.u('u_time'), reducedMotion ? 0 : time);
    gl.uniform2f(program.u('u_resolution'), cssWidth, cssHeight);
    gl.uniform1f(program.u('u_glyphCount'), ASCII_DENSITY.length);
    gl.uniform3f(program.u('u_bgDeep'), COLORS.bgDeep[0], COLORS.bgDeep[1], COLORS.bgDeep[2]);
    gl.uniform3f(program.u('u_textMuted'), COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    gl.uniform3f(program.u('u_accentCyan'), COLORS.accentCyan[0], COLORS.accentCyan[1], COLORS.accentCyan[2]);
    gl.uniform3f(program.u('u_accentBlue'), COLORS.accentBlue[0], COLORS.accentBlue[1], COLORS.accentBlue[2]);
    gl.uniform3f(program.u('u_accentPrimary'), COLORS.accentPrimary[0], COLORS.accentPrimary[1], COLORS.accentPrimary[2]);
    gl.uniform3f(program.u('u_accentPurple'), COLORS.accentPurple[0], COLORS.accentPurple[1], COLORS.accentPurple[2]);
    gl.uniform3f(program.u('u_accentOrange'), COLORS.accentOrange[0], COLORS.accentOrange[1], COLORS.accentOrange[2]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.uniform1i(program.u('u_glyphAtlas'), 0);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function loop(now: number) {
    if (!running) return;
    draw((now - start) / 1000);
    if (!reducedMotion) frameId = requestAnimationFrame(loop);
    else animating = false;
  }

  function startLoop() {
    if (!running || animating) return;
    if (reducedMotion) {
      draw(0);
      return;
    }
    animating = true;
    start = performance.now();
    frameId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    animating = false;
    cancelAnimationFrame(frameId);
  }

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };

  const onMotionPreference = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
    stopLoop();
    startLoop();
  };

  resize();
  startLoop();

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  motionQuery.addEventListener('change', onMotionPreference);

  return {
    destroy() {
      running = false;
      stopLoop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionPreference);
      gl.deleteTexture(glyphTex);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program.program);
    },
  };
}

export function fadeOutLoadingScreen(overlay: HTMLElement): Promise<void> {
  overlay.classList.add('loading-screen--fade-out');
  return new Promise((resolve) => {
    const done = () => {
      overlay.removeEventListener('transitionend', done);
      overlay.remove();
      resolve();
    };
    overlay.addEventListener('transitionend', done);
    window.setTimeout(done, FADE_MS + 80);
  });
}
