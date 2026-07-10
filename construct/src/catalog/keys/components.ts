import { COMPONENT_KEYS } from 'viberanium';

export const CONSTRUCT_KEYS = {
  orbit: `${COMPONENT_KEYS.transform}.constructOrbit`,
  constructAnim: `${COMPONENT_KEYS.transform}.constructAnim`,
  orbitOriginMarker: `${COMPONENT_KEYS.transform}.constructOrbitOriginMarker`,
  propRoot: `${COMPONENT_KEYS.transform}.constructPropRoot`,
  propPart: `${COMPONENT_KEYS.transform}.constructPropPart`,
  propSelection: `${COMPONENT_KEYS.transform}.constructPropSelection`,
  gizmoMode: `${COMPONENT_KEYS.transform}.constructGizmoMode`,
  gizmoHandle: `${COMPONENT_KEYS.transform}.constructGizmoHandle`,
  colliderWireframe: `${COMPONENT_KEYS.transform}.constructColliderWireframe`,
  propAssetMaterials: `${COMPONENT_KEYS.transform}.constructPropAssetMaterials`,
} as const;

export type ConstructComponentKey = (typeof CONSTRUCT_KEYS)[keyof typeof CONSTRUCT_KEYS];
