import { identityPartLocal, type PropColliderPart, type PropDefinition } from './propDefinition.ts';

export type SimplePropCollider =
  | { shape: 'box'; halfExtents: [number, number, number] }
  | { shape: 'cylinder'; radius: number; halfHeight: number }
  | { shape: 'sphere'; radius: number };

const buildColliderPart = (id: string, collider: SimplePropCollider): PropColliderPart => {
  const base = { ...identityPartLocal(), id: `${id}_collider`, kind: 'collider' as const };

  if (collider.shape === 'box') return { ...base, shape: 'box', halfExtents: collider.halfExtents };

  if (collider.shape === 'cylinder') {
    return { ...base, shape: 'cylinder', radius: collider.radius, halfHeight: collider.halfHeight };
  }

  return { ...base, shape: 'sphere', radius: collider.radius };
};

export const buildSimpleProp = (
  id: string,
  displayName: string,
  url: string,
  materialPrefix: string,
  collider: SimplePropCollider,
): PropDefinition => ({
  id,
  displayName,
  parts: [
    { ...identityPartLocal(), id: `${id}_mesh`, kind: 'asset', url, materialPrefix },
    buildColliderPart(id, collider),
  ],
});
