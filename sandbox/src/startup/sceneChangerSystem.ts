import { type Registry, type Game, type Scene, type Input } from 'viberanium';

export type SceneChangerBindings = {
  test: Scene;
  alt: Scene;
};

export type SceneChangerDeps = {
  game: Game;
  input: Input;
  scenes: SceneChangerBindings;
  setActiveSceneRegistry: (registry: Registry) => void;
};

export const installSceneChangerSystem = (registry: Registry, deps: SceneChangerDeps) => {
  let current: Scene | null = null;
  let switching = false;

  const switchTo = async (scene: Scene) => {
    if (switching || current === scene) return;
    switching = true;
    deps.game.setActiveScene(scene);
    deps.setActiveSceneRegistry(scene.registry);
    current = scene;
    await scene.load();
    switching = false;
  };

  registry.addAction('update', () => {
    if (switching) return;
    if (deps.input.pressed('Digit1')) void switchTo(deps.scenes.test);
    if (deps.input.pressed('Digit2')) void switchTo(deps.scenes.alt);
  }, 0);

  return {
    setCurrent: (scene: Scene) => { current = scene; },
  };
};
