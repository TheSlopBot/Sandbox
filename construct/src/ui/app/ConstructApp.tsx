import { useEffect, useMemo, useState } from 'react';
import { mapTextureVariants, resolveManifestEntryForAssetUrl } from '../../catalog/manifest/manifestLookup.ts';
import { AppMenu } from '../menu/AppMenu.tsx';
import { AssetExplorer } from '../explorer/AssetExplorer.tsx';
import { LevelExplorer } from '../explorer/LevelExplorer.tsx';
import { PropInspector } from '../inspector/PropInspector.tsx';
import { PropDetails } from '../inspector/PropDetails.tsx';
import { ActorInspector } from '../inspector/ActorInspector.tsx';
import { ActorDetails } from '../inspector/ActorDetails.tsx';
import { LevelInspector } from '../inspector/LevelInspector.tsx';
import { LevelDetails } from '../inspector/LevelDetails.tsx';
import { LEVEL_GROUND_PLANE_ID } from '../../catalog/levels/levelDocument.ts';
import { OrientationCube } from '../orientation/OrientationCube.tsx';
import { ViewerAnimHud } from '../viewer/ViewerAnimHud.tsx';
import { ConfirmModal } from '../modals/ConfirmModal.tsx';
import { LoadPropModal } from '../modals/LoadPropModal.tsx';
import { LoadActorModal } from '../modals/LoadActorModal.tsx';
import { LoadLevelModal } from '../modals/LoadLevelModal.tsx';
import { GroupModal } from '../modals/GroupModal.tsx';
import { RenamePropModal } from '../modals/RenamePropModal.tsx';
import { collectPropDocumentTags } from '../../catalog/props/propDocument.ts';
import { parseActorDocument } from '../../catalog/actors/actorDocument.ts';
import { parsePropDocument } from '../../catalog/props/propDocument.ts';
import { listLocalPropEntries, saveLocalProp, type PropLocalStoreEntry } from '../../storage/propLocalStore.ts';
import { listLocalActorEntries, saveLocalActor, type ActorLocalStoreEntry } from '../../storage/actorLocalStore.ts';
import { useConstructSession } from './useConstructSession.ts';
import { useManifestExplorer } from './useManifestExplorer.ts';
import { useConstructViewer } from './useConstructViewer.ts';
import { useConstructMode, TRANSFORM_MODES } from './useConstructMode.ts';
import { useConstructSelection } from './useConstructSelection.ts';
import { useConstructDocumentActions } from './useConstructDocumentActions.ts';
import { useConstructAssetActions } from './useConstructAssetActions.ts';
import { useConstructInspectorActions } from './useConstructInspectorActions.ts';
import '../theme/style.css';

export type ConstructAppProps = {
  active: boolean;
  onOpenSandbox?: () => void;
};

