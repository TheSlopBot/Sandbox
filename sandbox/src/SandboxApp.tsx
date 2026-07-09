import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createLoadingScreen,
  fadeOutLoadingScreen,
  type LoadingScreenColors,
} from 'viberanium';
import { bootstrap } from './startup/bootstrap.ts';
import './style.css';

export type SandboxAppProps = {
  active: boolean;
};

const LOADING_COLORS: LoadingScreenColors = {
  bgDeep: [18 / 255, 40 / 255, 56 / 255],
  textMuted: [204 / 255, 204 / 255, 204 / 255],
  accentCyan: [85 / 255, 178 / 255, 208 / 255],
  accentBlue: [22 / 255, 48 / 255, 72 / 255],
  accentPrimary: [74 / 255, 158 / 255, 192 / 255],
  accentPurple: [189 / 255, 115 / 255, 38 / 255],
  accentOrange: [235 / 255, 132 / 255, 23 / 255],
};

export const SandboxApp = ({ active }: SandboxAppProps) => {
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingOverlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<Awaited<ReturnType<typeof bootstrap>> | null>(null);

  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const controls = useMemo(
    () => [
      { key: 'Camera', text: 'Click to toggle' },
      { key: 'Move', text: 'WASD / Arrows' },
      { key: 'Jump', text: 'Space' },
      { key: 'ASCII', text: 'T' },
      { key: 'Reset', text: 'R' },
      { key: 'Scene', text: '1, 2' },
    ],
    [],
  );

  useEffect(() => {
    if (!active) {
      const session = sessionRef.current;
      if (session) {
        session.unload();
        sessionRef.current = null;
      }
      return;
    }
    if (sessionRef.current) return;

    const gameCanvas = gameCanvasRef.current;
    const loadingCanvas = loadingCanvasRef.current;
    const loadingOverlay = loadingOverlayRef.current;
    if (!gameCanvas || !loadingCanvas || !loadingOverlay) return;

    setBootError(null);
    setLoading(true);

    const loadingScreen = createLoadingScreen(loadingCanvas, { colors: LOADING_COLORS });

    void (async () => {
      try {
        sessionRef.current = await bootstrap(gameCanvas);
        setBootError(null);
      } catch (err) {
        setBootError(String(err));
      } finally {
        loadingScreen.destroy();
        await fadeOutLoadingScreen(loadingOverlay);
        setLoading(false);
      }
    })();
  }, [active]);

  return (
    <div className="sandbox-root" data-loading={loading}>
      <div ref={loadingOverlayRef} id="loading-screen" className="loading-screen" aria-hidden={!loading}>
        <canvas ref={loadingCanvasRef} id="loading" />
      </div>
      <canvas ref={gameCanvasRef} id="game" />
      <div id="controls">
        {bootError ? (
          <div className="row">Boot error: {bootError}</div>
        ) : (
          <>
            {controls.map((c) => (
              <div key={c.key} className="row">
                <span className="k">{c.key}</span> {c.text}
              </div>
            ))}
            <div className="row">
              <span className="k">FPS</span> <span id="fps">...</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

