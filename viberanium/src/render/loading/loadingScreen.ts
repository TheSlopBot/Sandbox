import { ASCII_DENSITY, createGlyphAtlasTexture } from '../ascii/glyphAtlas.ts';
import { ShaderProgram } from '../gl/shader.ts';
import { loadingBokehFS, loadingBokehVS } from './loadingBokehShaders.ts';

const MAX_DPR = 2;
const FADE_MS = 420;

export type LoadingScreenColors = {
  bgDeep: readonly [number, number, number];
  textMuted: readonly [number, number, number];
  accentCyan: readonly [number, number, number];
  accentBlue: readonly [number, number, number];
  accentPrimary: readonly [number, number, number];
  accentPurple: readonly [number, number, number];
  accentOrange: readonly [number, number, number];
};

export type LoadingScreenOptions = {
  colors: LoadingScreenColors;
};

export type LoadingScreen = {
  destroy: () => void;
};

export const createLoadingScreen = (
  canvas: HTMLCanvasElement,
  options: LoadingScreenOptions,
): LoadingScreen => {
  const { colors } = options;
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

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    cssWidth = width;
    cssHeight = height;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (time: number) => {
    if (!running || cssWidth === 0 || cssHeight === 0) return;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(colors.bgDeep[0] * 0.92, colors.bgDeep[1] * 0.92, colors.bgDeep[2] * 0.92, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    program.use();
    gl.uniform1f(program.u('u_time'), reducedMotion ? 0 : time);
    gl.uniform2f(program.u('u_resolution'), cssWidth, cssHeight);
    gl.uniform1f(program.u('u_glyphCount'), ASCII_DENSITY.length);
    gl.uniform3f(program.u('u_bgDeep'), colors.bgDeep[0], colors.bgDeep[1], colors.bgDeep[2]);
    gl.uniform3f(program.u('u_textMuted'), colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    gl.uniform3f(program.u('u_accentCyan'), colors.accentCyan[0], colors.accentCyan[1], colors.accentCyan[2]);
    gl.uniform3f(program.u('u_accentBlue'), colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
    gl.uniform3f(program.u('u_accentPrimary'), colors.accentPrimary[0], colors.accentPrimary[1], colors.accentPrimary[2]);
    gl.uniform3f(program.u('u_accentPurple'), colors.accentPurple[0], colors.accentPurple[1], colors.accentPurple[2]);
    gl.uniform3f(program.u('u_accentOrange'), colors.accentOrange[0], colors.accentOrange[1], colors.accentOrange[2]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.uniform1i(program.u('u_glyphAtlas'), 0);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  const loop = (now: number) => {
    if (!running) return;
    draw((now - start) / 1000);
    if (!reducedMotion) frameId = requestAnimationFrame(loop);
    else animating = false;
  };

  const startLoop = () => {
    if (!running || animating) return;
    if (reducedMotion) {
      draw(0);
      return;
    }
    animating = true;
    start = performance.now();
    frameId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    animating = false;
    cancelAnimationFrame(frameId);
  };

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
};

export const fadeOutLoadingScreen = (overlay: HTMLElement): Promise<void> => {
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
};
