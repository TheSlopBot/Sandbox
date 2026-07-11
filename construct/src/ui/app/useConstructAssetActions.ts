import { type RefObject } from 'react';
import { type KaykitManifestEntry } from '../../catalog/manifest/kaykitManifest.ts';
import { type PropDocument } from '../../catalog/props/propDocument.ts';
import { type ActorDocument, type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';
import { type ConstructSession } from '../../globals/bootstrap.ts';
import { type ConstructMode } from '../menu/AppMenu.tsx';
import { cloneActorDoc } from './useConstructSession.ts';

export type UseConstructAssetActionsParams = {
  mode: ConstructMode;
  sessionRef: RefObject<ConstructSession | null>;
  entriesByPath: Map<string, KaykitManifestEntry>;
  actorSelection: ActorEditorSelection;
  setActorSelection: (selection: ActorEditorSelection) => void;
  setPropDoc: (doc: PropDocument) => void;
  setSelectedPartId: (id: string | null) => void;
  setActorDoc: (doc: ActorDocument) => void;
  setActorBoneNames: (names: string[]) => void;
  setAnimPackUrl: (url: string | null) => void;
  setAvailableClipNames: (names: string[]) => void;
  setClipName: (name: string | null) => void;
  setStatus: (status: string) => void;
};

export const useConstructAssetActions = ({
  mode,
  sessionRef,
  entriesByPath,
  actorSelection,
  setActorSelection,
  setPropDoc,
  setSelectedPartId,
  setActorDoc,
  setActorBoneNames,
  setAnimPackUrl,
  setAvailableClipNames,
  setClipName,
  setStatus,
}: UseConstructAssetActionsParams) => {
  const onAddAsset = (filePath: string) => {
    const session = sessionRef.current;
    const entry = entriesByPath.get(filePath);
    if (!session || !entry) return;

    const url = `${import.meta.env.BASE_URL}${entry.url}`;

    if (mode === 'prop') {
      void (async () => {
        try {
          const doc = await session.addAssetPart(url, 'prop');
          setPropDoc({ ...doc, parts: [...doc.parts] });
          const last = doc.parts[doc.parts.length - 1];
          setSelectedPartId(last?.id ?? null);
          if (last) session.selectPart(last.id);
          setStatus(`Added asset ${entry.path.split('/').slice(-1)[0] ?? entry.path}`);
        } catch (err) {
          setStatus(`Add asset error: ${String(err)}`);
        }
      })();
      return;
    }

    if (mode === 'actor' && actorSelection?.kind === 'bone') {
      const boneName = actorSelection.boneName;
      void (async () => {
        try {
          const doc = await session.addActorAttachment(url, boneName, 'attachment');
          setActorDoc(cloneActorDoc(doc));
          const last = doc.attachments[doc.attachments.length - 1];
          if (last) {
            setActorSelection({ kind: 'attachment', attachmentId: last.id });
          }
          setStatus(`Added attachment to ${boneName}`);
        } catch (err) {
          setStatus(`Add attachment error: ${String(err)}`);
        }
      })();
    }
  };

  const onAddCharacter = (filePath: string) => {
    const session = sessionRef.current;
    const entry = entriesByPath.get(filePath);
    if (!session || !entry || mode !== 'actor') return;

    const url = `${import.meta.env.BASE_URL}${entry.url}`;
    void (async () => {
      try {
        const doc = await session.setActorCharacter(url, 'character');
        setActorDoc(cloneActorDoc(doc));
        setActorBoneNames(session.getActorBoneNames());
        setActorSelection({ kind: 'actor' });
        session.selectActor({ kind: 'actor' });
        setAnimPackUrl(null);
        setAvailableClipNames([]);
        setClipName(null);
        session.clearAnimationPreview();
        setStatus(`Set character ${entry.path.split('/').slice(-1)[0] ?? entry.path}`);
      } catch (err) {
        setStatus(`Set character error: ${String(err)}`);
      }
    })();
  };

  const onAddCollider = (shape: 'box' | 'cylinder' | 'sphere' | 'capsule') => {
    const session = sessionRef.current;
    if (!session) return;

    if (mode === 'actor') {
      const parent =
        actorSelection?.kind === 'attachment'
          ? { kind: 'attachment' as const, attachmentId: actorSelection.attachmentId }
          : actorSelection?.kind === 'bone'
            ? { kind: 'bone' as const, boneName: actorSelection.boneName }
            : null;

      if (!parent) {
        setStatus('Select a bone or attachment before adding a collider');
        return;
      }

      const doc = session.addActorCollider(shape, parent);
      setActorDoc(cloneActorDoc(doc));
      const last = doc.colliders[doc.colliders.length - 1];
      if (last) {
        setActorSelection({ kind: 'collider', colliderId: last.id });
        session.selectActor({ kind: 'collider', colliderId: last.id });
      }
      setStatus(`Added ${shape} collider`);
      return;
    }

    const doc = session.addColliderPart(shape);
    setPropDoc({ ...doc, parts: [...doc.parts] });
    const last = doc.parts[doc.parts.length - 1];
    setSelectedPartId(last?.id ?? null);
    if (last) session.selectPart(last.id);
    setStatus(`Added ${shape} collider`);
  };

  return { onAddAsset, onAddCharacter, onAddCollider };
};

export type UseConstructAssetActionsResult = ReturnType<typeof useConstructAssetActions>;
