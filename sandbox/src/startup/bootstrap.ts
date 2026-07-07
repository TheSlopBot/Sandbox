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
import { createLevelLoadingGate } from './levelLoadingGate.ts';

export const bootstrap = async () => {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) throw new Error('Missing #game canvas');

  const game = useGame();
  const input = createInput(window, canvas);

  let activeSceneRegistry = game.registry;

  const pipeline = installRenderPipeline(game.registry, canvas, {
    getEntityRegistry: () => activeSceneRegistry,
  });
  const gl = pipeline.device.gl;
  const textures = new TextureCache(gl);
  const gltfCache = createGltfCache();
  const loadingGate = createLevelLoadingGate();

  const asciiStage = createAsciiPostProcessStage(gl);
  pipeline.addPostProcess(asciiStage);

  game.registry.addAction('update', () => {
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
    loadingGate,
  });

  await sceneManager.switchTo('test');

  game.registry.addAction('commit', () => { input.commitFrame(); }, 0);

  game.start();
};
