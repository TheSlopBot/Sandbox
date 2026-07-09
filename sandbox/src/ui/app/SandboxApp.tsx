import { useEffect, useRef, useState } from 'react';
import {
  createLoadingScreen,
  fadeOutLoadingScreen,
} from 'viberanium';
import { LOADING_COLORS } from '../../ui/theme/loadingColors.ts';
import { bootstrap } from '../../globals/bootstrap.ts';
import { PerformanceMenu } from '../../menus/performance/PerformanceMenu.tsx';
import '../../ui/theme/style.css';

export type SandboxAppProps = {
  active: boolean;
};

export const SandboxApp = ({ active }: SandboxAppProps) => {
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingOverlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<Awaited<ReturnType<typeof bootstrap>> | null>(null);

  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        const session = await bootstrap(gameCanvas);
        sessionRef.current = session;
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
      <PerformanceMenu
        visible={!loading}
        bootError={bootError}
      />
    </div>
  );
};
