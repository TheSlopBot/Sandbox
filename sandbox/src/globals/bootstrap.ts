import {
  useGame,
  createInput,
  createGltfCache,
  installRenderPipeline,
  createTextureCache,
  createSharedMeshCache,
  createAsciiPostProcessStage,
  createEngineOptimizationOptions,
  type EngineOptimizationOptions,
} from 'viberanium';
import { parseLevelFile } from '../catalog/levels/levelFile.ts';
import { type LevelSeedDocument } from '../catalog/levels/levelSeed.ts';
import { LEVEL_SEED_DOCUMENTS } from '../catalog/levels/registry.ts';
import {
  type LevelLocalStoreEntry,
  listLocalLevelEntries,
  resolveLocalLevel,
  saveLocalLevel,
  seedLocalLevelsIfEmpty,
} from '../storage/levelLocalStore.ts';
import { installSceneManager } from './sceneManager.ts';

export type LevelImportResult = {
  imported: string[];
  errors: string[];
};

export type SandboxSession = {
  unload: () => void;
  optimization: EngineOptimizationOptions;
  getAsciiEnabled: () => boolean;
  setAsciiEnabled: (enabled: boolean) => void;
  subscribeAscii: (listener: (enabled: boolean) => void) => () => void;
  subscribeFps: (listener: (fps: number) => void) => () => void;
  listLevels: () => LevelLocalStoreEntry[];
  getCurrentLevelId: () => string | null;
  switchToLevel: (levelId: string) => Promise<void>;
  importLevelFiles: (files: FileList) => Promise<LevelImportResult>;
  subscribeLevelSelectRequest: (listener: () => void) => () => void;
};

export const bootstrap = async (canvas: HTMLCanvasElement): Promise<SandboxSession> => {
  const game = useGame();
  const input = createInput(window, canvas);

  let activeSceneRegistry = game.registry;

  const optimization = createEngineOptimizationOptions();

  const pipeline = await installRenderPipeline(game.registry, canvas, {
    getEntityRegistry: () => activeSceneRegistry,
    optimization,
  });
  const device = pipeline.device;
  const textures = createTextureCache(device);
  const gltfCache = createGltfCache();
  const meshes = createSharedMeshCache(device);

  const asciiStage = createAsciiPostProcessStage(device);
  const removeAsciiStage = pipeline.addPostProcess(asciiStage);
  const asciiListeners = new Set<(enabled: boolean) => void>();

  const notifyAscii = () => {
    for (const listener of asciiListeners) listener(asciiStage.enabled);
  };

  const removeAsciiToggle = game.registry.addAction('update', () => {
    if (!input.pressed('KeyT')) return;

    asciiStage.enabled = !asciiStage.enabled;
    notifyAscii();
  }, 0);

  seedLocalLevelsIfEmpty(LEVEL_SEED_DOCUMENTS);

  const levelSelectListeners = new Set<() => void>();

  const sceneManager = installSceneManager(game.registry, {
    game,
    input,
    pipeline,
    textures,
    gltfCache,
    meshes,
    device,
    optimization,
    setActiveSceneRegistry: (registry) => { activeSceneRegistry = registry; },
    resolveLevel: resolveLocalLevel,
    onRequestLevelSelect: () => {
      for (const listener of levelSelectListeners) listener();
    },
  });

  const initialLevelId = LEVEL_SEED_DOCUMENTS[0]?.id ?? null;
  if (initialLevelId) await sceneManager.switchTo(initialLevelId);

  game.setAfterUpdate(() => {
    input.consumeEdges();
  });
  const removeCommit = game.registry.addAction('commit', () => {
    input.commitFrame();
  }, 0);

  game.start();

  return {
    optimization,
    getAsciiEnabled: () => asciiStage.enabled,
    setAsciiEnabled: (enabled) => {
      asciiStage.enabled = enabled;
      notifyAscii();
    },
    subscribeAscii: (listener) => {
      asciiListeners.add(listener);
      listener(asciiStage.enabled);
      return () => {
        asciiListeners.delete(listener);
      };
    },
    subscribeFps: (listener) => pipeline.subscribeFps(listener),
    listLevels: () => listLocalLevelEntries(),
    getCurrentLevelId: () => sceneManager.getCurrentLevelId(),
    switchToLevel: (levelId) => sceneManager.switchTo(levelId),
    importLevelFiles: async (files) => {
      const imported: string[] = [];
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          parseLevelFile(text);
          const document = JSON.parse(text) as LevelSeedDocument;
          const saved = saveLocalLevel(document);
          imported.push(saved.id);
        } catch (err) {
          errors.push(`${file.name}: ${String(err)}`);
        }
      }

      return { imported, errors };
    },
    subscribeLevelSelectRequest: (listener) => {
      levelSelectListeners.add(listener);
      return () => {
        levelSelectListeners.delete(listener);
      };
    },
    unload: () => {
      game.stop();
      game.setActiveScene(null);
      game.setAfterUpdate(null);
      game.setSimFlush(null);

      sceneManager.destroy();
      removeCommit();
      removeAsciiToggle();
      removeAsciiStage();
      asciiListeners.clear();
      levelSelectListeners.clear();
      input.destroy();

      meshes.destroy();
      textures.destroy();
      gltfCache.clear();
      pipeline.destroy();
    },
  };
};
