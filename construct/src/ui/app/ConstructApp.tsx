import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MODEL_PATH } from '../../catalog/manifest/defaults.ts';
import { loadKaykitManifest } from '../../catalog/manifest/loadKaykitManifest.ts';
import {
  type KaykitManifest,
  type KaykitManifestEntry,
  type KaykitTextureVariant,
  type KaykitTreeNode,
} from '../../catalog/manifest/kaykitManifest.ts';
import {
  buildAssetTree,
  buildCharacterTree,
} from '../../catalog/manifest/filterManifestTrees.ts';
import { bootstrap, type ConstructSession } from '../../globals/bootstrap.ts';
import { AppMenu, type ConstructMode } from '../menu/AppMenu.tsx';
import { AssetExplorer, scopeExplorerDirPath } from '../explorer/AssetExplorer.tsx';
import { PropInspector } from '../inspector/PropInspector.tsx';
import { PropDetails } from '../inspector/PropDetails.tsx';
import { ActorInspector } from '../inspector/ActorInspector.tsx';
import { ActorDetails } from '../inspector/ActorDetails.tsx';
import { OrientationCube } from '../orientation/OrientationCube.tsx';
import { ViewerAnimHud } from '../viewer/ViewerAnimHud.tsx';
import { ConfirmModal } from '../modals/ConfirmModal.tsx';
import { LoadPropModal } from '../modals/LoadPropModal.tsx';
import { LoadActorModal } from '../modals/LoadActorModal.tsx';
import { RenamePropModal } from '../modals/RenamePropModal.tsx';
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
  type PropDocument,
  type PropEditorTransformMode,
  collectPropDocumentTags,
  createEmptyPropDocument,
  parsePropDocument,
  propNeedsName,
  serializePropDocument,
} from '../../catalog/props/propDocument.ts';
import {
  type ActorDocument,
  type ActorEditorSelection,
  actorNeedsName,
  createEmptyActorDocument,
  parseActorDocument,
  serializeActorDocument,
} from '../../catalog/actors/actorDocument.ts';
import '../theme/style.css';

export type ConstructAppProps = {
  active: boolean;
};

type RenameIntent = 'edit' | 'save' | 'export';

const expandVariantPaths = (
  expanded: Set<string>,
  filePath: string,
  scope: 'assets' | 'characters',
) => {
  const next = new Set(expanded);
  next.add(scopeExplorerDirPath(scope, ''));
  const parts = filePath.split('/');
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur ? `${cur}/${parts[i]}` : parts[i];
    next.add(scopeExplorerDirPath(scope, cur));
  }
  return next;
};

const getSearchWords = (raw: string) =>
  raw.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);

const matchesWords = (haystack: string, words: readonly string[]) => {
  if (words.length === 0) return true;

  const h = haystack.toLowerCase();
  for (const w of words) {
    if (!h.includes(w)) return false;
  }

  return true;
};

const collectDirPaths = (root: KaykitTreeNode) => {
  const out = new Set<string>();

  const stack: KaykitTreeNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;

    if (n.type === 'dir') {
      out.add(n.path);
      for (const c of n.children) stack.push(c);
    }
  }

  return out;
};

const TRANSFORM_MODES: readonly PropEditorTransformMode[] = ['move', 'scale', 'rotate'];

const resolveManifestEntryForAssetUrl = (
  assetUrl: string,
  entriesByPath: Map<string, KaykitManifestEntry>,
) => {
  const prefix = import.meta.env.BASE_URL;
  const relative = assetUrl.startsWith(prefix) ? assetUrl.slice(prefix.length) : assetUrl;

  for (const entry of entriesByPath.values()) {
    if (entry.url === relative) return entry;
  }

  return null;
};

const mapTextureVariants = (entry: KaykitManifestEntry | null): KaykitTextureVariant[] => {
  if (!entry) return [];

  return (entry.textureVariants ?? [])
    .filter((v) => !/^default$/i.test(v.label))
    .map((v) => ({
      label: v.label,
      url: `${import.meta.env.BASE_URL}${v.url}`,
    }));
};

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

