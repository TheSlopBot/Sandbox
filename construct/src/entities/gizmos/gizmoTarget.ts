import {
  type BoneAttachment,
  type Entity,
  type LocalTransform,
  type RenderPipeline,
  type Registry,
  type SkeletalModel,
  type Transform,
  type Vec3,
  m4,
  m4Copy,
  m4Mul,
  updateWorldMatrix,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { type ConstructEditorSelection } from '../editorCommon/editorSelection.ts';
import { syncPartLocalToWorld } from '../editorCommon/syncPartLocal.ts';
import { syncAttachmentOffsetFromLocal } from '../actorEditor/spawnActorAttachment.ts';
import { type ConstructGizmoMode } from './gizmoMode.ts';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { type Axis } from './meshes.ts';
import {
  type GizmoFrame,
  currentSigns,
  gizmoOriginForPart,
  resolveGizmoFrame,
} from './gizmoFrame.ts';

export const findEditableTarget = (registry: Registry, targetId: string | null): Entity | null => {
  if (!targetId) return null;

  for (const e of registry.view(CONSTRUCT_KEYS.editableTarget)) {
    const target = e.components[CONSTRUCT_KEYS.editableTarget] as ConstructEditableTarget | undefined;
    if (target?.targetId === targetId) return e;
  }

  return null;
};

export const syncPartWorld = (registry: Registry, selected: Entity) => {
  const boneAtt = selected.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
  if (boneAtt) {
    syncAttachmentOffsetFromLocal(selected);

    const childOf = selected.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
    const t = selected.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!childOf || !t) return;

    const parent = registry.get(childOf.parentId);
    const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const parentModel = parent?.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
    if (!parentT || !parentModel) return;

    const boneNode = parentModel.bodyScene.nodes[boneAtt.boneNodeIndex];
    if (!boneNode) return;

    updateWorldMatrix(parentT);

    const renderRoot = m4();
    const boneWorld = m4();
    m4Copy(renderRoot, parentT.world);
    renderRoot[13]! += parentModel.visualYOffset;
    m4Mul(boneWorld, renderRoot, boneNode.worldM);
    m4Mul(t.world, boneWorld, boneAtt.localOffset);
    t.dirty = false;
    return;
  }

  syncPartLocalToWorld(registry, selected);
};

export const writePartToDocument = (
  doc: PropDocument,
  partId: string,
  local: LocalTransform,
): PropDocument => ({
  ...doc,
  parts: doc.parts.map((part) => {
    if (part.id !== partId) return part;
    return {
      ...part,
      position: [local.position[0], local.position[1], local.position[2]],
      rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
      scale: [local.scale[0], local.scale[1], local.scale[2]],
    };
  }),
});

export const commitPartLocal = (
  partId: string,
  local: LocalTransform,
  getDocument: () => PropDocument,
  setDocument: (doc: PropDocument) => void,
  onPartLocalCommit?: (partId: string, local: LocalTransform) => void,
) => {
  if (onPartLocalCommit) {
    onPartLocalCommit(partId, local);
    return;
  }

  setDocument(writePartToDocument(getDocument(), partId, local));
};

export type GizmoSelectionContext = {
  selected: Entity;
  targetId: string;
  mode: PropEditorTransformMode;
  origin: Vec3;
  frame: GizmoFrame;
  signs: Record<Axis, 1 | -1>;
};

export const resolveGizmoSelection = (
  registry: Registry,
  pipeline: RenderPipeline,
): GizmoSelectionContext | null => {
  const selEnt = registry.view(CONSTRUCT_KEYS.editorSelection)[0];
  const sel = selEnt?.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection | undefined;
  const gizmoMode = selEnt?.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
  const targetId = sel?.targetId ?? null;
  const selected = findEditableTarget(registry, targetId);
  const selectedT = selected?.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (!selected || !selectedT || !targetId) return null;

  const origin = gizmoOriginForPart(v3(), selected, selectedT);
  const mode = gizmoMode?.mode ?? 'move';
  const frame = resolveGizmoFrame(registry, selected);
  const signs = currentSigns(pipeline.camera.position, origin, frame);

  return { selected, targetId, mode, origin, frame, signs };
};
