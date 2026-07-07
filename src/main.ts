import './style.css';
import { createLoadingScreen, fadeOutLoadingScreen } from './render/loading/loadingScreen.ts';
import { bootstrap } from './startup/bootstrap.ts';

async function main() {
  const loadingOverlay = document.querySelector<HTMLDivElement>('#loading-screen');
  const loadingCanvas = document.querySelector<HTMLCanvasElement>('#loading');
  if (!loadingOverlay || !loadingCanvas) throw new Error('Missing loading screen elements');

  document.body.classList.add('is-loading');
  const loadingScreen = createLoadingScreen(loadingCanvas);

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
}

main();
