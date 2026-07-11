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
import { LEVEL_CATALOG } from '../catalog/levels/registry.ts';
import { installSceneManager } from './sceneManager.ts';

export type SandboxSession = {
  unload: () => void;
  optimization: EngineOptimizationOptions;
  getAsciiEnabled: () => boolean;
  setAsciiEnabled: (enabled: boolean) => void;
  subscribeAscii: (listener: (enabled: boolean) => void) => () => void;
  subscribeFps: (listener: (fps: number) => void) => () => void;
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

  const sceneManager = installSceneManager(game.registry, {
    game,
    input,
    pipeline,
    textures,
    gltfCache,
    meshes,
    device,
    catalog: LEVEL_CATALOG,
    optimization,
    setActiveSceneRegistry: (registry) => { activeSceneRegistry = registry; },
  });

  await sceneManager.switchTo('testOne');

  const removeCommit = game.registry.addAction('commit', () => { input.commitFrame(); }, 0);

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
      return () => { asciiListeners.delete(listener); };
    },
    subscribeFps: (listener) => pipeline.subscribeFps(listener),
    unload: () => {
      game.stop();
      game.setActiveScene(null);

      pipeline.destroy();
      meshes.destroy();
      sceneManager.destroy();
      removeCommit();
      removeAsciiToggle();
      removeAsciiStage();
      asciiListeners.clear();

      input.destroy();
    },
  };
};
