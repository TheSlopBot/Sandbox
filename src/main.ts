import './style.css';
import { bootstrap } from './startup/bootstrap.ts';

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const hud = document.querySelector<HTMLDivElement>('#hud');
  if (hud) hud.innerText = `Boot error: ${String(err)}`;
});
