import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  type PropDocument,
  parsePropDocument,
  propNeedsName,
  serializePropDocument,
} from '../../catalog/props/propDocument.ts';
import {
  type ActorDocument,
  type ActorEditorSelection,
  actorNeedsName,
  parseActorDocument,
  serializeActorDocument,
} from '../../catalog/actors/actorDocument.ts';
import {
  type LevelDocument,
  levelNeedsName,
  parseLevelDocument,
  serializeLevelDocument,
} from '../../catalog/levels/levelDocument.ts';
import { type ConstructLevelSelection } from '../../session/types.ts';
import {
  getLocalPropEntry,
  listLocalPropEntries,
  removeLocalProp,
  saveLocalProp,
  type PropLocalStoreEntry,
} from '../../storage/propLocalStore.ts';
import {
  getLocalActorEntry,
  listLocalActorEntries,
  removeLocalActor,
  saveLocalActor,
  type ActorLocalStoreEntry,
} from '../../storage/actorLocalStore.ts';
import {
  getLocalLevelEntry,
  listLocalLevelEntries,
  removeLocalLevel,
  saveLocalLevel,
  type LevelLocalStoreEntry,
} from '../../storage/levelLocalStore.ts';
import { type ConstructSession } from '../../globals/bootstrap.ts';
import { type ConstructMode } from '../menu/AppMenu.tsx';
import { cloneActorDoc } from './useConstructSession.ts';

type RenameIntent = 'edit' | 'save' | 'saveAs' | 'export';

