export type EntityId = number;

export type Components = Record<string, unknown>;

export type Entity = {
  id: EntityId;
  components: Components;
  onDeregister: Array<() => void>;
};

export function createEntity(id: EntityId): Entity {
  return { id, components: Object.create(null) as Components, onDeregister: [] };
}

