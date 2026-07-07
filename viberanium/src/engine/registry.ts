import { type Entity, type EntityId, createEntity } from './entity.ts';

export type ActionContext = {
  dt: number;
  time: number;
};

export type ActionFn = (ctx: ActionContext) => void;

type ActionEntry = {
  name: string;
  fn: ActionFn;
  order: number;
};

export type Registry = {
  createBare: () => Entity;
  create: () => Entity;
  register: (entity: Entity) => void;
  deregister: (id: EntityId) => void;
  get: (id: EntityId) => Entity | undefined;
  all: () => IterableIterator<Entity>;
  view: (componentKey: string) => ReadonlyArray<Entity>;
  getComponentsByName: (componentKey: string) => ReadonlyArray<unknown>;
  addComponent: (entity: Entity, key: string, value: unknown) => void;
  removeComponent: (entity: Entity, key: string) => void;
  invalidateView: () => void;
  addAction: (name: string, fn: ActionFn, order?: number) => () => void;
  getActionsByName: (name: string) => ReadonlyArray<ActionFn>;
};

const stampEntityId = (entityId: EntityId, value: unknown): void => {
  if (value !== null && typeof value === 'object') {
    (value as { entityId?: EntityId }).entityId = entityId;
  }
};

export const useRegistry = (): Registry => {
  let nextId = 1;
  const entities = new Map<EntityId, Entity>();
  const registeredIds = new Set<EntityId>();
  const componentIndex = new Map<string, Map<EntityId, unknown[]>>();
  const actions = new Map<string, ActionEntry[]>();
  const actionCache = new Map<string, ActionFn[]>();
  const viewCache = new Map<string, Entity[]>();

  const invalidateViewCache = () => viewCache.clear();

  const invalidateViewForKey = (key: string) => viewCache.delete(key);

  const invalidateActions = (name: string) => actionCache.delete(name);

  const indexComponent = (entityId: EntityId, key: string, value: unknown): void => {
    let byEntity = componentIndex.get(key);
    if (!byEntity) {
      byEntity = new Map();
      componentIndex.set(key, byEntity);
    }
    const list = byEntity.get(entityId) ?? [];
    list.push(value);
    byEntity.set(entityId, list);
    stampEntityId(entityId, value);
    invalidateViewForKey(key);
  };

  const unindexComponent = (entityId: EntityId, key: string): void => {
    const byEntity = componentIndex.get(key);
    if (!byEntity) return;
    byEntity.delete(entityId);
    if (byEntity.size === 0) componentIndex.delete(key);
    invalidateViewForKey(key);
  };

  const unindexEntity = (entityId: EntityId): void => {
    for (const key of [...componentIndex.keys()]) {
      unindexComponent(entityId, key);
    }
  };

  const indexEntityComponents = (entity: Entity): void => {
    for (const [key, value] of Object.entries(entity.components)) {
      indexComponent(entity.id, key, value);
    }
  };

  const createBare = (): Entity => {
    const e = createEntity(nextId++);
    entities.set(e.id, e);
    return e;
  };

  const register = (entity: Entity): void => {
    if (!entities.has(entity.id)) entities.set(entity.id, entity);
    if (registeredIds.has(entity.id)) {
      unindexEntity(entity.id);
      indexEntityComponents(entity);
      return;
    }
    registeredIds.add(entity.id);
    indexEntityComponents(entity);
  };

  const create = (): Entity => createBare();

  const deregister = (id: EntityId) => {
    const e = entities.get(id);
    if (!e) return;
    for (const cb of e.onDeregister) cb();
    unindexEntity(id);
    registeredIds.delete(id);
    entities.delete(id);
    invalidateViewCache();
  };

  const get = (id: EntityId) => entities.get(id);

  const all = (): IterableIterator<Entity> => entities.values();

  const view = (componentKey: string): ReadonlyArray<Entity> => {
    const cached = viewCache.get(componentKey);
    if (cached) return cached;
    const byEntity = componentIndex.get(componentKey);
    const result: Entity[] = [];
    if (byEntity) {
      for (const entityId of byEntity.keys()) {
        const e = entities.get(entityId);
        if (e) result.push(e);
      }
    }
    viewCache.set(componentKey, result);
    return result;
  };

  const getComponentsByName = (componentKey: string): ReadonlyArray<unknown> => {
    const byEntity = componentIndex.get(componentKey);
    if (!byEntity) return [];
    const result: unknown[] = [];
    for (const instances of byEntity.values()) {
      for (const instance of instances) result.push(instance);
    }
    return result;
  };

  const addComponent = (entity: Entity, key: string, value: unknown): void => {
    entity.components[key] = value;
    if (!registeredIds.has(entity.id)) return;
    indexComponent(entity.id, key, value);
  };

  const removeComponent = (entity: Entity, key: string): void => {
    delete entity.components[key];
    if (!registeredIds.has(entity.id)) return;
    unindexComponent(entity.id, key);
  };

  const invalidateView = () => invalidateViewCache();

  const addAction = (name: string, fn: ActionFn, order = 0) => {
    const list = actions.get(name) ?? [];
    const entry: ActionEntry = { name, fn, order };
    list.push(entry);
    list.sort((a, b) => a.order - b.order);
    actions.set(name, list);
    invalidateActions(name);
    return () => {
      const curr = actions.get(name);
      if (!curr) return;
      const idx = curr.indexOf(entry);
      if (idx >= 0) curr.splice(idx, 1);
      invalidateActions(name);
    };
  };

  const getActionsByName = (name: string): ReadonlyArray<ActionFn> => {
    const cached = actionCache.get(name);
    if (cached) return cached;
    const list = actions.get(name) ?? [];
    const arr = list.map((e) => e.fn);
    actionCache.set(name, arr);
    return arr;
  };

  return {
    createBare,
    create,
    register,
    deregister,
    get,
    all,
    view,
    getComponentsByName,
    addComponent,
    removeComponent,
    invalidateView,
    addAction,
    getActionsByName,
  };
};