const downloadPropDocument = (doc: PropDocument) => {
  const blob = new Blob([serializePropDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.id || 'untitled'}.prop`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
};

const downloadActorDocument = (doc: ActorDocument) => {
  const blob = new Blob([serializeActorDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.id || 'untitled'}.actor`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
};

const downloadLevelDocument = (doc: LevelDocument) => {
  const blob = new Blob([serializeLevelDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.id || 'untitled'}.level`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
};

export type UseConstructDocumentActionsParams = {
  mode: ConstructMode;
  sessionRef: RefObject<ConstructSession | null>;
  propDoc: PropDocument;
  setPropDoc: (doc: PropDocument) => void;
  actorDoc: ActorDocument;
  setActorDoc: (doc: ActorDocument) => void;
  setActorBoneNames: (names: string[]) => void;
  levelDoc: LevelDocument;
  setLevelDoc: (doc: LevelDocument) => void;
  setLevelSelection: (selection: ConstructLevelSelection) => void;
  setSelectedPartId: (id: string | null) => void;
  setActorSelection: (selection: ActorEditorSelection) => void;
  setStatus: (status: string) => void;
  resetAnimationPreview: () => void;
  onLocalLibraryChange?: () => void;
};

export const useConstructDocumentActions = ({
  mode,
  sessionRef,
  propDoc,
  setPropDoc,
  actorDoc,
  setActorDoc,
  setActorBoneNames,
  levelDoc,
  setLevelDoc,
  setLevelSelection,
  setSelectedPartId,
  setActorSelection,
  setStatus,
  resetAnimationPreview,
  onLocalLibraryChange,
}: UseConstructDocumentActionsParams) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [loadPropModalOpen, setLoadPropModalOpen] = useState(false);
  const [loadActorModalOpen, setLoadActorModalOpen] = useState(false);
  const [loadLevelModalOpen, setLoadLevelModalOpen] = useState(false);
  const [localPropEntries, setLocalPropEntries] = useState<PropLocalStoreEntry[]>([]);
  const [localActorEntries, setLocalActorEntries] = useState<ActorLocalStoreEntry[]>([]);
  const [localLevelEntries, setLocalLevelEntries] = useState<LevelLocalStoreEntry[]>([]);
  const [renameIntent, setRenameIntent] = useState<RenameIntent | null>(null);

  const currentPropDoc = () => sessionRef.current?.getPropDocument() ?? propDoc;
  const currentActorDoc = () => sessionRef.current?.getActorDocument() ?? actorDoc;
  const currentLevelDoc = () => sessionRef.current?.getLevelDocument() ?? levelDoc;

  const applyRenamedProp = (name: string) => {
    const session = sessionRef.current;
    if (!session) return null;

    const previousId = session.getPropDocument().id;
    const doc = session.renameProp(name);
    setPropDoc({ ...doc, parts: [...doc.parts] });

    if (previousId !== doc.id && getLocalPropEntry(previousId)) {
      removeLocalProp(previousId);
      saveLocalProp(doc);
      onLocalLibraryChange?.();
    }

    return doc;
  };

  const applyRenamedActor = (name: string) => {
    const session = sessionRef.current;
    if (!session) return null;

    const previousId = session.getActorDocument().id;
    const doc = session.renameActor(name);
    setActorDoc(cloneActorDoc(doc));

    if (previousId !== doc.id && getLocalActorEntry(previousId)) {
      removeLocalActor(previousId);
      saveLocalActor(doc);
      onLocalLibraryChange?.();
    }

    return doc;
  };

  const applyRenamedLevel = (name: string) => {
    const session = sessionRef.current;
    if (!session) return null;

    const previousId = session.getLevelDocument().id;
    const doc = session.renameLevel(name);
    setLevelDoc(doc);

    if (previousId !== doc.id && getLocalLevelEntry(previousId)) {
      removeLocalLevel(previousId);
      saveLocalLevel(doc);
    }

    return doc;
  };

  const persistLocalProp = (doc: PropDocument) => {
    const entry = saveLocalProp(doc);
    onLocalLibraryChange?.();
    setStatus(`Saved ${entry.displayName} to local storage`);
  };

  const persistLocalActor = (doc: ActorDocument) => {
    const entry = saveLocalActor(doc);
    onLocalLibraryChange?.();
    setStatus(`Saved ${entry.displayName} to local storage`);
  };

  const persistLocalLevel = (doc: LevelDocument) => {
    const entry = saveLocalLevel(doc);
    setStatus(`Saved ${entry.displayName} to local storage`);
  };

  const exportPropFile = (doc: PropDocument) => {
    const filename = downloadPropDocument(doc);
    setStatus(`Exported ${filename}`);
  };

  const exportActorFile = (doc: ActorDocument) => {
    const filename = downloadActorDocument(doc);
    setStatus(`Exported ${filename}`);
  };

  const exportLevelFile = (doc: LevelDocument) => {
    const filename = downloadLevelDocument(doc);
    setStatus(`Exported ${filename}`);
  };

  const performNew = () => {
    const session = sessionRef.current;
    if (!session) return;

    if (mode === 'prop') {
      const doc = session.newProp();
      setPropDoc(doc);
      setSelectedPartId(null);
      setStatus('New prop document.');
      return;
    }

    if (mode === 'actor') {
      const doc = session.newActor();
      setActorDoc(cloneActorDoc(doc));
      setActorBoneNames([]);
      setActorSelection(null);
      setStatus('New actor document.');
      return;
    }

    if (mode === 'level') {
      void (async () => {
        const doc = await session.newLevel();
        setLevelDoc(doc);
        setLevelSelection({ instanceIds: [], groupId: null });
        setStatus('New level document.');
      })();
    }
  };

  const onNew = () => {
    if (mode !== 'prop' && mode !== 'actor' && mode !== 'level') {
      setStatus('New is available in Prop, Actor, or Level mode.');
      return;
    }
    setConfirmNewOpen(true);
  };

  const onSave = () => {
    if (mode === 'prop') {
      const doc = currentPropDoc();
      if (propNeedsName(doc)) {
        setRenameIntent('save');
        return;
      }
      persistLocalProp(doc);
      return;
    }

    if (mode === 'actor') {
      const doc = currentActorDoc();
      if (actorNeedsName(doc)) {
        setRenameIntent('save');
        return;
      }
      persistLocalActor(doc);
      return;
    }

    if (mode === 'level') {
      const doc = currentLevelDoc();
      if (levelNeedsName(doc)) {
        setRenameIntent('save');
        return;
      }
      persistLocalLevel(doc);
      return;
    }

    setStatus('Save is available in Prop, Actor, or Level mode.');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.code !== 'KeyS') return;
      e.preventDefault();
      onSave();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const onSaveAs = () => {
    if (mode !== 'prop' && mode !== 'actor' && mode !== 'level') {
      setStatus('Save As is available in Prop, Actor, or Level mode.');
      return;
    }
    setRenameIntent('saveAs');
  };

  const onLoad = () => {
    if (mode === 'prop') {
      setLocalPropEntries(listLocalPropEntries());
      setLoadPropModalOpen(true);
      return;
    }

    if (mode === 'actor') {
      setLocalActorEntries(listLocalActorEntries());
      setLoadActorModalOpen(true);
      return;
    }

    if (mode === 'level') {
      setLocalLevelEntries(listLocalLevelEntries());
      setLoadLevelModalOpen(true);
      return;
    }

    setStatus('Load is available in Prop, Actor, or Level mode.');
  };

  const onImport = () => {
    if (mode !== 'prop' && mode !== 'actor' && mode !== 'level') {
      setStatus('Import is available in Prop, Actor, or Level mode.');
      return;
    }
    fileInputRef.current?.click();
  };

  const onExport = () => {
    if (mode === 'prop') {
      const doc = currentPropDoc();
      if (propNeedsName(doc)) {
        setRenameIntent('export');
        return;
      }
      exportPropFile(doc);
      return;
    }

    if (mode === 'actor') {
      const doc = currentActorDoc();
      if (actorNeedsName(doc)) {
        setRenameIntent('export');
        return;
      }
      exportActorFile(doc);
      return;
    }

    if (mode === 'level') {
      const doc = currentLevelDoc();
      if (levelNeedsName(doc)) {
        setRenameIntent('export');
        return;
      }
      exportLevelFile(doc);
      return;
    }

    setStatus('Export is available in Prop, Actor, or Level mode.');
  };

  const onRenameDocument = () => {
    if (mode !== 'prop' && mode !== 'actor' && mode !== 'level') return;
    setRenameIntent('edit');
  };

  const onRenameConfirm = (name: string) => {
    const intent = renameIntent;
    setRenameIntent(null);
    if (!intent) return;

    if (mode === 'prop') {
      if (intent === 'saveAs') {
        const session = sessionRef.current;
        if (!session) return;
        const doc = session.renameProp(name);
        setPropDoc({ ...doc, parts: [...doc.parts] });
        persistLocalProp(doc);
        return;
      }
      const doc = applyRenamedProp(name);
      if (!doc) return;
      if (intent === 'save') {
        persistLocalProp(doc);
        return;
      }
      if (intent === 'export') {
        exportPropFile(doc);
        return;
      }
      setStatus(`Renamed prop to ${doc.displayName}`);
      return;
    }

    if (mode === 'actor') {
      if (intent === 'saveAs') {
        const session = sessionRef.current;
        if (!session) return;
        const doc = session.renameActor(name);
        setActorDoc(cloneActorDoc(doc));
        persistLocalActor(doc);
        return;
      }
      const doc = applyRenamedActor(name);
      if (!doc) return;
      if (intent === 'save') {
        persistLocalActor(doc);
        return;
      }
      if (intent === 'export') {
        exportActorFile(doc);
        return;
      }
      setStatus(`Renamed actor to ${doc.displayName}`);
      return;
    }

    if (mode === 'level') {
      if (intent === 'saveAs') {
        const session = sessionRef.current;
        if (!session) return;
        const doc = session.renameLevel(name);
        setLevelDoc(doc);
        persistLocalLevel(doc);
        return;
      }
      const doc = applyRenamedLevel(name);
      if (!doc) return;
      if (intent === 'save') {
        persistLocalLevel(doc);
        return;
      }
      if (intent === 'export') {
        exportLevelFile(doc);
        return;
      }
      setStatus(`Renamed level to ${doc.displayName}`);
    }
  };

  const onLoadPropEntry = (entry: PropLocalStoreEntry) => {
    setLoadPropModalOpen(false);
    const session = sessionRef.current;
    if (!session) return;

    void (async () => {
      try {
        const loaded = await session.loadPropDocument(entry.document);
        setPropDoc({ ...loaded, parts: [...loaded.parts] });
        setSelectedPartId(null);
        resetAnimationPreview();
        setStatus(`Loaded ${entry.displayName}`);
      } catch (err) {
        setStatus(`Load error: ${String(err)}`);
      }
    })();
  };

  const onDeleteLocalPropEntry = (entry: PropLocalStoreEntry) => {
    removeLocalProp(entry.id);
    setLocalPropEntries(listLocalPropEntries());
    onLocalLibraryChange?.();
    setStatus(`Deleted ${entry.displayName} from local storage`);
  };

  const onLoadActorEntry = (entry: ActorLocalStoreEntry) => {
    setLoadActorModalOpen(false);
    const session = sessionRef.current;
    if (!session) return;

    void (async () => {
      try {
        const loaded = await session.loadActorDocument(entry.document);
        setActorDoc(cloneActorDoc(loaded));
        setActorBoneNames(session.getActorBoneNames());
        setActorSelection(loaded.character ? { kind: 'actor' } : null);
        resetAnimationPreview();
        setStatus(`Loaded ${entry.displayName}`);
      } catch (err) {
        setStatus(`Load error: ${String(err)}`);
      }
    })();
  };

  const onDeleteLocalActorEntry = (entry: ActorLocalStoreEntry) => {
    removeLocalActor(entry.id);
    setLocalActorEntries(listLocalActorEntries());
    onLocalLibraryChange?.();
    setStatus(`Deleted ${entry.displayName} from local storage`);
  };

  const onLoadLevelEntry = (entry: LevelLocalStoreEntry) => {
    setLoadLevelModalOpen(false);
    const session = sessionRef.current;
    if (!session) return;

    void (async () => {
      try {
        const loaded = await session.loadLevelDocument(entry.document);
        setLevelDoc(loaded);
        setLevelSelection({ instanceIds: [], groupId: null });
        setStatus(`Loaded ${entry.displayName}`);
      } catch (err) {
        setStatus(`Load error: ${String(err)}`);
      }
    })();
  };

  const onDeleteLocalLevelEntry = (entry: LevelLocalStoreEntry) => {
    removeLocalLevel(entry.id);
    setLocalLevelEntries(listLocalLevelEntries());
    setStatus(`Deleted ${entry.displayName} from local storage`);
  };

  const onFileInputChange = (file: File | null) => {
    if (!file) return;

    const session = sessionRef.current;
    if (!session) return;

    void (async () => {
      try {
        const text = await file.text();
        if (mode === 'actor') {
          const doc = parseActorDocument(text);
          const loaded = await session.loadActorDocument(doc);
          setActorDoc(cloneActorDoc(loaded));
          setActorBoneNames(session.getActorBoneNames());
          setActorSelection(loaded.character ? { kind: 'actor' } : null);
          resetAnimationPreview();
          setStatus(`Imported ${file.name}`);
          return;
        }

        if (mode === 'level') {
          const doc = parseLevelDocument(text);
          const loaded = await session.loadLevelDocument(doc);
          setLevelDoc(loaded);
          setLevelSelection({ instanceIds: [], groupId: null });
          setStatus(`Imported ${file.name}`);
          return;
        }

        const doc = parsePropDocument(text);
        const loaded = await session.loadPropDocument(doc);
        setPropDoc({ ...loaded, parts: [...loaded.parts] });
        setSelectedPartId(null);
        resetAnimationPreview();
        setStatus(`Imported ${file.name}`);
      } catch (err) {
        setStatus(`Import error: ${String(err)}`);
      }
    })();
  };

  return {
    fileInputRef,
    confirmNewOpen,
    setConfirmNewOpen,
    loadPropModalOpen,
    setLoadPropModalOpen,
    loadActorModalOpen,
    setLoadActorModalOpen,
    loadLevelModalOpen,
    setLoadLevelModalOpen,
    localPropEntries,
    localActorEntries,
    localLevelEntries,
    renameIntent,
    setRenameIntent,
    onNew,
    onSave,
    onSaveAs,
    onLoad,
    onImport,
    onExport,
    onRenameDocument,
    onRenameConfirm,
    performNew,
    onLoadPropEntry,
    onDeleteLocalPropEntry,
    onLoadActorEntry,
    onDeleteLocalActorEntry,
    onLoadLevelEntry,
    onDeleteLocalLevelEntry,
    onFileInputChange,
  };
};

export type UseConstructDocumentActionsResult = ReturnType<typeof useConstructDocumentActions>;
