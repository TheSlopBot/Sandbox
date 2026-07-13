import {
  type BoneAttachment,
  type Entity,
  type LocalTransform,
  type RenderPipeline,
  type Registry,
  type Transform,
  type Vec3,
  type Collider,
  bakeColliderWorldFromLocal,
  m4,
  m4Mul,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { type ConstructEditorSelection } from '../editorCommon/editorSelection.ts';
import { syncPartLocalToWorld } from '../editorCommon/syncPartLocal.ts';
import { syncAttachmentOffsetFromLocal } from '../actorEditor/spawnActorAttachment.ts';
import { type ConstructGizmoMode, type ConstructGizmoMoveOrientation } from './gizmoMode.ts';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { type Axis } from './meshes.ts';
import {
  type GizmoFrame,
  boneWorldForAttachment,
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

    const t = selected.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!t) return;

    const boneWorld = m4();
    if (!boneWorldForAttachment(boneWorld, registry, selected, boneAtt)) return;

    m4Mul(t.world, boneWorld, boneAtt.localOffset);
    t.dirty = false;

    const collider = selected.components[COMPONENT_KEYS.collider] as Collider | undefined;
    if (collider) bakeColliderWorldFromLocal(collider, t.world);
    return;
  }

  const childOf = selected.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    if (parent?.components[COMPONENT_KEYS.boneAttachment]) {
      syncPartWorld(registry, parent);
    }
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
  moveOrientation: ConstructGizmoMoveOrientation;
  allowedAxes: Axis[] | null;
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

  syncPartWorld(registry, selected);

  const origin = gizmoOriginForPart(v3(), selected, selectedT);
  const mode = gizmoMode?.mode ?? 'move';
  const moveOrientation = gizmoMode?.moveOrientation ?? 'world';
  const allowedAxes = gizmoMode?.allowedAxes ?? null;
  const frame = resolveGizmoFrame(registry, selected, moveOrientation, mode);
  const signs = currentSigns(pipeline.camera.position, origin, frame);

  return { selected, targetId, mode, moveOrientation, allowedAxes, origin, frame, signs };
};
