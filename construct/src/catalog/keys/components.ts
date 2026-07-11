import { COMPONENT_KEYS } from 'viberanium';

export const CONSTRUCT_KEYS = {
  orbit: `${COMPONENT_KEYS.transform}.constructOrbit`,
  constructAnim: `${COMPONENT_KEYS.transform}.constructAnim`,
  orbitOriginMarker: `${COMPONENT_KEYS.transform}.constructOrbitOriginMarker`,
  propRoot: `${COMPONENT_KEYS.transform}.constructPropRoot`,
  propOriginMarker: `${COMPONENT_KEYS.transform}.constructPropOriginMarker`,
  propPart: `${COMPONENT_KEYS.transform}.constructPropPart`,
  propSelection: `${COMPONENT_KEYS.transform}.constructPropSelection`,
  gizmoMode: `${COMPONENT_KEYS.transform}.constructGizmoMode`,
  gizmoHandle: `${COMPONENT_KEYS.transform}.constructGizmoHandle`,
  colliderWireframe: `${COMPONENT_KEYS.transform}.constructColliderWireframe`,
  propAssetMaterials: `${COMPONENT_KEYS.transform}.constructPropAssetMaterials`,
  actorRoot: `${COMPONENT_KEYS.transform}.constructActorRoot`,
  actorOriginMarker: `${COMPONENT_KEYS.transform}.constructActorOriginMarker`,
  actorCharacter: `${COMPONENT_KEYS.transform}.constructActorCharacter`,
  actorAttachment: `${COMPONENT_KEYS.transform}.constructActorAttachment`,
  actorCollider: `${COMPONENT_KEYS.transform}.constructActorCollider`,
  actorSelection: `${COMPONENT_KEYS.transform}.constructActorSelection`,
  skeletonOverlay: `${COMPONENT_KEYS.transform}.constructSkeletonOverlay`,
} as const;

export type ConstructComponentKey = (typeof CONSTRUCT_KEYS)[keyof typeof CONSTRUCT_KEYS];
