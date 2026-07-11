import {
  type KaykitEntryKind,
  type KaykitManifest,
  type KaykitManifestEntry,
  type KaykitTreeNode,
} from './kaykitManifest.ts';

const ASSET_KINDS: ReadonlySet<KaykitEntryKind> = new Set(['StaticProp', 'Unknown']);
const CHARACTER_KINDS: ReadonlySet<KaykitEntryKind> = new Set(['CharacterModel']);

export const pruneTreeByKinds = (
  root: KaykitTreeNode,
  entriesByPath: Map<string, KaykitManifestEntry>,
  allowedKinds: ReadonlySet<KaykitEntryKind>,
  opts?: {
    isFileMatch?: (path: string, name: string) => boolean;
  },
): KaykitTreeNode => {
  const isFileMatch = opts?.isFileMatch ?? (() => true);

  const pruneNode = (node: KaykitTreeNode): KaykitTreeNode | null => {
    if (node.type === 'file') {
      const kind = entriesByPath.get(node.path)?.kind ?? null;
      if (!kind || !allowedKinds.has(kind)) return null;
      if (!isFileMatch(node.path, node.name)) return null;
      return node;
    }

    const nextChildren = node.children.map(pruneNode).filter((c): c is KaykitTreeNode => !!c);
    if (node.path !== '' && nextChildren.length === 0) return null;

    return { ...node, children: nextChildren };
  };

  return pruneNode(root) ?? { type: 'dir', name: root.name, path: root.path, children: [] };
};

export const buildAssetTree = (
  manifest: KaykitManifest,
  entriesByPath: Map<string, KaykitManifestEntry>,
  isFileMatch?: (path: string, name: string) => boolean,
) => {
  if (manifest.assetTree) {
    return pruneTreeByKinds(manifest.assetTree, entriesByPath, ASSET_KINDS, { isFileMatch });
  }

  return pruneTreeByKinds(manifest.tree, entriesByPath, ASSET_KINDS, { isFileMatch });
};

export const buildCharacterTree = (
  manifest: KaykitManifest,
  entriesByPath: Map<string, KaykitManifestEntry>,
  isFileMatch?: (path: string, name: string) => boolean,
) => {
  if (manifest.characterTree) {
    return pruneTreeByKinds(manifest.characterTree, entriesByPath, CHARACTER_KINDS, {
      isFileMatch,
    });
  }

  return pruneTreeByKinds(manifest.tree, entriesByPath, CHARACTER_KINDS, { isFileMatch });
};
