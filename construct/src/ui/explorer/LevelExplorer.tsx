import { useRef, useState } from 'react';
import { type KaykitTreeNode } from '../../catalog/manifest/kaykitManifest.ts';
import { type PropLocalStoreEntry } from '../../storage/propLocalStore.ts';
import { type ActorLocalStoreEntry } from '../../storage/actorLocalStore.ts';
import { Tree } from './Tree.tsx';
import { EXPLORER_EXPAND_SCOPE, scopeExplorerDirPath } from './AssetExplorer.tsx';

export type LevelExplorerProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onQueryClear?: () => void;
  assetTree: KaykitTreeNode | null;
  characterTree: KaykitTreeNode | null;
  expanded: ReadonlySet<string>;
  onToggleDir: (dirPath: string) => void;
  onAddSimpleProp: (filePath: string) => void;
  onAddSimpleActor: (filePath: string) => void;
  onAddCollider: (shape: 'box' | 'cylinder' | 'sphere' | 'capsule') => void;
  assetsExpanded: boolean;
  onAssetsExpandedChange: (expanded: boolean) => void;
  charactersExpanded: boolean;
  onCharactersExpandedChange: (expanded: boolean) => void;
  colliderExpanded: boolean;
  onColliderExpandedChange: (expanded: boolean) => void;
  loading: boolean;
  localPropEntries: PropLocalStoreEntry[];
  localActorEntries: ActorLocalStoreEntry[];
  onAddStandardProp: (entry: PropLocalStoreEntry) => void;
  onAddStandardActor: (entry: ActorLocalStoreEntry) => void;
  onImportFiles: (files: FileList) => void;
};

const unscopeExpanded = (expanded: ReadonlySet<string>, scope: keyof typeof EXPLORER_EXPAND_SCOPE) => {
  const prefix = EXPLORER_EXPAND_SCOPE[scope];
  const next = new Set<string>();
  for (const key of expanded) {
    if (key.startsWith(prefix)) next.add(key.slice(prefix.length));
  }
  return next;
};