export const ConstructApp = ({ active, onOpenSandbox }: ConstructAppProps) => {
  const [fileOpen, setFileOpen] = useState(false);
  const [, setStatus] = useState<string>('Loading manifest…');

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [levelStandardPropEntries, setLevelStandardPropEntries] = useState<PropLocalStoreEntry[]>([]);
  const [levelStandardActorEntries, setLevelStandardActorEntries] = useState<ActorLocalStoreEntry[]>([]);
  const [showColliders, setShowColliders] = useState(true);
  const [showBones, setShowBones] = useState(true);

  const refreshLevelStandardEntries = () => {
    setLevelStandardPropEntries(listLocalPropEntries());
    setLevelStandardActorEntries(listLocalActorEntries());
  };

  const {
    canvasRef,
    sessionRef,
    sessionReady,
    propDoc,
    setPropDoc,
    actorDoc,
    setActorDoc,
    actorBoneNames,
    setActorBoneNames,
    levelDoc,
    setLevelDoc,
  } = useConstructSession(active);

  const {
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
    setExplorerQuery,
    assetsExpanded,
    setAssetsExpanded,
    charactersExpanded,
    setCharactersExpanded,
    colliderExpanded,
    setColliderExpanded,
  } = useManifestExplorer({ active, setStatus });

  const { selectedPartId, setSelectedPartId, actorSelection, setActorSelection, levelSelection, setLevelSelection } =
    useConstructSelection();

  const levelScaleAllowed =
    !levelSelection.groupId &&
    levelSelection.instanceIds.length > 0 &&
    (levelSelection.instanceIds.every((id) =>
      levelDoc.composition.colliders.some((c) => c.id === id),
    ) ||
      (levelSelection.instanceIds.length === 1 &&
        levelSelection.instanceIds[0] === LEVEL_GROUND_PLANE_ID));

  const levelRotateAllowed = !levelSelection.instanceIds.includes(LEVEL_GROUND_PLANE_ID);

  const { mode, setMode, transformMode, setTransformMode } = useConstructMode({
    active,
    sessionRef,
    levelScaleAllowed,
    levelRotateAllowed,
    setPropDoc,
    setActorDoc,
    setActorBoneNames,
    setSelectedPartId,
    setActorSelection,
    setAnimPackUrl: (url) => setAnimPackUrl(url),
    setAvailableClipNames: (names) => setAvailableClipNames(names),
    setClipName: (name) => setClipName(name),
    setStatus,
    setLevelDoc,
    setLevelSelection,
  });

  const {
    loadEntry,
    animPackUrl,
    setAnimPackUrl,
    clipName,
    setClipName,
    availableClipNames,
    setAvailableClipNames,
    animPaused,
    textureVariants,
    textureVariantUrl,
    compatibleAnimPacks,
    canAnimatePreview,
    canAnimateActor,
    canSwitchTexture,
    handleTextureVariantChange,
    handleAnimPackChange,
    handleClipChange,
    handleAnimPlayPause,
    handleAnimReset,
  } = useConstructViewer({
    active,
    mode,
    sessionRef,
    sessionReady,
    manifest,
    entriesByPath,
    selectedEntry,
    setSelectedPath,
    setSelectedEntry,
    setExpanded,
    actorCharacter: actorDoc.character,
    setStatus,
  });

  const {
    fileInputRef,
    confirmNewOpen,
    setConfirmNewOpen,
    loadPropModalOpen,
    setLoadPropModalOpen,
    loadActorModalOpen,
    setLoadActorModalOpen,
    loadLevelModalOpen,
    setLoadLevelModalOpen,
    localPropEntries,
    localActorEntries,
    localLevelEntries,
    renameIntent,
    setRenameIntent,
    onNew,
    onSave,
    onSaveAs,
    onLoad,
    onImport,
    onExport,
    onRenameDocument,
    onRenameConfirm,
    performNew,
    onLoadPropEntry,
    onDeleteLocalPropEntry,
    onLoadActorEntry,
    onDeleteLocalActorEntry,
    onLoadLevelEntry,
    onDeleteLocalLevelEntry,
    onFileInputChange,
  } = useConstructDocumentActions({
    mode,
    sessionRef,
    propDoc,
    setPropDoc,
    actorDoc,
    setActorDoc,
    setActorBoneNames,
    levelDoc,
    setLevelDoc,
    setLevelSelection,
    setSelectedPartId,
    setActorSelection,
    setStatus,
    resetAnimationPreview: handleAnimReset,
    onLocalLibraryChange: refreshLevelStandardEntries,
  });

  const { propInspectorActions, actorInspectorActions, levelInspectorActions } = useConstructInspectorActions({
    sessionRef,
    actorDoc,
    setPropDoc,
    setActorDoc,
    setSelectedPartId,
    setActorSelection,
    setLevelDoc,
    setLevelSelection,
    setStatus,
  });

  const { onAddAsset, onAddCharacter, onAddCollider, onAddStandardProp, onAddStandardActor } = useConstructAssetActions({
    mode,
    sessionRef,
    entriesByPath,
    actorSelection,
    setActorSelection,
    setPropDoc,
    setSelectedPartId,
    setActorDoc,
    setActorBoneNames,
    setAnimPackUrl,
    setAvailableClipNames,
    setClipName,
    setStatus,
    setLevelDoc,
    setLevelSelection,
  });

  const handleModeChange = (next: typeof mode) => {
    if (next === 'level') refreshLevelStandardEntries();
    setMode(next);
  };

  useEffect(() => {
    if (mode !== 'level') return;
    refreshLevelStandardEntries();
  }, [mode]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || !sessionReady) return;
    setShowColliders(session.getShowColliders());
    setShowBones(session.getShowBones());
  }, [mode, sessionReady, sessionRef]);

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

  const actorCharacterPath = useMemo(() => {
    if (!actorDoc.character) return null;
    const entry = resolveManifestEntryForAssetUrl(actorDoc.character.url, entriesByPath);
    return entry?.path ?? null;
  }, [actorDoc.character, entriesByPath]);

  const viewerTitle = useMemo(() => {
    if (mode === 'actor') {
      if (!actorDoc.character) return 'Actor';
      return actorDoc.character.url.split('/').slice(-1)[0] ?? 'Actor';
    }

    if (!selectedEntry) return 'Viewer';
    return selectedEntry.path.split('/').slice(-1)[0] ?? selectedEntry.path;
  }, [selectedEntry, mode, actorDoc.character]);

  const selectedPart = propDoc.parts.find((p) => p.id === selectedPartId) ?? null;

  const selectedPartVariants = useMemo(() => {
    if (!selectedPart || selectedPart.kind !== 'asset') return [];
    const entry = resolveManifestEntryForAssetUrl(selectedPart.url, entriesByPath);
    return mapTextureVariants(entry);
  }, [selectedPart, entriesByPath]);

  const selectedPartVariantUrl =
    selectedPart?.kind === 'asset' ? (selectedPart.textureVariantUrl ?? null) : null;

  const actorDetailVariants = useMemo(() => {
    if (actorSelection?.kind === 'attachment') {
      const att = actorDoc.attachments.find((a) => a.id === actorSelection.attachmentId);
      if (!att) return [];
      return mapTextureVariants(resolveManifestEntryForAssetUrl(att.url, entriesByPath));
    }

    if (actorSelection?.kind === 'actor' && actorDoc.character) {
      return mapTextureVariants(
        resolveManifestEntryForAssetUrl(actorDoc.character.url, entriesByPath),
      );
    }

    return [];
  }, [actorSelection, actorDoc, entriesByPath]);

  const levelSinglePropInstance =
    levelSelection.instanceIds.length === 1
      ? levelDoc.composition.props.find((p) => p.id === levelSelection.instanceIds[0]) ?? null
      : null;
  const levelSingleActorInstance =
    levelSelection.instanceIds.length === 1
      ? levelDoc.composition.actors.find((a) => a.id === levelSelection.instanceIds[0]) ?? null
      : null;

  const levelDetailVariants = useMemo(() => {
    if (levelSinglePropInstance?.kind === 'simpleProp') {
      const entry = levelDoc.index.simpleProps[levelSinglePropInstance.indexId];
      if (!entry) return [];
      return mapTextureVariants(resolveManifestEntryForAssetUrl(entry.url, entriesByPath));
    }

    if (levelSingleActorInstance?.kind === 'simpleActor') {
      const entry = levelDoc.index.simpleActors[levelSingleActorInstance.indexId];
      if (!entry?.character) return [];
      return mapTextureVariants(resolveManifestEntryForAssetUrl(entry.character.url, entriesByPath));
    }

    return [];
  }, [levelSinglePropInstance, levelSingleActorInstance, levelDoc, entriesByPath]);

  const selectLevelInstances = (ids: string[]) => {
    const session = sessionRef.current;
    if (!session) return;
    session.selectLevelInstances(ids);
    setLevelSelection(session.getLevelSelection());
  };

  const handleSelectLevelInstance = (id: string, additive: boolean) => {
    if (additive) {
      const current = levelSelection.instanceIds;
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      selectLevelInstances(next);
      return;
    }
    selectLevelInstances([id]);
  };

  const handleSelectLevelGroup = (groupId: string) => {
    const session = sessionRef.current;
    if (!session) return;
    session.selectLevelGroup(groupId);
    setLevelSelection(session.getLevelSelection());
  };

  const handleSelectLevelRoot = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.selectLevelRoot();
    setLevelSelection(session.getLevelSelection());
  };

  const handleSelectLevelPlayerSpawn = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.selectLevelPlayerSpawn();
    setLevelSelection(session.getLevelSelection());
  };

  const handleSelectLevelGroundPlane = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.selectLevelGroundPlane();
    setLevelSelection(session.getLevelSelection());
  };

  const handleShowCollidersChange = (show: boolean) => {
    setShowColliders(show);
    sessionRef.current?.setShowColliders(show);
  };

  const handleShowBonesChange = (show: boolean) => {
    setShowBones(show);
    sessionRef.current?.setShowBones(show);
  };

  const handleImportStandardFiles = (files: FileList) => {
    void (async () => {
      let libraryChanged = false;
      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          if (file.name.endsWith('.actor')) {
            const doc = parseActorDocument(text);
            saveLocalActor(doc);
            libraryChanged = true;
            onAddStandardActor(doc);
            continue;
          }
          if (file.name.endsWith('.prop')) {
            const doc = parsePropDocument(text);
            saveLocalProp(doc);
            libraryChanged = true;
            onAddStandardProp(doc);
            continue;
          }
          try {
            const doc = parsePropDocument(text);
            saveLocalProp(doc);
            libraryChanged = true;
            onAddStandardProp(doc);
          } catch {
            const doc = parseActorDocument(text);
            saveLocalActor(doc);
            libraryChanged = true;
            onAddStandardActor(doc);
          }
        } catch (err) {
          setStatus(`Import error (${file.name}): ${String(err)}`);
        }
      }
      if (libraryChanged) refreshLevelStandardEntries();
    })();
  };

  const bodyClass =
    mode === 'prop'
      ? 'construct-body construct-bodyProp'
      : mode === 'actor'
        ? 'construct-body construct-bodyActor'
        : mode === 'level'
          ? 'construct-body construct-bodyLevel'
          : 'construct-body';

  const levelExplorer = (
    <LevelExplorer
      query={explorerQueryInput}
      onQueryChange={setExplorerQueryInput}
      onQueryClear={() => setExplorerQuery('')}
      assetTree={assetTree}
      characterTree={characterTree}
      expanded={expanded}
      onToggleDir={onToggleDir}
      onAddSimpleProp={onAddAsset}
      onAddSimpleActor={onAddCharacter}
      onAddCollider={onAddCollider}
      assetsExpanded={assetsExpanded}
      onAssetsExpandedChange={setAssetsExpanded}
      charactersExpanded={charactersExpanded}
      onCharactersExpandedChange={setCharactersExpanded}
      colliderExpanded={colliderExpanded}
      onColliderExpandedChange={setColliderExpanded}
      loading={!manifest}
      localPropEntries={levelStandardPropEntries}
      localActorEntries={levelStandardActorEntries}
      onAddStandardProp={(entry) => onAddStandardProp(entry.document)}
      onAddStandardActor={(entry) => onAddStandardActor(entry.document)}
      onImportFiles={handleImportStandardFiles}
    />
  );

  const explorer = (
    <AssetExplorer
      query={explorerQueryInput}
      onQueryChange={setExplorerQueryInput}
      onQueryClear={() => setExplorerQuery('')}
      assetTree={assetTree}
      characterTree={characterTree}
      expanded={expanded}
      selectedPath={selectedPath}
      onToggleDir={onToggleDir}
      onSelectFile={(filePath) => {
        setSelectedPath(filePath);
        const entry = entriesByPath.get(filePath) ?? null;
        setSelectedEntry(entry);
        if (mode === 'preview' && entry) void loadEntry(entry);
        if (mode === 'actor' && entry?.kind === 'CharacterModel') {
          onAddCharacter(filePath);
        }
      }}
      onAddAssetFile={mode === 'prop' || mode === 'actor' ? onAddAsset : undefined}
      characterFileAction={mode === 'actor' ? 'radio' : 'add'}
      characterRadioPath={mode === 'actor' ? actorCharacterPath : null}
      showAssets={mode === 'preview' || mode === 'prop' || mode === 'actor'}
      showCharacters={mode === 'preview' || mode === 'actor'}
      showColliders={mode === 'prop' || mode === 'actor'}
      assetsExpanded={assetsExpanded}
      onAssetsExpandedChange={setAssetsExpanded}
      charactersExpanded={charactersExpanded}
      onCharactersExpandedChange={setCharactersExpanded}
      colliderExpanded={colliderExpanded}
      onColliderExpandedChange={setColliderExpanded}
      onAddCollider={onAddCollider}
      assetAddEnabled={
        mode === 'prop' || (mode === 'actor' && actorSelection?.kind === 'bone')
      }
      characterAddEnabled={false}
      colliderAddEnabled={
        mode === 'prop' ||
        (mode === 'actor' &&
          (actorSelection?.kind === 'bone' || actorSelection?.kind === 'attachment'))
      }
      loading={!manifest}
    />
  );

  return (
    <div className="construct-root">
      <AppMenu
        mode={mode}
        onModeChange={handleModeChange}
        fileOpen={fileOpen}
        onFileOpenChange={setFileOpen}
        onNew={onNew}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onLoad={onLoad}
        onImport={onImport}
        onExport={onExport}
        onOpenSandbox={onOpenSandbox}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={
          mode === 'actor'
            ? '.actor,application/json'
            : mode === 'level'
              ? '.level,application/json'
              : '.prop,application/json'
        }
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = '';
          onFileInputChange(file);
        }}
      />

      {confirmNewOpen ? (
        <ConfirmModal
          title={mode === 'actor' ? 'New actor' : mode === 'level' ? 'New level' : 'New prop'}
          message={
            mode === 'actor'
              ? 'Create a new actor? Unsaved changes will be lost.'
              : mode === 'level'
                ? 'Create a new level? Unsaved changes will be lost.'
                : 'Create a new prop? Unsaved changes will be lost.'
          }
          confirmLabel="Create"
          onCancel={() => setConfirmNewOpen(false)}
          onConfirm={() => {
            setConfirmNewOpen(false);
            performNew();
          }}
        />
      ) : null}

      {loadPropModalOpen ? (
        <LoadPropModal
          entries={localPropEntries}
          onCancel={() => setLoadPropModalOpen(false)}
          onSelect={onLoadPropEntry}
          onDelete={onDeleteLocalPropEntry}
        />
      ) : null}

      {loadActorModalOpen ? (
        <LoadActorModal
          entries={localActorEntries}
          onCancel={() => setLoadActorModalOpen(false)}
          onSelect={onLoadActorEntry}
          onDelete={onDeleteLocalActorEntry}
        />
      ) : null}

      {loadLevelModalOpen ? (
        <LoadLevelModal
          entries={localLevelEntries}
          onCancel={() => setLoadLevelModalOpen(false)}
          onSelect={onLoadLevelEntry}
          onDelete={onDeleteLocalLevelEntry}
        />
      ) : null}

      {groupModalOpen ? (
        <GroupModal
          groups={levelDoc.groups}
          selectedCount={levelSelection.instanceIds.length}
          showExistingGroups={levelSelection.instanceIds.every((id) => {
            const prop = levelDoc.composition.props.find((p) => p.id === id);
            const actor = levelDoc.composition.actors.find((a) => a.id === id);
            const collider = levelDoc.composition.colliders.find((c) => c.id === id);
            const groupId = prop?.groupId ?? actor?.groupId ?? collider?.groupId ?? null;
            return !groupId;
          })}
          onCancel={() => setGroupModalOpen(false)}
          onCreate={(name) => {
            setGroupModalOpen(false);
            levelInspectorActions.onCreateGroup(levelSelection.instanceIds, name);
          }}
          onAssign={(groupId) => {
            setGroupModalOpen(false);
            levelInspectorActions.onAssignToGroup(levelSelection.instanceIds, groupId);
          }}
          onUngroup={() => {
            setGroupModalOpen(false);
            levelInspectorActions.onUngroupInstances(levelSelection.instanceIds);
          }}
        />
      ) : null}

      {renameIntent ? (
        <RenamePropModal
          initialName={
            mode === 'actor' ? actorDoc.displayName : mode === 'level' ? levelDoc.displayName : propDoc.displayName
          }
          title={
            renameIntent === 'edit'
              ? mode === 'actor'
                ? 'Rename actor'
                : mode === 'level'
                  ? 'Rename level'
                  : 'Rename prop'
              : renameIntent === 'saveAs'
                ? mode === 'actor'
                  ? 'Save actor as'
                  : mode === 'level'
                    ? 'Save level as'
                    : 'Save prop as'
                : mode === 'actor'
                  ? 'Name actor'
                  : mode === 'level'
                    ? 'Name level'
                    : 'Name prop'
          }
          confirmLabel={
            renameIntent === 'save' || renameIntent === 'saveAs'
              ? 'Save'
              : renameIntent === 'export'
                ? 'Export'
                : 'Rename'
          }
          onCancel={() => setRenameIntent(null)}
          onConfirm={onRenameConfirm}
        />
      ) : null}

      <div className={bodyClass}>
        <div className="construct-panelLeft">{mode === 'level' ? levelExplorer : explorer}</div>

        <div className="construct-viewer">
          <canvas ref={canvasRef} className="construct-canvas" />
          {mode === 'preview' ? (
            <ViewerAnimHud
              title={viewerTitle}
              showTextureVariant
              canSwitchTexture={canSwitchTexture}
              textureVariants={textureVariants}
              textureVariantUrl={textureVariantUrl}
              onTextureVariantChange={handleTextureVariantChange}
              canAnimate={canAnimatePreview}
              animPackUrl={animPackUrl}
              compatibleAnimPacks={compatibleAnimPacks}
              onAnimPackChange={handleAnimPackChange}
              clipName={clipName}
              availableClipNames={availableClipNames}
              onClipChange={handleClipChange}
              animPaused={animPaused}
              onPlayPause={handleAnimPlayPause}
              onReset={handleAnimReset}
            />
          ) : null}
          {mode === 'actor' ? (
            <ViewerAnimHud
              title={viewerTitle}
              canAnimate={canAnimateActor}
              animPackUrl={animPackUrl}
              compatibleAnimPacks={compatibleAnimPacks}
              onAnimPackChange={handleAnimPackChange}
              clipName={clipName}
              availableClipNames={availableClipNames}
              onClipChange={handleClipChange}
              animPaused={animPaused}
              onPlayPause={handleAnimPlayPause}
              onReset={handleAnimReset}
              showColliders={showColliders}
              onShowCollidersChange={handleShowCollidersChange}
              showBones={showBones}
              onShowBonesChange={handleShowBonesChange}
            />
          ) : null}
          {mode === 'prop' ? (
            <ViewerAnimHud
              title={propDoc.displayName || 'Prop'}
              canAnimate={false}
              showAnimControls={false}
              showColliders={showColliders}
              onShowCollidersChange={handleShowCollidersChange}
            />
          ) : null}
          {mode === 'level' ? (
            <ViewerAnimHud
              title={levelDoc.displayName || 'Level'}
              canAnimate={false}
              showAnimControls={false}
              showColliders={showColliders}
              onShowCollidersChange={handleShowCollidersChange}
            />
          ) : null}
          {mode === 'prop' || mode === 'actor' || mode === 'level' ? (
            <div className="construct-toolRail">
              {TRANSFORM_MODES.map((tool) => {
                const scaleDisabled = mode === 'level' && tool === 'scale' && !levelScaleAllowed;
                const rotateDisabled = mode === 'level' && tool === 'rotate' && !levelRotateAllowed;
                const toolDisabled = scaleDisabled || rotateDisabled;
                return (
                  <button
                    key={tool}
                    type="button"
                    disabled={toolDisabled}
                    className={
                      transformMode === tool
                        ? 'construct-toolBtn construct-toolBtnActive'
                        : 'construct-toolBtn'
                    }
                    onClick={() => {
                      if (toolDisabled) return;
                      setTransformMode(tool);
                      sessionRef.current?.setTransformMode(tool);
                    }}
                  >
                    {tool === 'move' ? 'Move' : tool === 'scale' ? 'Scale' : 'Rotate'}
                  </button>
                );
              })}
            </div>
          ) : null}
          {active ? (
            <OrientationCube
              active={active}
              getAngles={() =>
                sessionRef.current?.getOrbitAngles() ?? { yawRad: 0, pitchRad: 0 }
              }
            />
          ) : null}
        </div>

        {mode === 'prop' ? (
          <div className="construct-panelRightProp">
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
              propDisplayName={propDoc.displayName}
              documentTags={collectPropDocumentTags(propDoc)}
              textureVariants={selectedPartVariants}
              textureVariantUrl={selectedPartVariantUrl}
              onRenameProp={onRenameDocument}
              {...propInspectorActions}
            />
          </div>
        ) : null}

        {mode === 'actor' ? (
          <div className="construct-panelRightProp">
            <ActorInspector
              doc={actorDoc}
              boneNames={actorBoneNames}
              selection={actorSelection}
              documentLabel={`${actorDoc.id}.actor`}
              onSelect={(sel) => {
                setActorSelection(sel);
                sessionRef.current?.selectActor(sel);
              }}
            />
            <ActorDetails
              doc={actorDoc}
              selection={actorSelection}
              textureVariants={actorDetailVariants}
              onRenameActor={onRenameDocument}
              {...actorInspectorActions}
            />
          </div>
        ) : null}

        {mode === 'level' ? (
          <div className="construct-panelRightProp">
            <LevelInspector
              doc={levelDoc}
              selection={levelSelection}
              documentLabel={`${levelDoc.id}.level`}
              onSelectRoot={handleSelectLevelRoot}
              onSelectInstance={handleSelectLevelInstance}
              onSelectGroup={handleSelectLevelGroup}
              onSelectPlayerSpawn={handleSelectLevelPlayerSpawn}
              onSelectGroundPlane={handleSelectLevelGroundPlane}
            />
            <LevelDetails
              doc={levelDoc}
              selection={levelSelection}
              textureVariants={levelDetailVariants}
              onRenameLevel={onRenameDocument}
              onRenameInstance={levelInspectorActions.onRenameInstance}
              onRenameGroup={levelInspectorActions.onRenameGroup}
              onCommitLocal={levelInspectorActions.onCommitLocal}
              onCommitGroupLocal={levelInspectorActions.onCommitGroupLocal}
              onSetInstanceAiPackage={levelInspectorActions.onSetInstanceAiPackage}
              onSetSimpleVariant={levelInspectorActions.onSetSimpleVariant}
              onSetGroundPlaneVariant={levelInspectorActions.onSetGroundPlaneVariant}
              onRemoveInstances={levelInspectorActions.onRemoveInstances}
              onOpenGroupModal={() => setGroupModalOpen(true)}
              onUngroup={levelInspectorActions.onUngroup}
              onDeleteGroup={levelInspectorActions.onDeleteGroup}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
