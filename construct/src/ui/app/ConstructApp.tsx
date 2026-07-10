import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MODEL_PATH } from '../../catalog/manifest/defaults.ts';
import { loadKaykitManifest } from '../../catalog/manifest/loadKaykitManifest.ts';
import {
  type KaykitManifest,
  type KaykitManifestEntry,
  type KaykitTextureVariant,
  type KaykitTreeNode,
} from '../../catalog/manifest/kaykitManifest.ts';
import { bootstrap, type ConstructSession } from '../../globals/bootstrap.ts';
import { AppMenu, type ConstructMode } from '../menu/AppMenu.tsx';
import { AssetExplorer } from '../explorer/AssetExplorer.tsx';
import { PropInspector } from '../inspector/PropInspector.tsx';
import { PropDetails } from '../inspector/PropDetails.tsx';
import { PreviewDetails } from '../inspector/PreviewDetails.tsx';
import {
  type PropDocument,
  type PropEditorTransformMode,
  createEmptyPropDocument,
  parsePropDocument,
  serializePropDocument,
} from '../../catalog/props/propDocument.ts';
import '../theme/style.css';

export type ConstructAppProps = {
  active: boolean;
};

const expandVariantPaths = (expanded: Set<string>, filePath: string) => {
  const next = new Set(expanded);
  next.add('');
  const parts = filePath.split('/');
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur ? `${cur}/${parts[i]}` : parts[i];
    next.add(cur);
  }
  return next;
};

const getSearchWords = (raw: string) => raw.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);

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

const pruneTree = (
  root: KaykitTreeNode,
  opts: {
    isAnimationPath: (path: string) => boolean;
    isFileMatch: (path: string, name: string) => boolean;
  },
) => {
  const pruneNode = (node: KaykitTreeNode): KaykitTreeNode | null => {
    if (node.type === 'file') {
      if (opts.isAnimationPath(node.path)) return null;
      if (!opts.isFileMatch(node.path, node.name)) return null;
      return node;
    }

    const nextChildren = node.children.map(pruneNode).filter((c): c is KaykitTreeNode => !!c);
    if (node.path !== '' && nextChildren.length === 0) return null;

    return { ...node, children: nextChildren };
  };

  return pruneNode(root) ?? { type: 'dir', name: root.name, path: root.path, children: [] };
};