const cloneActorDoc = (doc: ActorDocument): ActorDocument => ({
  ...doc,
  tags: [...doc.tags],
  character: doc.character ? { ...doc.character } : null,
  attachments: doc.attachments.map((a) => ({ ...a, tags: [...a.tags] })),
  colliders: doc.colliders.map((c) => ({
    ...c,
    parent: { ...c.parent },
    halfExtents: c.halfExtents ? [...c.halfExtents] as [number, number, number] : undefined,
  })),
});

export const ConstructApp = ({ active }: ConstructAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<ConstructSession | null>(null);
  const defaultLoadedRef = useRef(false);
  const prevExplorerQueryRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<ConstructMode>('preview');
  const [fileOpen, setFileOpen] = useState(false);
  const [manifest, setManifest] = useState<KaykitManifest | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KaykitManifestEntry | null>(null);
  const [status, setStatus] = useState<string>('Loading manifest…');
  const [animPackUrl, setAnimPackUrl] = useState<string | null>(null);
  const [clipName, setClipName] = useState<string | null>(null);
  const [availableClipNames, setAvailableClipNames] = useState<string[]>([]);
  const [textureVariants, setTextureVariants] = useState<KaykitTextureVariant[]>([]);
  const [textureVariantUrl, setTextureVariantUrl] = useState<string | null>(null);
  const [explorerQueryInput, setExplorerQueryInput] = useState<string>('');
  const [explorerQuery, setExplorerQuery] = useState<string>('');
  const [propDoc, setPropDoc] = useState<PropDocument>(() => createEmptyPropDocument());
  const [actorDoc, setActorDoc] = useState<ActorDocument>(() => createEmptyActorDocument());
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [actorSelection, setActorSelection] = useState<ActorEditorSelection>(null);
  const [actorBoneNames, setActorBoneNames] = useState<string[]>([]);
  const [transformMode, setTransformMode] = useState<PropEditorTransformMode>('move');
  const [colliderExpanded, setColliderExpanded] = useState(true);
  const [assetsExpanded, setAssetsExpanded] = useState(true);
  const [charactersExpanded, setCharactersExpanded] = useState(true);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [loadPropModalOpen, setLoadPropModalOpen] = useState(false);
  const [loadActorModalOpen, setLoadActorModalOpen] = useState(false);
  const [localPropEntries, setLocalPropEntries] = useState<PropLocalStoreEntry[]>([]);
  const [localActorEntries, setLocalActorEntries] = useState<ActorLocalStoreEntry[]>([]);
  const [renameIntent, setRenameIntent] = useState<RenameIntent | null>(null);

  useEffect(() => {
    if (!active) return;
    if (manifest) return;

    void (async () => {
      try {
        const m = await loadKaykitManifest();
        setManifest(m);
        setStatus('Select an asset from the explorer.');
      } catch (err) {
        setStatus(`Manifest error: ${String(err)}`);
      }
    })();
  }, [active, manifest]);

  useEffect(() => {
    if (!active) return;
    if (sessionRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    sessionRef.current = bootstrap(canvas);
  }, [active]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.setActive(active);
  }, [active]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.setPropDocumentListener((doc) => {
      setPropDoc({ ...doc, parts: [...doc.parts] });
    });
    session.setActorDocumentListener((doc) => {
      setActorDoc(cloneActorDoc(doc));
      setActorBoneNames(session.getActorBoneNames());
    });

    return () => {
      session.setPropDocumentListener(null);
      session.setActorDocumentListener(null);
    };
  }, [active]);

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

    defaultLoadedRef.current = false;
  }, [active, mode]);

  useEffect(() => {
    if (active) return;

    const session = sessionRef.current;
    if (!session) return;

    session.unload();
    sessionRef.current = null;
    defaultLoadedRef.current = false;
  }, [active]);

  useEffect(() => {
    if (!fileOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.construct-menuFile')) return;
      setFileOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [fileOpen]);

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

  const entriesByPath = useMemo(() => {
    if (!manifest) return new Map<string, KaykitManifestEntry>();
    return new Map(manifest.entries.map((e) => [e.path, e]));
  }, [manifest]);

  const compatibleAnimPacks = useMemo(() => {
    if (!manifest) return [];

    const characterEntry =
      mode === 'actor' && actorDoc.character
        ? resolveManifestEntryForAssetUrl(actorDoc.character.url, entriesByPath)
        : selectedEntry;

    if (!characterEntry || characterEntry.kind !== 'CharacterModel' || characterEntry.boneCount <= 0) {
      return [];
    }

    const seen = new Set<string>();

    return manifest.entries
      .filter((e) => e.kind === 'AnimationSet')
      .filter((e) => {
        const name = e.path.split('/').slice(-1)[0] ?? e.path;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }, [manifest, selectedEntry, mode, actorDoc.character, entriesByPath]);

  const canAnimatePreview = useMemo(
    () => !!selectedEntry && selectedEntry.kind === 'CharacterModel' && selectedEntry.boneCount > 0,
    [selectedEntry],
  );

  const canAnimateActor = useMemo(() => {
    if (!actorDoc.character) return false;
    const entry = resolveManifestEntryForAssetUrl(actorDoc.character.url, entriesByPath);
    return !!entry && entry.kind === 'CharacterModel' && entry.boneCount > 0;
  }, [actorDoc.character, entriesByPath]);

  const actorCharacterPath = useMemo(() => {
    if (!actorDoc.character) return null;
    const entry = resolveManifestEntryForAssetUrl(actorDoc.character.url, entriesByPath);
    return entry?.path ?? null;
  }, [actorDoc.character, entriesByPath]);

  const isFileMatch = useMemo(() => {
    const words = getSearchWords(explorerQuery);
    return (path: string, name: string) => matchesWords(`${name} ${path}`, words);
  }, [explorerQuery]);

  const assetTree = useMemo(() => {
    if (!manifest) return null;
    return buildAssetTree(manifest, entriesByPath, isFileMatch);
  }, [manifest, entriesByPath, isFileMatch]);

  const characterTree = useMemo(() => {
    if (!manifest) return null;
    return buildCharacterTree(manifest, entriesByPath, isFileMatch);
  }, [manifest, entriesByPath, isFileMatch]);

  useEffect(() => {
    const handle = window.setTimeout(() => setExplorerQuery(explorerQueryInput), 160);
    return () => window.clearTimeout(handle);
  }, [explorerQueryInput]);

  useEffect(() => {
    if (!assetTree && !characterTree) return;

    const prevQuery = prevExplorerQueryRef.current;
    prevExplorerQueryRef.current = explorerQuery;

    if (explorerQuery.length <= prevQuery.length) return;

    setExpanded((prev) => {
      const next = new Set(prev);
      if (assetTree) {
        for (const p of collectDirPaths(assetTree)) {
          next.add(scopeExplorerDirPath('assets', p));
        }
      }
      if (characterTree) {
        for (const p of collectDirPaths(characterTree)) {
          next.add(scopeExplorerDirPath('characters', p));
        }
      }
      return next;
    });
  }, [assetTree, characterTree, explorerQuery]);

  const canSwitchTexture = useMemo(() => textureVariants.length > 0, [textureVariants]);

  const viewerTitle = useMemo(() => {
    if (mode === 'actor') {
      if (!actorDoc.character) return 'Actor';
      return actorDoc.character.url.split('/').slice(-1)[0] ?? 'Actor';
    }

    if (!selectedEntry) return 'Viewer';
    return selectedEntry.path.split('/').slice(-1)[0] ?? selectedEntry.path;
  }, [selectedEntry, mode, actorDoc.character]);

  const loadEntry = async (entry: KaykitManifestEntry) => {
    const session = sessionRef.current;
    if (!session) return;

    const url = `${import.meta.env.BASE_URL}${entry.url}`;
    const altVariants = mapTextureVariants(entry);

    setStatus('Loading model…');
    setAvailableClipNames([]);
    setClipName(null);
    setAnimPackUrl(null);
    setTextureVariants(altVariants);
    setTextureVariantUrl(null);

    try {
      const loaded = await session.loadModel(url, altVariants);
      setTextureVariantUrl(loaded.activeTextureVariantUrl);
      setStatus(loaded.kind === 'CharacterModel' ? 'Character loaded.' : 'Asset loaded.');
    } catch (err) {
      setStatus(`Load error: ${String(err)}`);
    }
  };

  useEffect(() => {
    if (!active) return;
    if (!manifest) return;
    if (!sessionRef.current) return;
    if (defaultLoadedRef.current) return;
    if (mode !== 'preview') return;

    const entry = entriesByPath.get(DEFAULT_MODEL_PATH);
    if (!entry) {
      setStatus('Default asset missing from manifest.');
      return;
    }

    defaultLoadedRef.current = true;
    setSelectedPath(entry.path);
    setSelectedEntry(entry);
    setExpanded((prev) => expandVariantPaths(prev, entry.path, 'assets'));
    void loadEntry(entry);
  }, [active, manifest, entriesByPath, mode]);

  const currentPropDoc = () => sessionRef.current?.getPropDocument() ?? propDoc;
  const currentActorDoc = () => sessionRef.current?.getActorDocument() ?? actorDoc;

  const applyRenamedProp = (name: string) => {
    const session = sessionRef.current;
    if (!session) return null;

    const previousId = session.getPropDocument().id;
    const doc = session.renameProp(name);
    setPropDoc({ ...doc, parts: [...doc.parts] });

    if (previousId !== doc.id && getLocalPropEntry(previousId)) {
      removeLocalProp(previousId);
      saveLocalProp(doc);
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
    }

    return doc;
  };

  const persistLocalProp = (doc: PropDocument) => {
    const entry = saveLocalProp(doc);
    setStatus(`Saved ${entry.displayName} to local storage`);
  };

  const persistLocalActor = (doc: ActorDocument) => {
    const entry = saveLocalActor(doc);
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
    }
  };

  const onNew = () => {
    if (mode !== 'prop' && mode !== 'actor') {
      setStatus('New is available in Prop or Actor mode.');
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

    setStatus('Save is available in Prop or Actor mode.');
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

    setStatus('Load is available in Prop or Actor mode.');
  };

  const onImport = () => {
    if (mode !== 'prop' && mode !== 'actor') {
      setStatus('Import is available in Prop or Actor mode.');
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

    setStatus('Export is available in Prop or Actor mode.');
  };

  const onRenameDocument = () => {
    if (mode !== 'prop' && mode !== 'actor') return;
    setRenameIntent('edit');
  };

  const onRenameConfirm = (name: string) => {
    const intent = renameIntent;
    setRenameIntent(null);
    if (!intent) return;

    if (mode === 'prop') {
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
    }
  };

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

  const onToggleDir = (dirPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const selectedPart = propDoc.parts.find((p) => p.id === selectedPartId) ?? null;

  const selectedPartVariants = useMemo(() => {
    if (!selectedPart || selectedPart.kind !== 'asset') return [];
    const entry = resolveManifestEntryForAssetUrl(selectedPart.url, entriesByPath);
    return mapTextureVariants(entry);
  }, [selectedPart, entriesByPath]);

  const selectedPartVariantUrl =
    selectedPart?.kind === 'asset' ? (selectedPart.textureVariantUrl ?? null) : null;

  const actorDetailVariants = useMemo(() => {
    if (actorSelection?.kind === 'attachment') {
      const att = actorDoc.attachments.find((a) => a.id === actorSelection.attachmentId);
      if (!att) return [];
      return mapTextureVariants(resolveManifestEntryForAssetUrl(att.url, entriesByPath));
    }

    if (actorSelection?.kind === 'actor' && actorDoc.character) {
      return mapTextureVariants(
        resolveManifestEntryForAssetUrl(actorDoc.character.url, entriesByPath),
      );
    }

    return [];
  }, [actorSelection, actorDoc, entriesByPath]);

  const handleTextureVariantChange = (url: string | null) => {
    setTextureVariantUrl(url);

    const session = sessionRef.current;
    if (!session) return;

    void (async () => {
      try {
        await session.setTextureVariant(url);
      } catch (err) {
        setStatus(`Texture variant error: ${String(err)}`);
      }
    })();
  };

  const handleAnimPackChange = (url: string | null) => {
    setAnimPackUrl(url);

    const session = sessionRef.current;
    if (!session) return;

    if (!url) {
      session.clearAnimationPreview();
      setAvailableClipNames([]);
      setClipName(null);
      return;
    }

    setStatus('Loading animation pack…');
    void (async () => {
      try {
        const loaded = await session.loadAnimationPack(`${import.meta.env.BASE_URL}${url}`);
        setAvailableClipNames(loaded.clipNames);
        const nextClip = loaded.clipNames[0] ?? null;
        setClipName(nextClip);
        if (nextClip) session.applyClip(nextClip);
        setStatus('Ready.');
      } catch (err) {
        setStatus(`Animation load error: ${String(err)}`);
      }
    })();
  };

  const handleClipChange = (next: string | null) => {
    setClipName(next);

    const session = sessionRef.current;
    if (!session) return;

    if (!next) {
      session.resetToBindPose();
      return;
    }

    session.applyClip(next);
  };

  const handleAnimReset = () => {
    const session = sessionRef.current;
    if (!session) return;

    session.clearAnimationPreview();
    setAnimPackUrl(null);
    setAvailableClipNames([]);
    setClipName(null);
  };

  const bodyClass =
    mode === 'prop'
      ? 'construct-body construct-bodyProp'
      : mode === 'actor'
        ? 'construct-body construct-bodyActor'
        : 'construct-body';

  const explorer = (
    <AssetExplorer
      query={explorerQueryInput}
      onQueryChange={setExplorerQueryInput}
      onQueryClear={() => setExplorerQuery('')}
      assetTree={assetTree}
      characterTree={characterTree}
      expanded={expanded}
      selectedPath={selectedPath}
      onToggleDir={onToggleDir}
      onSelectFile={(filePath) => {
        setSelectedPath(filePath);
        const entry = entriesByPath.get(filePath) ?? null;
        setSelectedEntry(entry);
        if (mode === 'preview' && entry) void loadEntry(entry);
        if (mode === 'actor' && entry?.kind === 'CharacterModel') {
          onAddCharacter(filePath);
        }
      }}
      onAddAssetFile={mode === 'prop' || mode === 'actor' ? onAddAsset : undefined}
      characterFileAction={mode === 'actor' ? 'radio' : 'add'}
      characterRadioPath={mode === 'actor' ? actorCharacterPath : null}
      showAssets={mode === 'preview' || mode === 'prop' || mode === 'actor'}
      showCharacters={mode === 'preview' || mode === 'actor'}
      showColliders={mode === 'prop' || mode === 'actor'}
      assetsExpanded={assetsExpanded}
      onAssetsExpandedChange={setAssetsExpanded}
      charactersExpanded={charactersExpanded}
      onCharactersExpandedChange={setCharactersExpanded}
      colliderExpanded={colliderExpanded}
      onColliderExpandedChange={setColliderExpanded}
      onAddCollider={onAddCollider}
      assetAddEnabled={
        mode === 'prop' || (mode === 'actor' && actorSelection?.kind === 'bone')
      }
      characterAddEnabled={false}
      colliderAddEnabled={
        mode === 'prop' ||
        (mode === 'actor' &&
          (actorSelection?.kind === 'bone' || actorSelection?.kind === 'attachment'))
      }
      loading={!manifest}
    />
  );

  return (
    <div className="construct-root">
      <AppMenu
        mode={mode}
        onModeChange={setMode}
        fileOpen={fileOpen}
        onFileOpenChange={setFileOpen}
        onNew={onNew}
        onSave={onSave}
        onLoad={onLoad}
        onImport={onImport}
        onExport={onExport}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={mode === 'actor' ? '.actor,application/json' : '.prop,application/json'}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
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
                setStatus(`Imported ${file.name}`);
                return;
              }

              const doc = parsePropDocument(text);
              const loaded = await session.loadPropDocument(doc);
              setPropDoc({ ...loaded, parts: [...loaded.parts] });
              setSelectedPartId(null);
              setStatus(`Imported ${file.name}`);
            } catch (err) {
              setStatus(`Import error: ${String(err)}`);
            }
          })();
        }}
      />

      {confirmNewOpen ? (
        <ConfirmModal
          title={mode === 'actor' ? 'New actor' : 'New prop'}
          message={
            mode === 'actor'
              ? 'Create a new actor? Unsaved changes will be lost.'
              : 'Create a new prop? Unsaved changes will be lost.'
          }
          confirmLabel="Create"
          onCancel={() => setConfirmNewOpen(false)}
          onConfirm={() => {
            setConfirmNewOpen(false);
            performNew();
          }}
        />
      ) : null}

      {loadPropModalOpen ? (
        <LoadPropModal
          entries={localPropEntries}
          onCancel={() => setLoadPropModalOpen(false)}
          onSelect={(entry) => {
            setLoadPropModalOpen(false);
            const session = sessionRef.current;
            if (!session) return;
            void (async () => {
              try {
                const loaded = await session.loadPropDocument(entry.document);
                setPropDoc({ ...loaded, parts: [...loaded.parts] });
                setSelectedPartId(null);
                setStatus(`Loaded ${entry.displayName}`);
              } catch (err) {
                setStatus(`Load error: ${String(err)}`);
              }
            })();
          }}
          onDelete={(entry) => {
            removeLocalProp(entry.id);
            setLocalPropEntries(listLocalPropEntries());
            setStatus(`Deleted ${entry.displayName} from local storage`);
          }}
        />
      ) : null}

      {loadActorModalOpen ? (
        <LoadActorModal
          entries={localActorEntries}
          onCancel={() => setLoadActorModalOpen(false)}
          onSelect={(entry) => {
            setLoadActorModalOpen(false);
            const session = sessionRef.current;
            if (!session) return;
            void (async () => {
              try {
                const loaded = await session.loadActorDocument(entry.document);
                setActorDoc(cloneActorDoc(loaded));
                setActorBoneNames(session.getActorBoneNames());
                setActorSelection(loaded.character ? { kind: 'actor' } : null);
                setStatus(`Loaded ${entry.displayName}`);
              } catch (err) {
                setStatus(`Load error: ${String(err)}`);
              }
            })();
          }}
          onDelete={(entry) => {
            removeLocalActor(entry.id);
            setLocalActorEntries(listLocalActorEntries());
            setStatus(`Deleted ${entry.displayName} from local storage`);
          }}
        />
      ) : null}

      {renameIntent ? (
        <RenamePropModal
          initialName={mode === 'actor' ? actorDoc.displayName : propDoc.displayName}
          title={
            renameIntent === 'edit'
              ? mode === 'actor'
                ? 'Rename actor'
                : 'Rename prop'
              : mode === 'actor'
                ? 'Name actor'
                : 'Name prop'
          }
          confirmLabel={
            renameIntent === 'save' ? 'Save' : renameIntent === 'export' ? 'Export' : 'Rename'
          }
          onCancel={() => setRenameIntent(null)}
          onConfirm={onRenameConfirm}
        />
      ) : null}

      <div className={bodyClass}>
        <div className="construct-panelLeft">{explorer}</div>

        <div className="construct-viewer">
          <canvas ref={canvasRef} className="construct-canvas" />
          {mode === 'preview' ? (
            <ViewerAnimHud
              title={viewerTitle}
              status={status}
              showTextureVariant
              canSwitchTexture={canSwitchTexture}
              textureVariants={textureVariants}
              textureVariantUrl={textureVariantUrl}
              onTextureVariantChange={handleTextureVariantChange}
              canAnimate={canAnimatePreview}
              animPackUrl={animPackUrl}
              compatibleAnimPacks={compatibleAnimPacks}
              onAnimPackChange={handleAnimPackChange}
              clipName={clipName}
              availableClipNames={availableClipNames}
              onClipChange={handleClipChange}
              onReset={handleAnimReset}
            />
          ) : null}
          {mode === 'actor' ? (
            <ViewerAnimHud
              title={viewerTitle}
              status={status}
              canAnimate={canAnimateActor}
              animPackUrl={animPackUrl}
              compatibleAnimPacks={compatibleAnimPacks}
              onAnimPackChange={handleAnimPackChange}
              clipName={clipName}
              availableClipNames={availableClipNames}
              onClipChange={handleClipChange}
              onReset={handleAnimReset}
            />
          ) : null}
          {mode === 'prop' || mode === 'actor' ? (
            <div className="construct-toolRail">
              {TRANSFORM_MODES.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className={
                    transformMode === tool
                      ? 'construct-toolBtn construct-toolBtnActive'
                      : 'construct-toolBtn'
                  }
                  onClick={() => {
                    setTransformMode(tool);
                    sessionRef.current?.setTransformMode(tool);
                  }}
                >
                  {tool === 'move' ? 'Move' : tool === 'scale' ? 'Scale' : 'Rotate'}
                </button>
              ))}
            </div>
          ) : null}
          <OrientationCube
            getAngles={() =>
              sessionRef.current?.getOrbitAngles() ?? { yawRad: 0, pitchRad: 0 }
            }
          />
        </div>

        {mode === 'prop' ? (
          <div className="construct-panelRightProp">
            <PropInspector
              parts={propDoc.parts}
              selectedPartId={selectedPartId}
              documentLabel={`${propDoc.id}.prop`}
              onSelectPart={(partId) => {
                setSelectedPartId(partId);
                sessionRef.current?.selectPart(partId);
              }}
            />
            <PropDetails
              part={selectedPart}
              propDisplayName={propDoc.displayName}
              documentTags={collectPropDocumentTags(propDoc)}
              textureVariants={selectedPartVariants}
              textureVariantUrl={selectedPartVariantUrl}
              onRenameProp={onRenameDocument}
              onRename={(partId, name) => {
                const doc = sessionRef.current?.updatePartName(partId, name);
                if (doc) setPropDoc({ ...doc, parts: [...doc.parts] });
              }}
              onCommitLocal={(partId, patch) => {
                const doc = sessionRef.current?.updatePartLocal(partId, patch);
                if (doc) setPropDoc({ ...doc, parts: [...doc.parts] });
              }}
              onTextureVariantChange={(partId, url) => {
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
              }}
              onTagsChange={(partId, tags) => {
                const doc = sessionRef.current?.updatePartTags(partId, tags);
                if (doc) setPropDoc({ ...doc, parts: [...doc.parts] });
              }}
              onDelete={(partId) => {
                const doc = sessionRef.current?.removePart(partId);
                if (!doc) return;
                setPropDoc({ ...doc, parts: [...doc.parts] });
                setSelectedPartId(null);
              }}
            />
          </div>
        ) : null}

        {mode === 'actor' ? (
          <div className="construct-panelRightProp">
            <ActorInspector
              doc={actorDoc}
              boneNames={actorBoneNames}
              selection={actorSelection}
              documentLabel={`${actorDoc.id}.actor`}
              onSelect={(sel) => {
                setActorSelection(sel);
                sessionRef.current?.selectActor(sel);
              }}
            />
            <ActorDetails
              doc={actorDoc}
              selection={actorSelection}
              textureVariants={actorDetailVariants}
              onRenameActor={onRenameDocument}
              onActorTagsChange={(tags) => {
                const doc = sessionRef.current?.updateActorTags(tags);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onAiPackageChange={(aiPackage) => {
                const doc = sessionRef.current?.setAiPackage(aiPackage);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onCharacterVariantChange={(url) => {
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
              }}
              onAttachmentRename={(id, name) => {
                const doc = sessionRef.current?.updateAttachmentName(id, name);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onAttachmentLocal={(id, patch) => {
                const doc = sessionRef.current?.updateAttachmentLocal(id, patch);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onAttachmentTagsChange={(id, tags) => {
                const doc = sessionRef.current?.updateAttachmentTags(id, tags);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onAttachmentPlaceholderChange={(id, placeholder) => {
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
              }}
              onAttachmentVariantChange={(id, url) => {
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
              }}
              onAttachmentDelete={(id) => {
                const doc = sessionRef.current?.removeAttachment(id);
                if (!doc) return;
                setActorDoc(cloneActorDoc(doc));
                setActorSelection(actorDoc.character ? { kind: 'actor' } : null);
              }}
              onColliderRename={(id, name) => {
                const doc = sessionRef.current?.updateColliderName(id, name);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onColliderLocal={(id, patch) => {
                const doc = sessionRef.current?.updateColliderLocal(id, patch);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onColliderFlagsChange={(id, flags) => {
                const doc = sessionRef.current?.updateColliderFlags(id, flags);
                if (doc) setActorDoc(cloneActorDoc(doc));
              }}
              onColliderDelete={(id) => {
                const doc = sessionRef.current?.removeCollider(id);
                if (!doc) return;
                setActorDoc(cloneActorDoc(doc));
                setActorSelection(actorDoc.character ? { kind: 'actor' } : null);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
