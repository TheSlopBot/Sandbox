import { useEffect, useState, type RefObject } from 'react';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { type ActorDocument, type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';
import { type ConstructSession } from '../../globals/bootstrap.ts';
import { type ConstructMode } from '../menu/AppMenu.tsx';
import { cloneActorDoc } from './useConstructSession.ts';

export const TRANSFORM_MODES: readonly PropEditorTransformMode[] = ['move', 'scale', 'rotate'];

const cycleTransformMode = (
  current: PropEditorTransformMode,
  direction: 1 | -1,
): PropEditorTransformMode => {
  const index = TRANSFORM_MODES.indexOf(current);
  const from = index < 0 ? 0 : index;
  const next = (from + direction + TRANSFORM_MODES.length) % TRANSFORM_MODES.length;
  return TRANSFORM_MODES[next]!;
};

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export type UseConstructModeParams = {
  active: boolean;
  sessionRef: RefObject<ConstructSession | null>;
  setPropDoc: (doc: PropDocument) => void;
  setActorDoc: (doc: ActorDocument) => void;
  setActorBoneNames: (names: string[]) => void;
  setSelectedPartId: (id: string | null) => void;
  setActorSelection: (selection: ActorEditorSelection) => void;
  setAnimPackUrl: (url: string | null) => void;
  setAvailableClipNames: (names: string[]) => void;
  setClipName: (name: string | null) => void;
  setStatus: (status: string) => void;
};

export const useConstructMode = ({
  active,
  sessionRef,
  setPropDoc,
  setActorDoc,
  setActorBoneNames,
  setSelectedPartId,
  setActorSelection,
  setAnimPackUrl,
  setAvailableClipNames,
  setClipName,
  setStatus,
}: UseConstructModeParams) => {
  const [mode, setMode] = useState<ConstructMode>('preview');
  const [transformMode, setTransformMode] = useState<PropEditorTransformMode>('move');

  useEffect(() => {
    if (!active) return;
    const session = sessionRef.current;
    if (!session) return;

    if (mode === 'prop') {
      void (async () => {
        const doc = await session.enterPropMode();
        setPropDoc({ ...doc, parts: [...doc.parts] });
        setSelectedPartId(null);
        setActorSelection(null);
        setStatus(
          doc.parts.length > 0
            ? 'Prop editor ready.'
            : 'Prop editor ready. Add assets or colliders.',
        );
      })();
      return;
    }

    if (mode === 'actor') {
      void (async () => {
        const doc = await session.enterActorMode();
        setActorDoc(cloneActorDoc(doc));
        setActorBoneNames(session.getActorBoneNames());
        setActorSelection(doc.character ? { kind: 'actor' } : null);
        setSelectedPartId(null);
        setAnimPackUrl(null);
        setAvailableClipNames([]);
        setClipName(null);
        session.clearAnimationPreview();
        setStatus(
          doc.character
            ? 'Actor editor ready.'
            : 'Actor editor ready. Add a character from the explorer.',
        );
      })();
      return;
    }
  }, [active, mode]);

  useEffect(() => {
    if (!active || (mode !== 'prop' && mode !== 'actor')) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableKeyboardTarget(e.target)) return;

      e.preventDefault();
      const direction: 1 | -1 = e.shiftKey ? -1 : 1;
      setTransformMode((current) => {
        const next = cycleTransformMode(current, direction);
        sessionRef.current?.setTransformMode(next);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, mode]);

  return { mode, setMode, transformMode, setTransformMode };
};

export type UseConstructModeResult = ReturnType<typeof useConstructMode>;
