import { useEffect, useMemo, useRef, useState } from 'react';
import { loadKaykitManifest } from './manifest.ts';
import { type KaykitManifest, type KaykitManifestEntry, type KaykitTextureVariant, type KaykitTreeNode } from './types.ts';
import { Tree } from './ui/Tree.tsx';
import { createPreviewSession, type PreviewSession } from './runtime/previewSession.ts';
import './ui/preview.css';

export type PreviewAppProps = {
  active: boolean;
};

const DEFAULT_MODEL_PATH = 'KayKit Prototype Bits 1.1/Assets/gltf/Cube_Prototype_Small.gltf';

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

export const PreviewApp = ({ active }: PreviewAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<PreviewSession | null>(null);
  const defaultLoadedRef = useRef(false);
  const prevExplorerQueryRef = useRef<string>('');
  const explorerSearchInputRef = useRef<HTMLInputElement | null>(null);

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

    sessionRef.current = createPreviewSession(canvas);
  }, [active]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.setActive(active);
  }, [active]);

  useEffect(() => {
    if (active) return;

    const session = sessionRef.current;
    if (!session) return;

    session.unload();
    sessionRef.current = null;
    defaultLoadedRef.current = false;
  }, [active]);

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
    const variants = (entry.textureVariants ?? []).map((v) => ({
      label: v.label,
      url: `${import.meta.env.BASE_URL}${v.url}`,
    }));

    setStatus('Loading model…');
    setAvailableClipNames([]);
    setClipName(null);
    setAnimPackUrl(null);
    const altVariants = variants.filter((v) => !/^default$/i.test(v.label));
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
  }, [active, manifest, entriesByPath]);

  return (
    <div className="preview-root">
      <div className="preview-viewer">
        <canvas ref={canvasRef} className="preview-canvas" />
        <div className="preview-viewerHud">
          <div className="preview-titleRow">
            <div className="preview-title">{viewerTitle}</div>
            <div className="preview-subtle">{status}</div>
          </div>
          <div className="selectRow">
            <label>Texture variant</label>
            <select
              disabled={!canSwitchTexture}
              value={textureVariantUrl ?? ''}
              onChange={(e) => {
                const url = e.target.value || null;
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
              }}
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
      </div>

      <div className="preview-panelRight">
        <div className="preview-explorer">
          {manifest ? (
            <>
              <div className="explorerSearchRow">
                <div className="explorerSearchField">
                  <input
                    ref={explorerSearchInputRef}
                    className="explorerSearchInput"
                    value={explorerQueryInput}
                    placeholder="Search assets…"
                    onChange={(e) => setExplorerQueryInput(e.target.value)}
                  />
                  {explorerQueryInput.trim().length > 0 ? (
                    <button
                      type="button"
                      className="explorerSearchClear"
                      aria-label="Clear search"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setExplorerQueryInput('');
                        setExplorerQuery('');
                        explorerSearchInputRef.current?.focus();
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
              {filteredTree ? (
                <Tree
                  root={filteredTree}
                  expanded={expanded}
                  selectedPath={selectedPath}
                  onToggleDir={(dirPath) => {
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(dirPath)) next.delete(dirPath);
                      else next.add(dirPath);
                      return next;
                    });
                  }}
                  onSelectFile={(filePath) => {
                    setSelectedPath(filePath);
                    const entry = entriesByPath.get(filePath) ?? null;
                    setSelectedEntry(entry);
                    if (!entry) return;
                    void loadEntry(entry);
                  }}
                />
              ) : null}
            </>
          ) : (
            <div className="mutedNote">Loading…</div>
          )}
        </div>

        <div className="preview-info">
          {selectedEntry ? (
            <div className="fieldGrid">
              <div className="fieldLabel">Kind</div>
              <div className="fieldValue">{selectedEntry.kind}</div>
              <div className="fieldLabel">Path</div>
              <div className="fieldValue">{selectedEntry.path}</div>
            </div>
          ) : (
            <div className="mutedNote">Select a file to see details.</div>
          )}
        </div>
      </div>
    </div>
  );
};
