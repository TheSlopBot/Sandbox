import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Registry } from '../engine/registry.ts';
import { type NavGridComponent } from '../components/navGrid.ts';
import { markCollisionStaticDirty } from '../systems/collisionStaticDirty.ts';

export const markNavGridDirty = (registry: Registry): void => {
  for (const e of registry.view(COMPONENT_KEYS.navGrid)) {
    (e.components[COMPONENT_KEYS.navGrid] as NavGridComponent).dirty = true;
  }
  markCollisionStaticDirty();
};

