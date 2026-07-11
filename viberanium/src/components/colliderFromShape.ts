import { v3 } from '../math/vec3.ts';
import {
  createBoxCollider,
  createCapsuleCollider,
  createCylinderCollider,
  createSphereCollider,
  type Collider,
} from '../components/collider.ts';

export type ColliderShapeSpec = {
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule';
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
  isStatic?: boolean;
};

export const colliderFromShape = (spec: ColliderShapeSpec): Collider => {
  const isStatic = spec.isStatic !== false;

  if (spec.shape === 'box') {
    return createBoxCollider({
      halfExtents: v3(
        spec.halfExtents?.[0] ?? 0.5,
        spec.halfExtents?.[1] ?? 0.5,
        spec.halfExtents?.[2] ?? 0.5,
      ),
      isStatic,
    });
  }

  if (spec.shape === 'cylinder') {
    return createCylinderCollider({
      radius: spec.radius ?? 0.35,
      halfHeight: spec.halfHeight ?? 0.5,
      isStatic,
    });
  }

  if (spec.shape === 'capsule') {
    return createCapsuleCollider({
      radius: spec.radius ?? 0.3,
      halfHeight: spec.halfHeight ?? 0.5,
      isStatic,
    });
  }

  return createSphereCollider({
    radius: spec.radius ?? 0.5,
    isStatic,
  });
};
