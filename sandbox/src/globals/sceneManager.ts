import {
  type GpuDevice,
  type Registry,
  type Game,
  type Input,
  type RenderPipeline,
  type GltfCache,
  type TextureCache,
  type SharedMeshCache,
  type EngineOptimizationOptions,
} from 'viberanium';
import { collectLevelAssetUrls } from '../catalog/levels/collectAssetUrls.ts';
import { type LevelBuild } from '../catalog/levels/levelSeed.ts';
import { type SceneDeps } from '../scenes/common/createPlayableScene.ts';
import { useLevelScene } from '../scenes/common/useLevelScene.ts';

export type SceneManagerDeps = {
  game: Game;
  input: Input;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  meshes: SharedMeshCache;
  device: GpuDevice;
  optimization: EngineOptimizationOptions;
  setActiveSceneRegistry: (registry: Registry) => void;
  resolveLevel: (levelId: string) => LevelBuild | null;
};

export const installSceneManager = (gameRegistry: Registry, deps: SceneManagerDeps) => {
  let currentLevelId: string | null = null;
  let switching = false;
  let removeUpdateAction: (() => void) | null = null;

  const sceneDeps = (): SceneDeps => ({
    device: deps.device,
    input: deps.input,
    pipeline: deps.pipeline,
    textures: deps.textures,
    gltfCache: deps.gltfCache,
    meshes: deps.meshes,
    optimization: deps.optimization,
    staticPropBatcher: deps.pipeline.staticPropBatcher,
    setSimFlush: deps.game.setSimFlush,
  });

  const switchTo = async (levelId: string) => {
    if (switching) return;

    const build = deps.resolveLevel(levelId);
    if (!build) throw new Error(`Unknown level: ${levelId}`);

    switching = true;

    deps.game.setActiveScene(null);
    currentLevelId = null;

    await deps.gltfCache.preload(collectLevelAssetUrls(build.definition));

    const scene = useLevelScene(sceneDeps(), build.definition, build.aiPackages);
    deps.game.setActiveScene(scene);
    deps.setActiveSceneRegistry(scene.registry);
    currentLevelId = levelId;

    await scene.load();

    switching = false;
  };

  removeUpdateAction = gameRegistry.addAction('update', () => {
    if (switching) return;

    if (deps.input.pressed('Digit1')) void switchTo('testOne');

    if (deps.input.pressed('Digit2')) void switchTo('testTwo');

    if (deps.input.pressed('Digit3')) void switchTo('testThree');

    if (deps.input.pressed('Digit4')) void switchTo('testFour');
  }, 0);

  return {
    switchTo,
    getCurrentLevelId: () => currentLevelId,
    isSwitching: () => switching,
    destroy: () => {
      if (removeUpdateAction) removeUpdateAction();
      removeUpdateAction = null;
    },
  };
};
