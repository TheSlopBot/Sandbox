import { useEffect, useRef, useState } from 'react';
import {
  createLoadingScreen,
  fadeOutLoadingScreen,
} from 'viberanium';
import { LOADING_COLORS } from '../../ui/theme/loadingColors.ts';
import { bootstrap, type SandboxSession } from '../../globals/bootstrap.ts';
import { type LevelLocalStoreEntry } from '../../storage/levelLocalStore.ts';
import { PerformanceMenu } from '../../menus/performance/PerformanceMenu.tsx';
import { LevelSelectModal } from '../../menus/levels/LevelSelectModal.tsx';
import '../../ui/theme/style.css';

export type SandboxAppProps = {
  active: boolean;
};

export const SandboxApp = ({ active }: SandboxAppProps) => {
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingOverlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);

  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribeFps, setSubscribeFps] = useState<
    ((listener: (fps: number) => void) => () => void) | undefined
  >(undefined);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [levelEntries, setLevelEntries] = useState<LevelLocalStoreEntry[]>([]);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [switchingLevel, setSwitchingLevel] = useState(false);

  useEffect(() => {
    if (!active) return;

    const gameCanvas = gameCanvasRef.current;
    const loadingCanvas = loadingCanvasRef.current;
    const loadingOverlay = loadingOverlayRef.current;
    if (!gameCanvas || !loadingCanvas || !loadingOverlay) return;

    let cancelled = false;
    let unsubscribeLevelSelect: (() => void) | null = null;

    setBootError(null);
    setLoading(true);

    void (async () => {
      let loadingScreen: Awaited<ReturnType<typeof createLoadingScreen>> | null = null;
      try {
        loadingScreen = await createLoadingScreen(loadingCanvas, { colors: LOADING_COLORS });
        if (cancelled) return;

        const session = await bootstrap(gameCanvas);
        if (cancelled) {
          session.unload();
          return;
        }

        sessionRef.current = session;
        setSubscribeFps(() => session.subscribeFps);
        setCurrentLevelId(session.getCurrentLevelId());
        unsubscribeLevelSelect = session.subscribeLevelSelectRequest(() => {
          setLevelEntries(session.listLevels());
          setCurrentLevelId(session.getCurrentLevelId());
          setLevelModalOpen(true);
        });
        setBootError(null);
      } catch (err) {
        if (!cancelled) setBootError(String(err));
      } finally {
        loadingScreen?.destroy();
        if (!cancelled) {
          await fadeOutLoadingScreen(loadingOverlay);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;

      if (unsubscribeLevelSelect) unsubscribeLevelSelect();

      const session = sessionRef.current;
      if (session) {
        session.unload();
        sessionRef.current = null;
      }

      setSubscribeFps(undefined);
      setLoading(true);
      setLevelModalOpen(false);
    };
  }, [active]);

  const handleSelectLevel = (levelId: string) => {
    const session = sessionRef.current;
    if (!session) return;

    setSwitchingLevel(true);
    void session.switchToLevel(levelId).finally(() => {
      setSwitchingLevel(false);
      setCurrentLevelId(session.getCurrentLevelId());
      setLevelModalOpen(false);
    });
  };

  const handleImportFiles = async (files: FileList) => {
    const session = sessionRef.current;
    if (!session) return { imported: [], errors: [] };

    const result = await session.importLevelFiles(files);
    setLevelEntries(session.listLevels());
    return result;
  };

  return (
    <div className="sandbox-root" data-loading={loading}>
      <div ref={loadingOverlayRef} id="loading-screen" className="loading-screen" aria-hidden={!loading}>
        <canvas ref={loadingCanvasRef} id="loading" />
      </div>
      <canvas ref={gameCanvasRef} id="game" />
      <PerformanceMenu
        visible={active && !loading}
        bootError={bootError}
        subscribeFps={subscribeFps}
      />
      {levelModalOpen ? (
        <LevelSelectModal
          entries={levelEntries}
          currentLevelId={currentLevelId}
          switching={switchingLevel}
          onSelect={handleSelectLevel}
          onImportFiles={handleImportFiles}
          onClose={() => setLevelModalOpen(false)}
        />
      ) : null}
    </div>
  );
};
