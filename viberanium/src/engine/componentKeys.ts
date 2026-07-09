export const COMPONENT_KEYS = {
  transform: 'transform',
  collider: 'collider',
  character: 'character',
  movementIntent: 'movementIntent',
  navGrid: 'navGrid',
  skeletalModel: 'skeletalModel',
  meshDraws: 'meshDraws',
  staticModel: 'staticModel',
  childOf: 'childOf',
  children: 'children',
  localTransform: 'localTransform',
  boneAttachment: 'boneAttachment',
  animationClipMap: 'animationClipMap',
  animationStateMachine: 'animationStateMachine',
  cameraFollow: 'cameraFollow',
  renderable: 'renderable',
  renderGroup: 'renderGroup',
  skin: 'skin',
  gltfNodeIndex: 'gltfNodeIndex',
} as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[keyof typeof COMPONENT_KEYS];
