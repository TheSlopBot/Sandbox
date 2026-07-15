import { useEffect, useState, type RefObject } from 'react';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { type ActorDocument, type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';
import {
  type EquipmentDocument,
  type EquipmentEditorSelection,
} from '../../catalog/equipment/equipmentDocument.ts';
import { type LevelDocument } from '../../catalog/levels/levelDocument.ts';
import { type ConstructSession } from '../../globals/bootstrap.ts';
import { type ConstructLevelSelection } from '../../session/types.ts';
import { type ConstructMode } from '../menu/AppMenu.tsx';
import { cloneActorDoc, cloneEquipmentDoc } from './useConstructSession.ts';

export const TRANSFORM_MODES: readonly PropEditorTransformMode[] = ['move', 'scale', 'rotate'];

const cycleTransformMode = (
  current: PropEditorTransformMode,
  direction: 1 | -1,
  modes: readonly PropEditorTransformMode[] = TRANSFORM_MODES,
): PropEditorTransformMode => {
  const index = modes.indexOf(current);
  const from = index < 0 ? 0 : index;
  const next = (from + direction + modes.length) % modes.length;
  return modes[next]!;
};

const levelTransformModes = (
  scaleAllowed: boolean,
  rotateAllowed: boolean,
): readonly PropEditorTransformMode[] => {
  const modes: PropEditorTransformMode[] = ['move'];
  if (scaleAllowed) modes.push('scale');
  if (rotateAllowed) modes.push('rotate');
  return modes;
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
  levelScaleAllowed: boolean;
  levelRotateAllowed: boolean;
  equipmentRotateAllowed: boolean;
  setPropDoc: (doc: PropDocument) => void;
  setActorDoc: (doc: ActorDocument) => void;
  setActorBoneNames: (names: string[]) => void;
  setSelectedPartId: (id: string | null) => void;
  setActorSelection: (selection: ActorEditorSelection) => void;
  setEquipmentDoc: (doc: EquipmentDocument) => void;
  setEquipmentSelection: (selection: EquipmentEditorSelection) => void;
  setAnimPackUrl: (url: string | null) => void;
  setAvailableClipNames: (names: string[]) => void;
  setClipName: (name: string | null) => void;
  setStatus: (status: string) => void;
  setLevelDoc: (doc: LevelDocument) => void;
  setLevelSelection: (selection: ConstructLevelSelection) => void;
};

export const useConstructMode = ({
  active,
  sessionRef,
  levelScaleAllowed,
  levelRotateAllowed,
  equipmentRotateAllowed,
  setPropDoc,
  setActorDoc,
  setActorBoneNames,
  setSelectedPartId,
  setActorSelection,
  setEquipmentDoc,
  setEquipmentSelection,
  setAnimPackUrl,
  setAvailableClipNames,
  setClipName,
  setStatus,
  setLevelDoc,
  setLevelSelection,
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
        setEquipmentSelection({ kind: 'root' });
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
        setEquipmentSelection({ kind: 'root' });
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

    if (mode === 'equipment') {
      void (async () => {
        const doc = await session.enterEquipmentMode();
        setEquipmentDoc(cloneEquipmentDoc(doc));
        setEquipmentSelection({ kind: 'root' });
        setSelectedPartId(null);
        setActorSelection(null);
        setStatus(
          doc.mesh.url
            ? 'Equipment editor ready.'
            : 'Equipment editor ready. Add a mesh or colliders.',
        );
      })();
      return;
    }

    if (mode === 'level') {
      void (async () => {
        const doc = await session.enterLevelMode();
        setLevelDoc(doc);
        setLevelSelection({ instanceIds: [], groupId: null });
        setTransformMode((current) => {
          const next = current === 'scale' ? 'move' : current;
          session.setTransformMode(next);
          return next;
        });
        setStatus(
          doc.composition.props.length + doc.composition.actors.length > 0
            ? 'Level editor ready.'
            : 'Level editor ready. Add props or actors from the explorer.',
        );
      })();
      return;
    }
  }, [active, mode]);

  useEffect(() => {
    if (!active || mode !== 'level') return;
    if (transformMode === 'scale' && !levelScaleAllowed) {
      setTransformMode('move');
      sessionRef.current?.setTransformMode('move');
      return;
    }
    if (transformMode === 'rotate' && !levelRotateAllowed) {
      setTransformMode('move');
      sessionRef.current?.setTransformMode('move');
    }
  }, [active, mode, transformMode, levelScaleAllowed, levelRotateAllowed]);

  useEffect(() => {
    if (!active || mode !== 'equipment') return;
    if (transformMode === 'rotate' && !equipmentRotateAllowed) {
      setTransformMode('move');
      sessionRef.current?.setTransformMode('move');
    }
  }, [active, mode, transformMode, equipmentRotateAllowed]);

  useEffect(() => {
    if (
      !active ||
      (mode !== 'prop' && mode !== 'actor' && mode !== 'equipment' && mode !== 'level')
    ) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableKeyboardTarget(e.target)) return;

      e.preventDefault();
      const direction: 1 | -1 = e.shiftKey ? -1 : 1;
      const modes =
        mode === 'level'
          ? levelTransformModes(levelScaleAllowed, levelRotateAllowed)
          : mode === 'equipment'
            ? levelTransformModes(true, equipmentRotateAllowed)
            : TRANSFORM_MODES;
      setTransformMode((current) => {
        const next = cycleTransformMode(current, direction, modes);
        sessionRef.current?.setTransformMode(next);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, mode, levelScaleAllowed, levelRotateAllowed, equipmentRotateAllowed]);

  return { mode, setMode, transformMode, setTransformMode };
};

export type UseConstructModeResult = ReturnType<typeof useConstructMode>;
