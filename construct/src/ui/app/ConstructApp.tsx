import { useEffect, useMemo, useState } from 'react';
import { mapTextureVariants, resolveManifestEntryForAssetUrl } from '../../catalog/manifest/manifestLookup.ts';
import { AppMenu } from '../menu/AppMenu.tsx';
import { AssetExplorer } from '../explorer/AssetExplorer.tsx';
import { PropInspector } from '../inspector/PropInspector.tsx';
import { PropDetails } from '../inspector/PropDetails.tsx';
import { ActorInspector } from '../inspector/ActorInspector.tsx';
import { ActorDetails } from '../inspector/ActorDetails.tsx';
import { OrientationCube } from '../orientation/OrientationCube.tsx';
import { ViewerAnimHud } from '../viewer/ViewerAnimHud.tsx';
import { ConfirmModal } from '../modals/ConfirmModal.tsx';
import { LoadPropModal } from '../modals/LoadPropModal.tsx';
import { LoadActorModal } from '../modals/LoadActorModal.tsx';
import { RenamePropModal } from '../modals/RenamePropModal.tsx';
import { collectPropDocumentTags } from '../../catalog/props/propDocument.ts';
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
};

export const ConstructApp = ({ active }: ConstructAppProps) => {
  const [fileOpen, setFileOpen] = useState(false);
  const [status, setStatus] = useState<string>('Loading manifest…');

  const { canvasRef, sessionRef, propDoc, setPropDoc, actorDoc, setActorDoc, actorBoneNames, setActorBoneNames } =
    useConstructSession(active);

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

  const { selectedPartId, setSelectedPartId, actorSelection, setActorSelection } = useConstructSelection();

  const { mode, setMode, transformMode, setTransformMode } = useConstructMode({
    active,
    sessionRef,
    setPropDoc,
    setActorDoc,
    setActorBoneNames,
    setSelectedPartId,
    setActorSelection,
    setAnimPackUrl: (url) => setAnimPackUrl(url),
    setAvailableClipNames: (names) => setAvailableClipNames(names),
    setClipName: (name) => setClipName(name),
    setStatus,
  });

  const {
    loadEntry,
    animPackUrl,
    setAnimPackUrl,
    clipName,
    setClipName,
    availableClipNames,
    setAvailableClipNames,
    textureVariants,
    textureVariantUrl,
    compatibleAnimPacks,
    canAnimatePreview,
    canAnimateActor,
    canSwitchTexture,
    handleTextureVariantChange,
    handleAnimPackChange,
    handleClipChange,
    handleAnimReset,
  } = useConstructViewer({
    active,
    mode,
    sessionRef,
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
    localPropEntries,
    localActorEntries,
    renameIntent,
    setRenameIntent,
    onNew,
    onSave,
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
    onFileInputChange,
  } = useConstructDocumentActions({
    mode,
    sessionRef,
    propDoc,
    setPropDoc,
    actorDoc,
    setActorDoc,
    setActorBoneNames,
    setSelectedPartId,
    setActorSelection,
    setStatus,
  });

  const { propInspectorActions, actorInspectorActions } = useConstructInspectorActions({
    sessionRef,
    actorDoc,
    setPropDoc,
    setActorDoc,
    setSelectedPartId,
    setActorSelection,
    setStatus,
  });

  const { onAddAsset, onAddCharacter, onAddCollider } = useConstructAssetActions({
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
  });

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

  const bodyClass =
    mode === 'prop'
      ? 'construct-body construct-bodyProp'
      : mode === 'actor'
        ? 'construct-body construct-bodyActor'
        : 'construct-body';

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
        onModeChange={setMode}
        fileOpen={fileOpen}
        onFileOpenChange={setFileOpen}
        onNew={onNew}
        onSave={onSave}
        onLoad={onLoad}
        onImport={onImport}
        onExport={onExport}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={mode === 'actor' ? '.actor,application/json' : '.prop,application/json'}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = '';
          onFileInputChange(file);
        }}
      />

      {confirmNewOpen ? (
        <ConfirmModal
          title={mode === 'actor' ? 'New actor' : 'New prop'}
          message={
            mode === 'actor'
              ? 'Create a new actor? Unsaved changes will be lost.'
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

      {renameIntent ? (
        <RenamePropModal
          initialName={mode === 'actor' ? actorDoc.displayName : propDoc.displayName}
          title={
            renameIntent === 'edit'
              ? mode === 'actor'
                ? 'Rename actor'
                : 'Rename prop'
              : mode === 'actor'
                ? 'Name actor'
                : 'Name prop'
          }
          confirmLabel={
            renameIntent === 'save' ? 'Save' : renameIntent === 'export' ? 'Export' : 'Rename'
          }
          onCancel={() => setRenameIntent(null)}
          onConfirm={onRenameConfirm}
        />
      ) : null}

      <div className={bodyClass}>
        <div className="construct-panelLeft">{explorer}</div>

        <div className="construct-viewer">
          <canvas ref={canvasRef} className="construct-canvas" />
          {mode === 'preview' ? (
            <ViewerAnimHud
              title={viewerTitle}
              status={status}
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
              onReset={handleAnimReset}
            />
          ) : null}
          {mode === 'actor' ? (
            <ViewerAnimHud
              title={viewerTitle}
              status={status}
              canAnimate={canAnimateActor}
              animPackUrl={animPackUrl}
              compatibleAnimPacks={compatibleAnimPacks}
              onAnimPackChange={handleAnimPackChange}
              clipName={clipName}
              availableClipNames={availableClipNames}
              onClipChange={handleClipChange}
              onReset={handleAnimReset}
            />
          ) : null}
          {mode === 'prop' || mode === 'actor' ? (
            <div className="construct-toolRail">
              {TRANSFORM_MODES.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className={
                    transformMode === tool
                      ? 'construct-toolBtn construct-toolBtnActive'
                      : 'construct-toolBtn'
                  }
                  onClick={() => {
                    setTransformMode(tool);
                    sessionRef.current?.setTransformMode(tool);
                  }}
                >
                  {tool === 'move' ? 'Move' : tool === 'scale' ? 'Scale' : 'Rotate'}
                </button>
              ))}
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
      </div>
    </div>
  );
};