export const ConstructApp = ({ active }: ConstructAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<ConstructSession | null>(null);
  const defaultLoadedRef = useRef(false);
  const prevExplorerQueryRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<ConstructMode>('preview');
  const [fileOpen, setFileOpen] = useState(false);
  const [manifest, setManifest] = useState<KaykitManifest | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));
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
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<PropEditorTransformMode>('move');
  const [colliderExpanded, setColliderExpanded] = useState(true);
  const [assetsExpanded, setAssetsExpanded] = useState(true);

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

    return () => session.setPropDocumentListener(null);
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
        setStatus(doc.parts.length > 0 ? 'Prop editor ready.' : 'Prop editor ready. Add assets or colliders.');
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
    if (!active || mode !== 'prop') return;

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
    if (!manifest || !selectedEntry) return [];
    if (selectedEntry.kind !== 'CharacterModel' || selectedEntry.boneCount <= 0) return [];

    const seen = new Set<string>();

    return manifest.entries
      .filter((e) => e.kind === 'AnimationSet')
      .filter((e) => {
        const name = e.path.split('/').slice(-1)[0] ?? e.path;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }, [manifest, selectedEntry]);

  const filteredTree = useMemo(() => {
    if (!manifest) return null;

    const words = getSearchWords(explorerQuery);
    return pruneTree(manifest.tree, {
      isAnimationPath: (path) => (entriesByPath.get(path)?.kind ?? null) === 'AnimationSet',
      isFileMatch: (path, name) => matchesWords(`${name} ${path}`, words),
    });
  }, [manifest, explorerQuery, entriesByPath]);

  useEffect(() => {
    const handle = window.setTimeout(() => setExplorerQuery(explorerQueryInput), 160);
    return () => window.clearTimeout(handle);
  }, [explorerQueryInput]);

  useEffect(() => {
    if (!filteredTree) return;

    const prevQuery = prevExplorerQueryRef.current;
    prevExplorerQueryRef.current = explorerQuery;

    if (explorerQuery.length <= prevQuery.length) return;

    setExpanded((prev) => {
      const next = new Set(prev);

      for (const p of collectDirPaths(filteredTree)) next.add(p);

      return next;
    });
  }, [filteredTree, explorerQuery]);

  const canAnimate = useMemo(
    () => !!selectedEntry && selectedEntry.kind === 'CharacterModel' && selectedEntry.boneCount > 0,
    [selectedEntry],
  );

  const canSwitchTexture = useMemo(
    () => textureVariants.length > 0,
    [textureVariants],
  );

  const viewerTitle = useMemo(() => {
    if (!selectedEntry) return 'Viewer';
    return selectedEntry.path.split('/').slice(-1)[0] ?? selectedEntry.path;
  }, [selectedEntry]);

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
    setExpanded((prev) => expandVariantPaths(prev, entry.path));
    void loadEntry(entry);
  }, [active, manifest, entriesByPath, mode]);

  const onNew = () => {
    if (mode !== 'prop') {
      setStatus('New is available in Prop mode.');
      return;
    }

    const session = sessionRef.current;
    if (!session) return;

    const doc = session.newProp();
    setPropDoc(doc);
    setSelectedPartId(null);
    setStatus('New prop document.');
  };

  const onSave = () => {
    if (mode !== 'prop') {
      setStatus('Save is available in Prop mode.');
      return;
    }

    const session = sessionRef.current;
    const doc = session?.getPropDocument() ?? propDoc;
    const blob = new Blob([serializePropDocument(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.id || 'untitled'}.prop`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${a.download}`);
  };

  const onLoad = () => {
    if (mode !== 'prop') {
      setStatus('Load is available in Prop mode.');
      return;
    }

    fileInputRef.current?.click();
  };

  const onAddAsset = (filePath: string) => {
    const session = sessionRef.current;
    const entry = entriesByPath.get(filePath);
    if (!session || !entry) return;

    const url = `${import.meta.env.BASE_URL}${entry.url}`;
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
  };

  const onAddCollider = (shape: 'box' | 'cylinder' | 'sphere') => {
    const session = sessionRef.current;
    if (!session) return;

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
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".prop,application/json"
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
              const doc = parsePropDocument(text);
              const loaded = await session.loadPropDocument(doc);
              setPropDoc({ ...loaded, parts: [...loaded.parts] });
              setSelectedPartId(null);
              setStatus(`Loaded ${file.name}`);
            } catch (err) {
              setStatus(`Load error: ${String(err)}`);
            }
          })();
        }}
      />

      <div className="construct-body">
        <div className="construct-viewer">
          <canvas ref={canvasRef} className="construct-canvas" />
          {mode === 'preview' ? (
            <div className="construct-viewerHud">
              <div className="construct-titleRow">
                <div className="construct-title">{viewerTitle}</div>
                <div className="construct-subtle">{status}</div>
              </div>
              <div className="selectRow">
                <label>Texture variant</label>
                <select
                  disabled={!canSwitchTexture}
                  value={textureVariantUrl ?? ''}
                  onChange={(e) => handleTextureVariantChange(e.target.value || null)}
                >
                  <option value="">Default</option>
                  {textureVariants.map((v) => (
                    <option key={v.url} value={v.url}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="selectRow">
                <label>Animation pack</label>
                <select
                  disabled={!canAnimate}
                  value={animPackUrl ?? ''}
                  onChange={(e) => {
                    const url = e.target.value || null;
                    setAnimPackUrl(url);

                    const session = sessionRef.current;
                    if (!session || !url) return;

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
                  }}
                >
                  <option value="">(none)</option>
                  {compatibleAnimPacks.map((p) => (
                    <option key={p.path} value={p.url}>
                      {p.path.split('/').slice(-1)[0] ?? p.path}
                    </option>
                  ))}
                </select>
              </div>
              <div className="selectRow">
                <label>Clip</label>
                <select
                  disabled={!canAnimate || availableClipNames.length === 0}
                  value={clipName ?? ''}
                  onChange={(e) => {
                    const next = e.target.value || null;
                    setClipName(next);

                    const session = sessionRef.current;
                    if (!session || !next) return;
                    session.applyClip(next);
                  }}
                >
                  <option value="">(none)</option>
                  {availableClipNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              {!canSwitchTexture ? (
                <div className="mutedNote">Texture variants unavailable for this asset.</div>
              ) : null}
              {!canAnimate ? (
                <div className="mutedNote">Animation selector disabled (no bones/skin).</div>
              ) : null}
            </div>
          ) : (
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
          )}
        </div>

        {mode === 'preview' ? (
          <div className="construct-panelRight">
            <AssetExplorer
              query={explorerQueryInput}
              onQueryChange={setExplorerQueryInput}
              onQueryClear={() => setExplorerQuery('')}
              tree={filteredTree}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggleDir={onToggleDir}
              onSelectFile={(filePath) => {
                setSelectedPath(filePath);
                const entry = entriesByPath.get(filePath) ?? null;
                setSelectedEntry(entry);
                if (!entry) return;
                void loadEntry(entry);
              }}
              loading={!manifest}
            />

            <PreviewDetails
              entry={selectedEntry}
              textureVariants={textureVariants}
              textureVariantUrl={textureVariantUrl}
              onTextureVariantChange={handleTextureVariantChange}
            />
          </div>
        ) : (
          <div className="construct-panelRightProp">
            <AssetExplorer
              query={explorerQueryInput}
              onQueryChange={setExplorerQueryInput}
              onQueryClear={() => setExplorerQuery('')}
              tree={filteredTree}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggleDir={onToggleDir}
              onSelectFile={(filePath) => {
                setSelectedPath(filePath);
                setSelectedEntry(entriesByPath.get(filePath) ?? null);
              }}
              onAddFile={onAddAsset}
              showColliders
              assetsExpanded={assetsExpanded}
              onAssetsExpandedChange={setAssetsExpanded}
              colliderExpanded={colliderExpanded}
              onColliderExpandedChange={setColliderExpanded}
              onAddCollider={onAddCollider}
              loading={!manifest}
            />
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
              textureVariants={selectedPartVariants}
              textureVariantUrl={selectedPartVariantUrl}
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
              onDelete={(partId) => {
                const doc = sessionRef.current?.removePart(partId);
                if (!doc) return;
                setPropDoc({ ...doc, parts: [...doc.parts] });
                setSelectedPartId(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
