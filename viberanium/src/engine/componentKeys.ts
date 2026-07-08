export const COMPONENT_KEYS = {
  transform: 'transform',
  collider: 'collider',
  character: 'character',
  movementIntent: 'movementIntent',
  navGrid: 'navGrid',
  skeletalRig: 'skeletalRig',
  cameraFollow: 'cameraFollow',
  renderable: 'renderable',
  skin: 'skin',
  gltfNodeIndex: 'gltfNodeIndex',
  gltfProp: 'gltfProp',
} as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[keyof typeof COMPONENT_KEYS];
