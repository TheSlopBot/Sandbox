import { useRef } from 'react';
import { type KaykitTreeNode } from '../../catalog/manifest/kaykitManifest.ts';
import { Tree } from './Tree.tsx';

export type AssetExplorerProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onQueryClear?: () => void;
  tree: KaykitTreeNode | null;
  expanded: ReadonlySet<string>;
  selectedPath: string | null;
  onToggleDir: (dirPath: string) => void;
  onSelectFile: (filePath: string) => void;
  onAddFile?: (filePath: string) => void;
  showColliders?: boolean;
  assetsExpanded?: boolean;
  onAssetsExpandedChange?: (expanded: boolean) => void;
  colliderExpanded?: boolean;
  onColliderExpandedChange?: (expanded: boolean) => void;
  onAddCollider?: (shape: 'box' | 'cylinder' | 'sphere') => void;
  loading?: boolean;
};

export const AssetExplorer = ({
  query,
  onQueryChange,
  onQueryClear,
  tree,
  expanded,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onAddFile,
  showColliders = false,
  assetsExpanded = true,
  onAssetsExpandedChange,
  colliderExpanded = true,
  onColliderExpandedChange,
  onAddCollider,
  loading = false,
}: AssetExplorerProps) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const propMode = showColliders;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="construct-explorer">
      <div className="construct-inspectorHeader">
        <span>Explorer</span>
      </div>
      <div className="explorerSearchRow">
        <div className="explorerSearchField">
          <input
            ref={searchInputRef}
            className="explorerSearchInput"
            value={query}
            placeholder="Search assets"
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {hasQuery ? (
            <button
              type="button"
              className="explorerSearchClear"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onQueryClear?.();
                onQueryChange('');
                searchInputRef.current?.focus();
              }}
            >
              x
            </button>
          ) : null}
        </div>
      </div>
      <div className="construct-explorerBody">
        {loading ? (
          <div className="mutedNote">Loading...</div>
        ) : propMode ? (
          <>
            <div
              className="treeRow"
              onClick={() => onAssetsExpandedChange?.(!assetsExpanded)}
            >
              <div className="treeIcon">▣</div>
              <div className="treeName">Assets</div>
            </div>
            {assetsExpanded && tree ? (
              <Tree
                root={tree}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onAddFile={onAddFile}
              />
            ) : null}
            <div
              className="treeRow"
              onClick={() => onColliderExpandedChange?.(!colliderExpanded)}
            >
              <div className="treeIcon">◇</div>
              <div className="treeName">Colliders</div>
            </div>
            {colliderExpanded ? (
              <>
                {(
                  [
                    ['box', 'Rectangle'],
                    ['cylinder', 'Cylinder'],
                    ['sphere', 'Sphere'],
                  ] as const
                ).map(([shape, label]) => (
                  <div key={shape} className="treeRowWithAdd" style={{ paddingLeft: 12 }}>
                    <div className="treeRow">
                      <div className="treeIcon">◇</div>
                      <div className="treeName">{label}</div>
                    </div>
                    <button
                      type="button"
                      className="treeRowAdd"
                      aria-label={`Add ${label}`}
                      onClick={() => onAddCollider?.(shape)}
                    >
                      <span>+</span>
                    </button>
                  </div>
                ))}
              </>
            ) : null}
          </>
        ) : tree ? (
          <Tree
            root={tree}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggleDir={onToggleDir}
            onSelectFile={onSelectFile}
          />
        ) : (
          <div className="mutedNote">Loading...</div>
        )}
      </div>
    </div>
  );
};
