import {
  useGame,
  createInput,
  createGltfCache,
  installRenderPipeline,
  TextureCache,
  createAsciiPostProcessStage,
} from 'viberanium';
import { LEVEL_CATALOG } from '../levels/catalog.ts';
import { installSceneManager } from './sceneManager.ts';

export type SandboxSession = {
  unload: () => void;
};

export const bootstrap = async (canvas: HTMLCanvasElement): Promise<SandboxSession> => {
  const game = useGame();
  const input = createInput(window, canvas);

  let activeSceneRegistry = game.registry;

  const pipeline = installRenderPipeline(game.registry, canvas, {
    getEntityRegistry: () => activeSceneRegistry,
  });
  const gl = pipeline.device.gl;
  const textures = new TextureCache(gl);
  const gltfCache = createGltfCache();

  const asciiStage = createAsciiPostProcessStage(gl);
  const removeAsciiStage = pipeline.addPostProcess(asciiStage);

  const removeAsciiToggle = game.registry.addAction('update', () => {
    if (input.pressed('KeyT')) asciiStage.enabled = !asciiStage.enabled;
  }, 0);

  const sceneManager = installSceneManager(game.registry, {
    game,
    input,
    pipeline,
    textures,
    gltfCache,
    gl,
    catalog: LEVEL_CATALOG,
    setActiveSceneRegistry: (registry) => { activeSceneRegistry = registry; },
  });

  await sceneManager.switchTo('test');

  const removeCommit = game.registry.addAction('commit', () => { input.commitFrame(); }, 0);

  game.start();

  return {
    unload: () => {
      game.stop();
      game.setActiveScene(null);

      sceneManager.destroy();
      removeCommit();
      removeAsciiToggle();
      removeAsciiStage();

      input.destroy();
    },
  };
};
