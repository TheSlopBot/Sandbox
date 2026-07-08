import {
  type Registry,
  type Game,
  type Input,
  type RenderPipeline,
  type GltfCache,
  TextureCache,
} from 'viberanium';
import { type SceneDeps } from '../scenes/playableScene.ts';
import { useLevelScene } from '../levels/useLevelScene.ts';
import { collectLevelAssetUrls, type LevelDefinition } from '../levels/catalog.ts';

export type SceneManagerDeps = {
  game: Game;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  gl: WebGL2RenderingContext;
  catalog: Record<string, LevelDefinition>;
  setActiveSceneRegistry: (registry: Registry) => void;
};

export const installSceneManager = (gameRegistry: Registry, deps: SceneManagerDeps) => {
  let currentLevelId: string | null = null;
  let switching = false;

  const sceneDeps = (): SceneDeps => ({
    gl: deps.gl,
    input: deps.input,
    pipeline: deps.pipeline,
    textures: deps.textures,
    gltfCache: deps.gltfCache,
  });

  const switchTo = async (levelId: string) => {
    if (switching || currentLevelId === levelId) return;

    const definition = deps.catalog[levelId];
    if (!definition) throw new Error(`Unknown level: ${levelId}`);

    switching = true;

    deps.game.setActiveScene(null);
    currentLevelId = null;

    await deps.gltfCache.preload(collectLevelAssetUrls(definition));

    const scene = useLevelScene(sceneDeps(), definition);
    deps.game.setActiveScene(scene);
    deps.setActiveSceneRegistry(scene.registry);
    currentLevelId = levelId;

    await scene.load();

    switching = false;
  };

  gameRegistry.addAction('update', () => {
    if (switching) return;
    if (deps.input.pressed('Digit1')) void switchTo('test');
    if (deps.input.pressed('Digit2')) void switchTo('alt');
  }, 0);

  return {
    switchTo,
    getCurrentLevelId: () => currentLevelId,
    isSwitching: () => switching,
  };
};
