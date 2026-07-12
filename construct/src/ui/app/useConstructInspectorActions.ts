import { type RefObject } from 'react';
import { type LevelGroundVariant } from 'viberanium';
import { type PropDocument } from '../../catalog/props/propDocument.ts';
import { type ActorAiPackage, type ActorDocument, type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';
import { type LevelDocument } from '../../catalog/levels/levelDocument.ts';
import { type ConstructSession } from '../../globals/bootstrap.ts';
import { type ConstructLevelSelection, type ConstructTransformPatch } from '../../session/types.ts';
import { cloneActorDoc } from './useConstructSession.ts';

export type UseConstructInspectorActionsParams = {
  sessionRef: RefObject<ConstructSession | null>;
  actorDoc: ActorDocument;
  setPropDoc: (doc: PropDocument) => void;
  setActorDoc: (doc: ActorDocument) => void;
  setSelectedPartId: (id: string | null) => void;
  setActorSelection: (selection: ActorEditorSelection) => void;
  setLevelDoc: (doc: LevelDocument) => void;
  setLevelSelection: (selection: ConstructLevelSelection) => void;
  setStatus: (status: string) => void;
};

export const useConstructInspectorActions = ({
  sessionRef,
  actorDoc,
  setPropDoc,
  setActorDoc,
  setSelectedPartId,
  setActorSelection,
  setLevelDoc,
  setLevelSelection,
  setStatus,
}: UseConstructInspectorActionsParams) => {
  const propInspectorActions = {
    onRename: (partId: string, name: string) => {
      const doc = sessionRef.current?.updatePartName(partId, name);
      if (doc) setPropDoc({ ...doc, parts: [...doc.parts] });
    },
    onCommitLocal: (
      partId: string,
      patch: {
        position?: [number, number, number];
        scale?: [number, number, number];
        rotation?: [number, number, number, number];
      },
    ) => {
      const doc = sessionRef.current?.updatePartLocal(partId, patch);
      if (doc) setPropDoc({ ...doc, parts: [...doc.parts] });
    },
    onTextureVariantChange: (partId: string, url: string | null) => {
      const session = sessionRef.current;
      if (!session) return;

      void (async () => {
        try {
          const doc = await session.setPartTextureVariant(partId, url);
          setPropDoc({ ...doc, parts: [...doc.parts] });
        } catch (err) {
          setStatus(`Texture variant error: ${String(err)}`);
        }
      })();
    },
    onTagsChange: (partId: string, tags: string[]) => {
      const doc = sessionRef.current?.updatePartTags(partId, tags);
      if (doc) setPropDoc({ ...doc, parts: [...doc.parts] });
    },
    onDelete: (partId: string) => {
      const doc = sessionRef.current?.removePart(partId);
      if (!doc) return;
      setPropDoc({ ...doc, parts: [...doc.parts] });
      setSelectedPartId(null);
    },
  };

  const actorInspectorActions = {
    onActorTagsChange: (tags: string[]) => {
      const doc = sessionRef.current?.updateActorTags(tags);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onAiPackageChange: (aiPackage: ActorAiPackage) => {
      const doc = sessionRef.current?.setAiPackage(aiPackage);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onCharacterVariantChange: (url: string | null) => {
      const session = sessionRef.current;
      if (!session) return;
      void (async () => {
        try {
          const doc = await session.updateCharacterTextureVariant(url);
          setActorDoc(cloneActorDoc(doc));
        } catch (err) {
          setStatus(`Texture variant error: ${String(err)}`);
        }
      })();
    },
    onAttachmentRename: (id: string, name: string) => {
      const doc = sessionRef.current?.updateAttachmentName(id, name);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onAttachmentLocal: (
      id: string,
      patch: {
        position?: [number, number, number];
        scale?: [number, number, number];
        rotation?: [number, number, number, number];
      },
    ) => {
      const doc = sessionRef.current?.updateAttachmentLocal(id, patch);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onAttachmentTagsChange: (id: string, tags: string[]) => {
      const doc = sessionRef.current?.updateAttachmentTags(id, tags);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onAttachmentPlaceholderChange: (id: string, placeholder: boolean) => {
      const session = sessionRef.current;
      if (!session) return;
      void (async () => {
        try {
          const doc = await session.updateAttachmentPlaceholder(id, placeholder);
          setActorDoc(cloneActorDoc(doc));
        } catch (err) {
          setStatus(`Placeholder error: ${String(err)}`);
        }
      })();
    },
    onAttachmentVariantChange: (id: string, url: string | null) => {
      const session = sessionRef.current;
      if (!session) return;
      void (async () => {
        try {
          const doc = await session.updateAttachmentTextureVariant(id, url);
          setActorDoc(cloneActorDoc(doc));
        } catch (err) {
          setStatus(`Texture variant error: ${String(err)}`);
        }
      })();
    },
    onAttachmentDelete: (id: string) => {
      const doc = sessionRef.current?.removeAttachment(id);
      if (!doc) return;
      setActorDoc(cloneActorDoc(doc));
      setActorSelection(actorDoc.character ? { kind: 'actor' } : null);
    },
    onColliderRename: (id: string, name: string) => {
      const doc = sessionRef.current?.updateColliderName(id, name);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onColliderLocal: (
      id: string,
      patch: {
        position?: [number, number, number];
        scale?: [number, number, number];
        rotation?: [number, number, number, number];
      },
    ) => {
      const doc = sessionRef.current?.updateColliderLocal(id, patch);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onColliderFlagsChange: (id: string, flags: { collision?: boolean; hitbox?: boolean }) => {
      const doc = sessionRef.current?.updateColliderFlags(id, flags);
      if (doc) setActorDoc(cloneActorDoc(doc));
    },
    onColliderDelete: (id: string) => {
      const doc = sessionRef.current?.removeCollider(id);
      if (!doc) return;
      setActorDoc(cloneActorDoc(doc));
      setActorSelection(actorDoc.character ? { kind: 'actor' } : null);
    },
  };

  const levelInspectorActions = {
    onRenameInstance: (instanceId: string, name: string) => {
      const doc = sessionRef.current?.renameInstance(instanceId, name);
      if (doc) setLevelDoc(doc);
    },
    onRenameGroup: (groupId: string, name: string) => {
      const doc = sessionRef.current?.renameGroup(groupId, name);
      if (doc) setLevelDoc(doc);
    },
    onCommitLocal: (instanceId: string, patch: ConstructTransformPatch) => {
      const doc = sessionRef.current?.updateInstanceLocal(instanceId, patch);
      if (doc) setLevelDoc(doc);
    },
    onCommitGroupLocal: (groupId: string, patch: ConstructTransformPatch) => {
      const doc = sessionRef.current?.updateGroupLocal(groupId, patch);
      if (doc) setLevelDoc(doc);
    },
    onSetInstanceAiPackage: (instanceId: string, aiPackage: ActorAiPackage) => {
      const doc = sessionRef.current?.setInstanceAiPackage(instanceId, aiPackage);
      if (doc) setLevelDoc(doc);
    },
    onSetSimpleVariant: (instanceId: string, url: string | null) => {
      const session = sessionRef.current;
      if (!session) return;
      void (async () => {
        try {
          const doc = await session.setSimpleVariant(instanceId, url);
          setLevelDoc(doc);
        } catch (err) {
          setStatus(`Texture variant error: ${String(err)}`);
        }
      })();
    },
    onSetGroundPlaneVariant: (variant: LevelGroundVariant) => {
      const doc = sessionRef.current?.setGroundPlaneVariant(variant);
      if (doc) setLevelDoc(doc);
    },
    onRemoveInstances: (ids: string[]) => {
      const session = sessionRef.current;
      if (!session) return;
      const doc = session.removeInstances(ids);
      setLevelDoc(doc);
      setLevelSelection(session.getLevelSelection());
    },
    onCreateGroup: (instanceIds: string[], name?: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const doc = session.createGroup(instanceIds, name);
      setLevelDoc(doc);
      setLevelSelection(session.getLevelSelection());
    },
    onAssignToGroup: (instanceIds: string[], groupId: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const doc = session.assignToGroup(instanceIds, groupId);
      setLevelDoc(doc);
      setLevelSelection(session.getLevelSelection());
    },
    onUngroup: (groupId: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const doc = session.ungroup(groupId);
      setLevelDoc(doc);
      setLevelSelection(session.getLevelSelection());
    },
    onUngroupInstances: (instanceIds: string[]) => {
      const session = sessionRef.current;
      if (!session) return;
      const doc = session.ungroupInstances(instanceIds);
      setLevelDoc(doc);
      setLevelSelection(session.getLevelSelection());
    },
    onDeleteGroup: (groupId: string, removeMembers: boolean) => {
      const session = sessionRef.current;
      if (!session) return;
      const doc = session.deleteGroup(groupId, removeMembers);
      setLevelDoc(doc);
      setLevelSelection(session.getLevelSelection());
    },
  };

  return { propInspectorActions, actorInspectorActions, levelInspectorActions };
};

export type UseConstructInspectorActionsResult = ReturnType<typeof useConstructInspectorActions>;
