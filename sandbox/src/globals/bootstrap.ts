import {
  useGame,
  createInput,
  createGltfCache,
  installRenderPipeline,
  createTextureCache,
  createSharedMeshCache,
  createAsciiPostProcessStage,
  type EngineOptimizationOptions,
  type Input,
  type RenderQualityPresetId,
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
import {
  createOptimizationForQualityChoice,
  readStoredQualityChoice,
  readStoredQualityOverrides,
  writeStoredQualityChoice,
  writeStoredQualityOverrides,
  type RenderQualityChoice,
  type RenderQualityOverrides,
} from '../catalog/ui/renderQuality.ts';
import { installSceneManager } from './sceneManager.ts';

export type LevelImportResult = {
  imported: string[];
  errors: string[];
};

export type SandboxSession = {
  unload: () => void;
  input: Input;
  optimization: EngineOptimizationOptions;
  qualityChoice: RenderQualityChoice;
  resolvedQualityPreset: RenderQualityPresetId;
  recommendedQualityPreset: RenderQualityPresetId;
  setQualityChoice: (choice: RenderQualityChoice) => void;
  setQualityOverrides: (overrides: RenderQualityOverrides) => void;
  getAsciiEnabled: () => boolean;
  setAsciiEnabled: (enabled: boolean) => void;
  subscribeAscii: (listener: (enabled: boolean) => void) => () => void;
  subscribeFps: (listener: (fps: number) => void) => () => void;
  listLevels: () => LevelLocalStoreEntry[];
  getCurrentLevelId: () => string | null;
  switchToLevel: (levelId: string) => Promise<void>;
  importLevelFiles: (files: FileList) => Promise<LevelImportResult>;
  setPaused: (paused: boolean) => void;
};

export type BootstrapOptions = {
  initialLevelId?: string | null;
};

export const bootstrap = async (
  canvas: HTMLCanvasElement,
  options: BootstrapOptions = {},
): Promise<SandboxSession> => {
  const game = useGame();
  const input = createInput(window, canvas);

  let activeSceneRegistry = game.registry;

  const storedChoice = readStoredQualityChoice();
  const qualityOverrides = readStoredQualityOverrides();
  let probeAdapter: GPUAdapter | null = null;
  if (navigator.gpu) {
    probeAdapter = await navigator.gpu.requestAdapter(
      /Windows/i.test(navigator.userAgent) ? undefined : { powerPreference: 'high-performance' },
    );
  }
  const quality = createOptimizationForQualityChoice(storedChoice, probeAdapter, qualityOverrides);
  if (storedChoice === 'auto') {
    writeStoredQualityChoice(quality.choice);
  }
  const optimization = quality.optimization;

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
  let showColliders = false;

  const notifyAscii = () => {
    for (const listener of asciiListeners) listener(asciiStage.enabled);
  };

  const removeAsciiToggle = game.registry.addAction('update', () => {
    if (!input.pressed('KeyT')) return;

    asciiStage.enabled = !asciiStage.enabled;
    notifyAscii();
  }, 0);

  const removeColliderToggle = game.registry.addAction('update', () => {
    if (!input.pressed('KeyY')) return;

    showColliders = !showColliders;
  }, 0);

  seedLocalLevelsIfEmpty(LEVEL_SEED_DOCUMENTS);

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
    getShowColliders: () => showColliders,
  });

  const preferredLevelId = options.initialLevelId;
  const initialLevelId =
    (preferredLevelId && resolveLocalLevel(preferredLevelId) ? preferredLevelId : null) ??
    LEVEL_SEED_DOCUMENTS[0]?.id ??
    null;
  if (initialLevelId) await sceneManager.switchTo(initialLevelId);

  game.setAfterUpdate(() => {
    input.consumeEdges();
  });
  const removeCommit = game.registry.addAction('commit', () => {
    input.commitFrame();
  }, 0);

  const waitSimulatedFrames = (count: number) =>
    new Promise<void>((resolve) => {
      if (count <= 0) {
        resolve();
        return;
      }

      let remaining = count;
      const remove = game.registry.addAction(
        'commit',
        () => {
          remaining -= 1;
          if (remaining > 0) return;

          remove();
          resolve();
        },
        1000,
      );
    });

  game.start();
  await waitSimulatedFrames(2);
  game.setPaused(true);

  return {
    input,
    optimization,
    qualityChoice: quality.choice,
    resolvedQualityPreset: quality.preset,
    recommendedQualityPreset: quality.recommended,
    setQualityChoice: (choice) => {
      writeStoredQualityChoice(choice);
      writeStoredQualityOverrides({});
    },
    setQualityOverrides: (overrides) => {
      writeStoredQualityOverrides(overrides);
    },
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
    setPaused: (paused) => {
      game.setPaused(paused);
    },
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
    unload: () => {
      game.stop();
      game.setActiveScene(null);
      game.setAfterUpdate(null);
      game.setSimFlush(null);

      sceneManager.destroy();
      removeCommit();
      removeAsciiToggle();
      removeColliderToggle();
      removeAsciiStage();
      asciiListeners.clear();
      input.destroy();

      meshes.destroy();
      textures.destroy();
      gltfCache.clear();
      pipeline.destroy();
    },
  };
};