export const LevelExplorer = ({
  query,
  onQueryChange,
  onQueryClear,
  assetTree,
  characterTree,
  expanded,
  onToggleDir,
  onAddSimpleProp,
  onAddSimpleActor,
  onAddCollider,
  assetsExpanded,
  onAssetsExpandedChange,
  charactersExpanded,
  onCharactersExpandedChange,
  colliderExpanded,
  onColliderExpandedChange,
  loading,
  localPropEntries,
  localActorEntries,
  onAddStandardProp,
  onAddStandardActor,
  onImportFiles,
}: LevelExplorerProps) => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [simpleExpanded, setSimpleExpanded] = useState(false);
  const [standardExpanded, setStandardExpanded] = useState(false);
  const [standardPropsExpanded, setStandardPropsExpanded] = useState(false);
  const [standardActorsExpanded, setStandardActorsExpanded] = useState(false);
  const hasQuery = query.trim().length > 0;
  const assetExpanded = unscopeExpanded(expanded, 'assets');
  const characterExpanded = unscopeExpanded(expanded, 'characters');

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
        ) : (
          <>
            <div className="treeRow" onClick={() => setSimpleExpanded((v) => !v)}>
              <div className="treeIcon">◇</div>
              <div className="treeName">Simple</div>
            </div>
            {simpleExpanded ? (
              <>
                <div
                  className="treeRow"
                  style={{ paddingLeft: 12 }}
                  onClick={() => onAssetsExpandedChange(!assetsExpanded)}
                >
                  <div className="treeIcon">▣</div>
                  <div className="treeName">Props</div>
                </div>
                {assetsExpanded && assetTree ? (
                  <Tree
                    root={assetTree}
                    expanded={assetExpanded}
                    selectedPath={null}
                    onToggleDir={(dirPath) => onToggleDir(scopeExplorerDirPath('assets', dirPath))}
                    onSelectFile={() => {}}
                    onAddFile={onAddSimpleProp}
                    addEnabled
                  />
                ) : null}

                <div
                  className="treeRow"
                  style={{ paddingLeft: 12 }}
                  onClick={() => onCharactersExpandedChange(!charactersExpanded)}
                >
                  <div className="treeIcon">◎</div>
                  <div className="treeName">Actors</div>
                </div>
                {charactersExpanded && characterTree ? (
                  <Tree
                    root={characterTree}
                    expanded={characterExpanded}
                    selectedPath={null}
                    onToggleDir={(dirPath) => onToggleDir(scopeExplorerDirPath('characters', dirPath))}
                    onSelectFile={() => {}}
                    onAddFile={onAddSimpleActor}
                    addEnabled
                    fileAction="add"
                  />
                ) : null}
              </>
            ) : null}

            <div className="treeRow" onClick={() => setStandardExpanded((v) => !v)}>
              <div className="treeIcon">▣</div>
              <div className="treeName">Standard</div>
            </div>
            {standardExpanded ? (
              <>
                <div
                  className="treeRow"
                  style={{ paddingLeft: 12 }}
                  onClick={() => setStandardPropsExpanded((v) => !v)}
                >
                  <div className="treeIcon">▣</div>
                  <div className="treeName">Props</div>
                </div>
                {standardPropsExpanded ? (
                  localPropEntries.length === 0 ? (
                    <div className="mutedNote" style={{ paddingLeft: 24 }}>
                      No saved props.
                    </div>
                  ) : (
                    localPropEntries.map((entry) => (
                      <div key={entry.id} className="treeRowWithAdd" style={{ paddingLeft: 24 }}>
                        <div className="treeRow">
                          <div className="treeIcon">▣</div>
                          <div className="treeName">{entry.displayName}</div>
                        </div>
                        <button
                          type="button"
                          className="treeRowAdd"
                          aria-label={`Add ${entry.displayName}`}
                          onClick={() => onAddStandardProp(entry)}
                        >
                          <span>+</span>
                        </button>
                      </div>
                    ))
                  )
                ) : null}

                <div
                  className="treeRow"
                  style={{ paddingLeft: 12 }}
                  onClick={() => setStandardActorsExpanded((v) => !v)}
                >
                  <div className="treeIcon">◎</div>
                  <div className="treeName">Actors</div>
                </div>
                {standardActorsExpanded ? (
                  localActorEntries.length === 0 ? (
                    <div className="mutedNote" style={{ paddingLeft: 24 }}>
                      No saved actors.
                    </div>
                  ) : (
                    localActorEntries.map((entry) => (
                      <div key={entry.id} className="treeRowWithAdd" style={{ paddingLeft: 24 }}>
                        <div className="treeRow">
                          <div className="treeIcon">◎</div>
                          <div className="treeName">{entry.displayName}</div>
                        </div>
                        <button
                          type="button"
                          className="treeRowAdd"
                          aria-label={`Add ${entry.displayName}`}
                          disabled={!entry.document.character}
                          title={entry.document.character ? undefined : 'No character set'}
                          onClick={() => onAddStandardActor(entry)}
                        >
                          <span>+</span>
                        </button>
                      </div>
                    ))
                  )
                ) : null}
              </>
            ) : null}

            <div className="treeRow" onClick={() => onColliderExpandedChange(!colliderExpanded)}>
              <div className="treeIcon">◇</div>
              <div className="treeName">Colliders</div>
            </div>
            {colliderExpanded ? (
              (
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
                    onClick={() => onAddCollider(shape)}
                  >
                    <span>+</span>
                  </button>
                </div>
              ))
            ) : null}
          </>
        )}
      </div>
      <div className="construct-explorerFooter">
        <button type="button" className="construct-modalBtn" onClick={() => importInputRef.current?.click()}>
          Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".prop,.actor,application/json"
          multiple
          hidden
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = '';
            if (files && files.length > 0) onImportFiles(files);
          }}
        />
      </div>
    </div>
  );
};
