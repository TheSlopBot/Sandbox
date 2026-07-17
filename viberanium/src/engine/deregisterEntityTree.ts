import { type Registry } from './registry.ts';
import { type EntityId } from './entity.ts';
import { COMPONENT_KEYS } from './componentKeys.ts';
import { type Children } from '../components/children.ts';

export const deregisterEntityTree = (registry: Registry, rootId: EntityId): void => {
  const entity = registry.get(rootId);
  if (!entity) return;

  const children = entity.components[COMPONENT_KEYS.children] as Children | undefined;
  if (children) {
    const ids = children.ids.slice();
    for (const childId of ids) deregisterEntityTree(registry, childId);
  }

  registry.deregister(rootId);
};
