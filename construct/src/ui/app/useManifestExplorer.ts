import { useEffect, useMemo, useRef, useState } from 'react';
import { loadKaykitManifest } from '../../catalog/manifest/loadKaykitManifest.ts';
import {
  type KaykitManifest,
  type KaykitManifestEntry,
  type KaykitTreeNode,
} from '../../catalog/manifest/kaykitManifest.ts';
import { buildAssetTree, buildCharacterTree } from '../../catalog/manifest/filterManifestTrees.ts';
import { scopeExplorerDirPath } from '../explorer/AssetExplorer.tsx';
import {
  collectTreeDirPaths,
  getSearchWords,
  treeHasFileNodes,
} from '../explorer/explorerSearch.ts';

const matchesWords = (haystack: string, words: readonly string[]) => {
  if (words.length === 0) return true;

  const h = haystack.toLowerCase();
  for (const w of words) {
    if (!h.includes(w)) return false;
  }

  return true;
};

export const expandVariantPaths = (
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

export type UseManifestExplorerParams = {
  active: boolean;
  setStatus: (status: string) => void;
};

export const useManifestExplorer = ({ active, setStatus }: UseManifestExplorerParams) => {
  const prevExplorerQueryRef = useRef<string>('');

  const [manifest, setManifest] = useState<KaykitManifest | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KaykitManifestEntry | null>(null);
  const [explorerQueryInput, setExplorerQueryInput] = useState<string>('');
  const [explorerQuery, setExplorerQuery] = useState<string>('');
  const [assetsExpanded, setAssetsExpanded] = useState(false);
  const [charactersExpanded, setCharactersExpanded] = useState(false);
  const [colliderExpanded, setColliderExpanded] = useState(false);

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
  }, [active, manifest, setStatus]);

  const entriesByPath = useMemo(() => {
    if (!manifest) return new Map<string, KaykitManifestEntry>();
    return new Map(manifest.entries.map((e) => [e.path, e]));
  }, [manifest]);

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

  const collapseExplorerExpansion = () => {
    setExpanded(new Set());
    setAssetsExpanded(false);
    setCharactersExpanded(false);
    setColliderExpanded(false);
  };

  const expandExplorerSearchMatches = (
    nextAssetTree: KaykitTreeNode | null,
    nextCharacterTree: KaykitTreeNode | null,
  ) => {
    const assetMatches = nextAssetTree ? treeHasFileNodes(nextAssetTree) : false;
    const characterMatches = nextCharacterTree ? treeHasFileNodes(nextCharacterTree) : false;

    setAssetsExpanded(assetMatches);
    setCharactersExpanded(characterMatches);
    setExpanded(() => {
      const next = new Set<string>();
      if (assetMatches && nextAssetTree) {
        for (const p of collectTreeDirPaths(nextAssetTree)) {
          next.add(scopeExplorerDirPath('assets', p));
        }
      }
      if (characterMatches && nextCharacterTree) {
        for (const p of collectTreeDirPaths(nextCharacterTree)) {
          next.add(scopeExplorerDirPath('characters', p));
        }
      }
      return next;
    });
  };

  const clearExplorerSearch = () => {
    setExplorerQueryInput('');
    setExplorerQuery('');
    collapseExplorerExpansion();
  };

  useEffect(() => {
    if (!assetTree && !characterTree) return;

    const prevQuery = prevExplorerQueryRef.current;
    prevExplorerQueryRef.current = explorerQuery;

    const hadQuery = prevQuery.trim().length > 0;
    const hasQuery = explorerQuery.trim().length > 0;

    if (!hasQuery) {
      if (hadQuery) collapseExplorerExpansion();
      return;
    }

    expandExplorerSearchMatches(assetTree, characterTree);
  }, [assetTree, characterTree, explorerQuery]);

  const onToggleDir = (dirPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  return {
    manifest,
    entriesByPath,
    assetTree,
    characterTree,
    expanded,
    setExpanded,
    onToggleDir,
    selectedPath,
    setSelectedPath,
    selectedEntry,
    setSelectedEntry,
    explorerQueryInput,
    setExplorerQueryInput,
    explorerQuery,
    setExplorerQuery,
    clearExplorerSearch,
    assetsExpanded,
    setAssetsExpanded,
    charactersExpanded,
    setCharactersExpanded,
    colliderExpanded,
    setColliderExpanded,
  };
};

export type UseManifestExplorerResult = ReturnType<typeof useManifestExplorer>;
