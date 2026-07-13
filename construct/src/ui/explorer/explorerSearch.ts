import { type KaykitTreeNode } from '../../catalog/manifest/kaykitManifest.ts';

export const getSearchWords = (raw: string) =>
  raw.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);

export const matchesExplorerSearch = (raw: string, haystack: string) => {
  const words = getSearchWords(raw);
  if (words.length === 0) return true;

  const h = haystack.toLowerCase();
  for (const w of words) {
    if (!h.includes(w)) return false;
  }

  return true;
};

export const treeHasFileNodes = (root: KaykitTreeNode) => {
  const stack: KaykitTreeNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    if (n.type === 'file') return true;
    for (const c of n.children) stack.push(c);
  }

  return false;
};

export const collectTreeDirPaths = (root: KaykitTreeNode) => {
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
