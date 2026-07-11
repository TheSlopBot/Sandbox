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
  const stack: Array<{ node: KaykitTreeNode; depth: number; idx: number }> = [
    { node: root, depth, idx: 0 },
  ];

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
  onAddFile?: (filePath: string) => void;
  addEnabled?: boolean;
  fileAction?: 'add' | 'radio';
  radioSelectedPath?: string | null;
};

export const Tree = memo(({
  root,
  expanded,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onAddFile,
  addEnabled = true,
  fileAction = 'add',
  radioSelectedPath = null,
}: TreeProps) => {
  const rows = useMemo(() => flattenTree(root, expanded), [root, expanded]);

  return (
    <div>
      {rows.map((row) => {
        const n = row.node;
        const isDir = n.type === 'dir';
        const isSelected = n.type === 'file' && selectedPath === n.path;
        const icon = isDir ? (expanded.has(n.path) || n.path === '' ? '▾' : '▸') : '•';
        const showAdd = !isDir && fileAction === 'add' && !!onAddFile;
        const showRadio = !isDir && fileAction === 'radio';
        const radioChecked = showRadio && radioSelectedPath === n.path;

        return (
          <div
            key={row.key || '(root)'}
            className={showAdd || showRadio ? 'treeRowWithAdd' : undefined}
            style={{ paddingLeft: 4 + row.depth * 8 }}
          >
            <div
              className="treeRow"
              data-selected={isSelected}
              onClick={() => {
                if (isDir) onToggleDir(n.path);
                else onSelectFile(n.path);
              }}
            >
              <div className="treeIcon">{icon}</div>
              <div className="treeName">{n.path === '' ? 'KayKit' : n.name}</div>
            </div>
            {showAdd ? (
              <button
                type="button"
                className="treeRowAdd"
                aria-label={`Add ${n.name}`}
                disabled={!addEnabled}
                title={addEnabled ? undefined : 'Select a bone to attach an asset'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!addEnabled) return;
                  onAddFile?.(n.path);
                }}
              >
                <span>+</span>
              </button>
            ) : null}
            {showRadio ? (
              <input
                type="radio"
                className="treeRowRadio"
                name="construct-character-select"
                checked={radioChecked}
                aria-label={`Select ${n.name}`}
                onChange={() => onSelectFile(n.path)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
