import './style.css';
import {
  createLoadingScreen,
  fadeOutLoadingScreen,
  type LoadingScreenColors,
} from 'viberanium';
import { bootstrap } from './startup/bootstrap.ts';

const LOADING_COLORS: LoadingScreenColors = {
  bgDeep: [18 / 255, 40 / 255, 56 / 255],
  textMuted: [204 / 255, 204 / 255, 204 / 255],
  accentCyan: [85 / 255, 178 / 255, 208 / 255],
  accentBlue: [22 / 255, 48 / 255, 72 / 255],
  accentPrimary: [74 / 255, 158 / 255, 192 / 255],
  accentPurple: [189 / 255, 115 / 255, 38 / 255],
  accentOrange: [235 / 255, 132 / 255, 23 / 255],
};

const main = async () => {
  const loadingOverlay = document.querySelector<HTMLDivElement>('#loading-screen');
  const loadingCanvas = document.querySelector<HTMLCanvasElement>('#loading');
  if (!loadingOverlay || !loadingCanvas) throw new Error('Missing loading screen elements');

  document.body.classList.add('is-loading');
  const loadingScreen = createLoadingScreen(loadingCanvas, { colors: LOADING_COLORS });

  try {
    await bootstrap();
    await fadeOutLoadingScreen(loadingOverlay);
    document.body.classList.remove('is-loading');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    const hud = document.querySelector<HTMLDivElement>('#hud');
    if (hud) hud.innerText = `Boot error: ${String(err)}`;
    document.body.classList.remove('is-loading');
  } finally {
    loadingScreen.destroy();
  }
};

main();
