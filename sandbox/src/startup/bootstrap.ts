import {
  useGame,
  createInput,
  installRenderPipeline,
  TextureCache,
  createAsciiPostProcessStage,
} from 'viberanium';
import { useTestScene } from '../scenes/testScene.ts';
import { useTestSceneAlt } from '../scenes/testSceneAlt.ts';
import { installSceneChangerSystem } from './sceneChangerSystem.ts';

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

  const asciiStage = createAsciiPostProcessStage(gl);
  pipeline.addPostProcess(asciiStage);

  game.registry.addAction('update', () => {
    if (input.pressed('KeyT')) asciiStage.enabled = !asciiStage.enabled;
  }, 0);

  const sceneDeps = { gl, input, pipeline, textures };
  const testScene = useTestScene(sceneDeps);
  const testSceneAlt = useTestSceneAlt(sceneDeps);

  const sceneChanger = installSceneChangerSystem(game.registry, {
    game,
    input,
    scenes: { test: testScene, alt: testSceneAlt },
    setActiveSceneRegistry: (registry) => { activeSceneRegistry = registry; },
  });

  game.setActiveScene(testScene);
  activeSceneRegistry = testScene.registry;
  sceneChanger.setCurrent(testScene);
  await testScene.load();

  game.registry.addAction('commit', () => { input.commitFrame(); }, 0);

  game.start();
};
