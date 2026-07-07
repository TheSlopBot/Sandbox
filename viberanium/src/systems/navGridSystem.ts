import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Collider } from '../components/collider.ts';
import { type NavGridComponent } from '../components/navGrid.ts';
import { updateNavGridBlocked } from '../navigation/navGrid.ts';

export const installNavGridSystem = (registry: Registry) => {
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.navGrid)) {
      const grid = e.components[COMPONENT_KEYS.navGrid] as NavGridComponent;
      if (!grid.dirty) continue;

      const colliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
      updateNavGridBlocked(grid, colliders, grid.agentRadius);
      grid.dirty = false;
    }
  }, 4);
};
