import { useMemo, useRef } from 'react';
import { type KaykitTreeNode } from '../../catalog/manifest/kaykitManifest.ts';
import { Tree } from './Tree.tsx';

export const EXPLORER_EXPAND_SCOPE = {
  assets: 'assets::',
  characters: 'characters::',
} as const;

export type ExplorerExpandScope = keyof typeof EXPLORER_EXPAND_SCOPE;

export const scopeExplorerDirPath = (scope: ExplorerExpandScope, dirPath: string) =>
  `${EXPLORER_EXPAND_SCOPE[scope]}${dirPath}`;

const unscopeExpanded = (expanded: ReadonlySet<string>, scope: ExplorerExpandScope) => {
  const prefix = EXPLORER_EXPAND_SCOPE[scope];
  const next = new Set<string>();
  for (const key of expanded) {
    if (key.startsWith(prefix)) next.add(key.slice(prefix.length));
  }
  return next;
};

export type AssetExplorerProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onQueryClear?: () => void;
  assetTree: KaykitTreeNode | null;
  characterTree: KaykitTreeNode | null;
  expanded: ReadonlySet<string>;
  selectedPath: string | null;
  onToggleDir: (dirPath: string) => void;
  onSelectFile: (filePath: string) => void;
  onAddAssetFile?: (filePath: string) => void;
  onAddCharacterFile?: (filePath: string) => void;
  characterFileAction?: 'add' | 'radio';
  characterRadioPath?: string | null;
  showAssets?: boolean;
  showCharacters?: boolean;
  showColliders?: boolean;
  assetsExpanded?: boolean;
  onAssetsExpandedChange?: (expanded: boolean) => void;
  charactersExpanded?: boolean;
  onCharactersExpandedChange?: (expanded: boolean) => void;
  colliderExpanded?: boolean;
  onColliderExpandedChange?: (expanded: boolean) => void;
  onAddCollider?: (shape: 'box' | 'cylinder' | 'sphere' | 'capsule') => void;
  assetAddEnabled?: boolean;
  characterAddEnabled?: boolean;
  colliderAddEnabled?: boolean;
  loading?: boolean;
};

export const AssetExplorer = ({
  query,
  onQueryChange,
  onQueryClear,
  assetTree,
  characterTree,
  expanded,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onAddAssetFile,
  onAddCharacterFile,
  characterFileAction = 'add',
  characterRadioPath = null,
  showAssets = true,
  showCharacters = true,
  showColliders = false,
  assetsExpanded = false,
  onAssetsExpandedChange,
  charactersExpanded = false,
  onCharactersExpandedChange,
  colliderExpanded = false,
  onColliderExpandedChange,
  onAddCollider,
  assetAddEnabled = true,
  characterAddEnabled = true,
  colliderAddEnabled = true,
  loading = false,
}: AssetExplorerProps) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const hasQuery = query.trim().length > 0;
  const sectioned = showAssets || showCharacters || showColliders;
  const assetExpanded = useMemo(
    () => unscopeExpanded(expanded, 'assets'),
    [expanded],
  );
  const characterExpanded = useMemo(
    () => unscopeExpanded(expanded, 'characters'),
    [expanded],
  );

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
            placeholder="Search"
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
        ) : sectioned ? (
          <>
            {showAssets ? (
              <>
                <div
                  className="treeRow"
                  onClick={() => onAssetsExpandedChange?.(!assetsExpanded)}
                >
                  <div className="treeIcon">▣</div>
                  <div className="treeName">Assets</div>
                </div>
                {assetsExpanded && assetTree ? (
                  <Tree
                    root={assetTree}
                    expanded={assetExpanded}
                    selectedPath={selectedPath}
                    onToggleDir={(dirPath) =>
                      onToggleDir(scopeExplorerDirPath('assets', dirPath))
                    }
                    onSelectFile={onSelectFile}
                    onAddFile={onAddAssetFile}
                    addEnabled={assetAddEnabled}
                  />
                ) : null}
              </>
            ) : null}
            {showCharacters ? (
              <>
                <div
                  className="treeRow"
                  onClick={() => onCharactersExpandedChange?.(!charactersExpanded)}
                >
                  <div className="treeIcon">◎</div>
                  <div className="treeName">Characters</div>
                </div>
                {charactersExpanded && characterTree ? (
                  <Tree
                    root={characterTree}
                    expanded={characterExpanded}
                    selectedPath={selectedPath}
                    onToggleDir={(dirPath) =>
                      onToggleDir(scopeExplorerDirPath('characters', dirPath))
                    }
                    onSelectFile={onSelectFile}
                    onAddFile={
                      characterFileAction === 'add' ? onAddCharacterFile : undefined
                    }
                    addEnabled={characterAddEnabled}
                    fileAction={characterFileAction}
                    radioSelectedPath={characterRadioPath}
                  />
                ) : null}
              </>
            ) : null}
            {showColliders ? (
              <>
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
                        ['capsule', 'Capsule'],
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
                          disabled={!colliderAddEnabled}
                          title={
                            colliderAddEnabled
                              ? undefined
                              : 'Select a bone or asset to attach a collider'
                          }
                          onClick={() => {
                            if (!colliderAddEnabled) return;
                            onAddCollider?.(shape);
                          }}
                        >
                          <span>+</span>
                        </button>
                      </div>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <div className="mutedNote">Loading...</div>
        )}
      </div>
    </div>
  );
};
