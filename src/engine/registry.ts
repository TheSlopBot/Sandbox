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
  create: () => Entity;
  deregister: (id: EntityId) => void;
  get: (id: EntityId) => Entity | undefined;
  all: () => IterableIterator<Entity>;

  addAction: (name: string, fn: ActionFn, order?: number) => () => void;
  getActionsByName: (name: string) => ReadonlyArray<ActionFn>;
};

export function useRegistry(): Registry {
  let nextId = 1;
  const entities = new Map<EntityId, Entity>();
  const actions = new Map<string, ActionEntry[]>();
  const actionCache = new Map<string, ActionFn[]>();

  function invalidate(name: string) {
    actionCache.delete(name);
  }

  function create(): Entity {
    const e = createEntity(nextId++);
    entities.set(e.id, e);
    return e;
  }

  function deregister(id: EntityId) {
    const e = entities.get(id);
    if (!e) return;
    for (const cb of e.onDeregister) cb();
    entities.delete(id);
  }

  function get(id: EntityId) {
    return entities.get(id);
  }

  function* all() {
    yield* entities.values();
  }

  function addAction(name: string, fn: ActionFn, order = 0) {
    const list = actions.get(name) ?? [];
    const entry: ActionEntry = { name, fn, order };
    list.push(entry);
    list.sort((a, b) => a.order - b.order);
    actions.set(name, list);
    invalidate(name);
    return () => {
      const curr = actions.get(name);
      if (!curr) return;
      const idx = curr.indexOf(entry);
      if (idx >= 0) curr.splice(idx, 1);
      invalidate(name);
    };
  }

  function getActionsByName(name: string): ReadonlyArray<ActionFn> {
    const cached = actionCache.get(name);
    if (cached) return cached;
    const list = actions.get(name) ?? [];
    const arr = list.map((e) => e.fn);
    actionCache.set(name, arr);
    return arr;
  }

  return { create, deregister, get, all, addAction, getActionsByName };
}

