import { useEffect, useRef, useState } from 'react';
import {
  createLoadingScreen,
  fadeOutLoadingScreen,
  type LoadingScreenColors,
  type EngineOptimizationOptions,
} from 'viberanium';
import { bootstrap } from './startup/bootstrap.ts';
import { PerformanceMenu } from './menus/performance/PerformanceMenu.tsx';
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
  const [optimization, setOptimization] = useState<EngineOptimizationOptions | null>(null);
  const [asciiEnabled, setAsciiEnabled] = useState(false);

  useEffect(() => {
    if (!active) {
      const session = sessionRef.current;
      if (session) {
        session.unload();
        sessionRef.current = null;
      }

      setOptimization(null);
      setAsciiEnabled(false);
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
    let removeAsciiSubscription: (() => void) | null = null;

    void (async () => {
      try {
        const session = await bootstrap(gameCanvas);
        sessionRef.current = session;
        setOptimization(session.optimization);
        removeAsciiSubscription = session.subscribeAscii(setAsciiEnabled);
        setBootError(null);
      } catch (err) {
        setBootError(String(err));
      } finally {
        loadingScreen.destroy();
        await fadeOutLoadingScreen(loadingOverlay);
        setLoading(false);
      }
    })();

    return () => {
      removeAsciiSubscription?.();
    };
  }, [active]);

  return (
    <div className="sandbox-root" data-loading={loading}>
      <div ref={loadingOverlayRef} id="loading-screen" className="loading-screen" aria-hidden={!loading}>
        <canvas ref={loadingCanvasRef} id="loading" />
      </div>
      <canvas ref={gameCanvasRef} id="game" />
      <PerformanceMenu
        visible={!loading}
        bootError={bootError}
        optimization={optimization}
        asciiEnabled={asciiEnabled}
        onAsciiEnabledChange={(enabled) => sessionRef.current?.setAsciiEnabled(enabled)}
      />
    </div>
  );
};
