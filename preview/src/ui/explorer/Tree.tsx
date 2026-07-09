import { memo, useMemo } from 'react';
import { type KaykitTreeNode } from '../../catalog/manifest/kaykitManifest.ts';

export type TreeRow = {
  key: string;
  depth: number;
  node: KaykitTreeNode;
};

const flattenTree = (
  root: KaykitTreeNode,
  expanded: ReadonlySet<string>,
  depth = 0,
): TreeRow[] => {
  const rows: TreeRow[] = [];
  const stack: Array<{ node: KaykitTreeNode; depth: number; idx: number }> = [{ node: root, depth, idx: 0 }];

  while (stack.length) {
    const top = stack[stack.length - 1];
    if (!top) break;

    if (top.idx === 0 && top.node.path) rows.push({ key: top.node.path, depth: top.depth, node: top.node });

    if (top.node.type !== 'dir') {
      stack.pop();
      continue;
    }

    const isExpanded = expanded.has(top.node.path) || top.node.path === '';
    if (!isExpanded) {
      stack.pop();
      continue;
    }

    const child = top.node.children[top.idx];
    top.idx += 1;
    if (!child) {
      stack.pop();
      continue;
    }

    stack.push({ node: child, depth: top.depth + 1, idx: 0 });
  }

  return rows;
};

export type TreeProps = {
  root: KaykitTreeNode;
  expanded: ReadonlySet<string>;
  selectedPath: string | null;
  onToggleDir: (dirPath: string) => void;
  onSelectFile: (filePath: string) => void;
};

export const Tree = memo(({ root, expanded, selectedPath, onToggleDir, onSelectFile }: TreeProps) => {
  const rows = useMemo(() => flattenTree(root, expanded), [root, expanded]);

  return (
    <div>
      {rows.map((row) => {
        const n = row.node;
        const isDir = n.type === 'dir';
        const isSelected = n.type === 'file' && selectedPath === n.path;
        const icon = isDir ? (expanded.has(n.path) || n.path === '' ? '▾' : '▸') : '•';

        return (
          <div
            key={row.key || '(root)'}
            className="treeRow"
            data-selected={isSelected}
            onClick={() => {
              if (isDir) onToggleDir(n.path);
              else onSelectFile(n.path);
            }}
            style={{ paddingLeft: 6 + row.depth * 14 }}
          >
            <div className="treeIcon">{icon}</div>
            <div className="treeName">{n.path === '' ? 'KayKit' : n.name}</div>
          </div>
        );
      })}
    </div>
  );
});

Tree.displayName = 'Tree';

