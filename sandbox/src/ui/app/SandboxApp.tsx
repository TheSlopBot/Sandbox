import { useEffect, useRef, useState } from 'react';
import {
  createLoadingScreen,
  fadeOutLoadingScreen,
  type EngineOptimizationOptions,
  type RenderQualityPresetId,
} from 'viberanium';
import { LOADING_COLORS } from '../../ui/theme/loadingColors.ts';
import { bootstrap, type SandboxSession } from '../../globals/bootstrap.ts';
import { type LevelLocalStoreEntry } from '../../storage/levelLocalStore.ts';
import {
  readStoredQualityChoice,
  readStoredQualityOverrides,
  mergeQualityOverrides,
  type RenderQualityChoice,
  type RenderQualityOverrides,
} from '../../catalog/ui/renderQuality.ts';
import { PerformanceMenu } from '../../menus/performance/PerformanceMenu.tsx';
import { LevelSelectModal } from '../../menus/levels/LevelSelectModal.tsx';
import { MainMenuModal, type MainMenuView } from '../../menus/main/MainMenuModal.tsx';
import '../../ui/theme/style.css';

export type SandboxAppProps = {
  active: boolean;
  onOpenConstruct?: () => void;
};

export const SandboxApp = ({ active, onOpenConstruct }: SandboxAppProps) => {
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingOverlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);

  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootKey, setBootKey] = useState(0);
  const [subscribeFps, setSubscribeFps] = useState<
    ((listener: (fps: number) => void) => () => void) | undefined
  >(undefined);
  const [mainMenuOpen, setMainMenuOpen] = useState(true);
  const [mainMenuView, setMainMenuView] = useState<MainMenuView>('root');
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [levelEntries, setLevelEntries] = useState<LevelLocalStoreEntry[]>([]);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [switchingLevel, setSwitchingLevel] = useState(false);
  const [qualityChoice, setQualityChoice] = useState<RenderQualityChoice>(() => readStoredQualityChoice());
  const [resolvedPreset, setResolvedPreset] = useState<RenderQualityPresetId>('high');
  const [optimization, setOptimization] = useState<EngineOptimizationOptions | null>(null);

  const pendingMenuViewRef = useRef<MainMenuView | null>(null);

  useEffect(() => {
    if (!active) {
      setMainMenuOpen(true);
      setMainMenuView('root');
      setLevelModalOpen(false);
      pendingMenuViewRef.current = null;
      return;
    }

    const gameCanvas = gameCanvasRef.current;
    const loadingCanvas = loadingCanvasRef.current;
    const loadingOverlay = loadingOverlayRef.current;
    if (!gameCanvas || !loadingCanvas || !loadingOverlay) return;

    let cancelled = false;
    const restoreView = pendingMenuViewRef.current ?? 'root';
    pendingMenuViewRef.current = null;

    setBootError(null);
    setLoading(true);
    setMainMenuOpen(true);
    setMainMenuView(restoreView);
    setLevelModalOpen(false);

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
        setQualityChoice(session.qualityChoice);
        setResolvedPreset(session.resolvedQualityPreset);
        setOptimization(session.optimization);
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

      const session = sessionRef.current;
      if (session) {
        session.input.unlockPointer();
        session.unload();
        sessionRef.current = null;
      }

      setSubscribeFps(undefined);
      setLoading(true);
      setOptimization(null);
    };
  }, [active, bootKey]);

  const levelModalOpenRef = useRef(false);
  levelModalOpenRef.current = levelModalOpen;

  useEffect(() => {
    if (!active || loading) return;

    const onPointerLockChange = () => {
      const session = sessionRef.current;
      if (!session) return;

      if (session.input.pointerLocked()) {
        setMainMenuOpen(false);
        setMainMenuView('root');
        setLevelModalOpen(false);
        return;
      }

      if (levelModalOpenRef.current) return;

      setMainMenuOpen(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (sessionRef.current?.input.pointerLocked()) return;

      e.preventDefault();

      if (levelModalOpenRef.current) {
        setLevelModalOpen(false);
        setMainMenuOpen(true);
        setMainMenuView('root');
        return;
      }

      if (mainMenuView === 'settings') {
        setMainMenuView('root');
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, loading, mainMenuView]);

  const handleResume = () => {
    sessionRef.current?.input.lockPointer();
  };

  const handleLoadLevel = () => {
    const session = sessionRef.current;
    if (!session) return;

    setLevelEntries(session.listLevels());
    setCurrentLevelId(session.getCurrentLevelId());
    setMainMenuOpen(false);
    setLevelModalOpen(true);
  };

  const handleSelectLevel = (levelId: string) => {
    const session = sessionRef.current;
    if (!session) return;

    setSwitchingLevel(true);
    void session.switchToLevel(levelId).finally(() => {
      setSwitchingLevel(false);
      setCurrentLevelId(session.getCurrentLevelId());
      setLevelModalOpen(false);
      setMainMenuOpen(true);
      setMainMenuView('root');
    });
  };

  const handleImportFiles = async (files: FileList) => {
    const session = sessionRef.current;
    if (!session) return { imported: [], errors: [] };

    const result = await session.importLevelFiles(files);
    setLevelEntries(session.listLevels());
    return result;
  };

  const reloadWithSettingsOpen = () => {
    const session = sessionRef.current;
    session?.input.unlockPointer();
    pendingMenuViewRef.current = 'settings';
    setMainMenuOpen(true);
    setMainMenuView('settings');
    setBootKey((k) => k + 1);
  };

  const handleQualityChange = (choice: RenderQualityChoice) => {
    const session = sessionRef.current;
    if (!session) {
      setQualityChoice(choice);
      return;
    }

    const hadOverrides = Object.keys(readStoredQualityOverrides()).length > 0;
    if (choice === session.qualityChoice && !hadOverrides) return;

    session.setQualityChoice(choice);
    setQualityChoice(choice);
    reloadWithSettingsOpen();
  };

  const handleOptimizationPatch = (patch: RenderQualityOverrides) => {
    const session = sessionRef.current;
    if (!session) return;

    const next = mergeQualityOverrides(readStoredQualityOverrides(), patch);
    const skip =
      next.skeletonLod?.skipStartDist ?? session.optimization.skeletonLod.skipStartDist;
    const freeze =
      next.skeletonLod?.freezeDist ?? session.optimization.skeletonLod.freezeDist;
    if (freeze <= skip) {
      next.skeletonLod = { ...next.skeletonLod, freezeDist: skip + 4 };
    }

    session.setQualityOverrides(next);
    reloadWithSettingsOpen();
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
      {active && !loading && mainMenuOpen && !levelModalOpen && optimization ? (
        <MainMenuModal
          view={mainMenuView}
          qualityChoice={qualityChoice}
          resolvedPreset={resolvedPreset}
          optimization={optimization}
          onViewChange={setMainMenuView}
          onResume={handleResume}
          onLoadLevel={handleLoadLevel}
          onConstruct={() => {
            sessionRef.current?.input.unlockPointer();
            onOpenConstruct?.();
          }}
          onQualityChange={handleQualityChange}
          onOptimizationPatch={handleOptimizationPatch}
        />
      ) : null}
      {levelModalOpen ? (
        <LevelSelectModal
          entries={levelEntries}
          currentLevelId={currentLevelId}
          switching={switchingLevel}
          onSelect={handleSelectLevel}
          onImportFiles={handleImportFiles}
          onClose={() => {
            setLevelModalOpen(false);
            setMainMenuOpen(true);
            setMainMenuView('root');
          }}
        />
      ) : null}
    </div>
  );
};
