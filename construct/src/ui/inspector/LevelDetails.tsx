import { useEffect, useState } from 'react';
import {
  LEVEL_GROUND_PLANE_ID,
  LEVEL_PLAYER_SPAWN_ID,
  type LevelDocument,
} from '../../catalog/levels/levelDocument.ts';
import { type ActorAiPackage } from '../../catalog/actors/actorDocument.ts';
import { type ConstructLevelSelection } from '../../session/types.ts';
import type { KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';
import { type LevelGroundVariant, LEVEL_GROUND_VARIANTS } from 'viberanium';
import { ConfirmModal } from '../modals/ConfirmModal.tsx';
import { DetailsHeader } from './shared.tsx';

export type LevelDetailsProps = {
  doc: LevelDocument;
  selection: ConstructLevelSelection;
  textureVariants: KaykitTextureVariant[];
  onRenameLevel: () => void;
  onRenameInstance: (id: string, name: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onSetInstanceAiPackage: (id: string, aiPackage: ActorAiPackage) => void;
  onSetSimpleVariant: (id: string, url: string | null) => void;
  onSetGroundPlaneVariant: (variant: LevelGroundVariant) => void;
  onRemoveInstances: (ids: string[]) => void;
  onOpenGroupModal: () => void;
  onUngroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string, removeMembers: boolean) => void;
};

const groundVariantLabel = (variant: LevelGroundVariant): string => {
  if (variant === 'green') return 'Grassy Green';
  if (variant === 'brown') return 'Earthy Brown';
  if (variant === 'yellow') return 'Warm Yellow';
  if (variant === 'gray') return 'Editor Gray';
  return 'Blueprint Blue';
};

const instanceKindLabel = (kind: string): string => {
  if (kind === 'simpleProp') return 'Simple Prop';
  if (kind === 'standardProp') return 'Standard Prop';
  if (kind === 'simpleActor') return 'Simple Actor';
  if (kind === 'standardActor') return 'Standard Actor';
  if (kind === 'collider') return 'Collider';
  if (kind === 'groundPlane') return 'Ground Plane';
  return 'Player Spawn';
};

export const LevelDetails = ({
  doc,
  selection,
  textureVariants,
  onRenameLevel,
  onRenameInstance,
  onRenameGroup,
  onSetInstanceAiPackage,
  onSetSimpleVariant,
  onSetGroundPlaneVariant,
  onRemoveInstances,
  onOpenGroupModal,
  onUngroup,
  onDeleteGroup,
}: LevelDetailsProps) => {
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);

  const group = selection.groupId ? doc.groups.find((g) => g.id === selection.groupId) ?? null : null;
  const propInstance = doc.composition.props.find((p) => p.id === selection.instanceIds[0]) ?? null;
  const actorInstance = doc.composition.actors.find((a) => a.id === selection.instanceIds[0]) ?? null;
  const colliderInstance = doc.composition.colliders.find((c) => c.id === selection.instanceIds[0]) ?? null;
  const isPlayerSpawn =
    selection.instanceIds.length === 1 && selection.instanceIds[0] === LEVEL_PLAYER_SPAWN_ID;
  const isGroundPlane =
    selection.instanceIds.length === 1 && selection.instanceIds[0] === LEVEL_GROUND_PLANE_ID;
  const singleInstance =
    !group && selection.instanceIds.length === 1
      ? (propInstance ?? actorInstance ?? colliderInstance)
      : null;
  const isPlaceableSelection =
    !group &&
    selection.instanceIds.length > 0 &&
    selection.instanceIds.every(
      (id) => id !== LEVEL_PLAYER_SPAWN_ID && id !== LEVEL_GROUND_PLANE_ID,
    );

  const [nameDraft, setNameDraft] = useState(group?.name ?? singleInstance?.name ?? '');

  useEffect(() => {
    setNameDraft(group?.name ?? singleInstance?.name ?? '');
  }, [group?.id, group?.name, singleInstance?.id, singleInstance?.name]);

  if (group) {
    const commitName = () => {
      const next = nameDraft.trim();
      if (!next || next === group.name) {
        setNameDraft(group.name);
        return;
      }
      onRenameGroup(group.id, next);
    };

    return (
      <div className="construct-inspector">
        <DetailsHeader displayName={doc.displayName} renameLabel="Rename level" onRename={onRenameLevel} />
        <div className="construct-inspectorBody construct-detailsBody">
          <label className="construct-detailsField">
            <span>Name</span>
            <input
              className="construct-detailsInput"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
          <div className="construct-detailsField">
            <span>Members</span>
            <span className="construct-detailsReadonly">{group.memberInstanceIds.length}</span>
          </div>
          <div className="construct-detailsFooter construct-detailsFooterSplit">
            <button type="button" className="construct-modalBtn" onClick={() => onUngroup(group.id)}>
              Ungroup
            </button>
            <button type="button" className="construct-detailsDelete" onClick={() => setConfirmDeleteGroup(true)}>
              Delete Group + Members
            </button>
          </div>
        </div>
        {confirmDeleteGroup ? (
          <ConfirmModal
            title="Delete group"
            message={`Delete "${group.name}" and all ${group.memberInstanceIds.length} member(s)? This cannot be undone.`}
            confirmLabel="Delete"
            onCancel={() => setConfirmDeleteGroup(false)}
            onConfirm={() => {
              setConfirmDeleteGroup(false);
              onDeleteGroup(group.id, true);
            }}
          />
        ) : null}
      </div>
    );
  }

  if (isGroundPlane) {
    return (
      <div className="construct-inspector">
        <DetailsHeader displayName={doc.displayName} renameLabel="Rename level" onRename={onRenameLevel} />
        <div className="construct-inspectorBody construct-detailsBody">
          <div className="construct-detailsField">
            <span>Type</span>
            <span className="construct-detailsReadonly">Ground Plane</span>
          </div>
          <div className="construct-detailsField">
            <span>Size</span>
            <span className="construct-detailsReadonly">{doc.groundPlane.size.toFixed(2)}</span>
          </div>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">Variant</div>
            <select
              className="construct-detailsSelect"
              value={doc.groundPlane.variant}
              onChange={(e) => onSetGroundPlaneVariant(e.target.value as LevelGroundVariant)}
            >
              {LEVEL_GROUND_VARIANTS.map((variant) => (
                <option key={variant} value={variant}>
                  {groundVariantLabel(variant)}
                </option>
              ))}
            </select>
          </div>
          <div className="mutedNote">Move and scale only. Cannot be deleted or rotated.</div>
        </div>
      </div>
    );
  }

  if (isPlayerSpawn) {
    return (
      <div className="construct-inspector">
        <DetailsHeader displayName={doc.displayName} renameLabel="Rename level" onRename={onRenameLevel} />
        <div className="construct-inspectorBody construct-detailsBody">
          <div className="construct-detailsField">
            <span>Type</span>
            <span className="construct-detailsReadonly">Player Spawn</span>
          </div>
          <div className="mutedNote">Move and yaw-rotate only. Cannot be deleted.</div>
        </div>
      </div>
    );
  }

  if (selection.instanceIds.length > 1 || (singleInstance && isPlaceableSelection)) {
    const isMulti = selection.instanceIds.length > 1;
    const commitName = () => {
      if (!singleInstance) return;
      const next = nameDraft.trim();
      if (!next || next === singleInstance.name) {
        setNameDraft(singleInstance.name);
        return;
      }
      onRenameInstance(singleInstance.id, next);
    };

    const isProp = !!propInstance;
    const isSimple =
      singleInstance != null &&
      'kind' in singleInstance &&
      (singleInstance.kind === 'simpleProp' || singleInstance.kind === 'simpleActor');
    const canSwitchTexture = !!isSimple && textureVariants.length > 0;
    const activeVariantUrl =
      propInstance?.kind === 'simpleProp'
        ? (doc.index.simpleProps[propInstance.indexId]?.textureVariantUrl ?? null)
        : actorInstance?.kind === 'simpleActor'
          ? (doc.index.simpleActors[actorInstance.indexId]?.character?.textureVariantUrl ?? null)
          : null;

    return (
      <div className="construct-inspector">
        <DetailsHeader displayName={doc.displayName} renameLabel="Rename level" onRename={onRenameLevel} />
        <div className="construct-inspectorBody construct-detailsBody">
          {isMulti ? (
            <div className="mutedNote">{selection.instanceIds.length} elements selected.</div>
          ) : singleInstance ? (
            <>
              <label className="construct-detailsField">
                <span>Name</span>
                <input
                  className="construct-detailsInput"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
              </label>
              <div className="construct-detailsField">
                <span>Type</span>
                <span className="construct-detailsReadonly">
                  {colliderInstance
                    ? `Collider (${colliderInstance.shape})`
                    : 'kind' in singleInstance
                      ? instanceKindLabel(singleInstance.kind)
                      : 'Element'}
                </span>
              </div>
              {isSimple ? (
                <div className="construct-detailsSection">
                  <div className="construct-detailsSectionTitle">Variant</div>
                  <select
                    className="construct-detailsSelect"
                    disabled={!canSwitchTexture}
                    value={activeVariantUrl ?? ''}
                    onChange={(e) => onSetSimpleVariant(singleInstance.id, e.target.value || null)}
                  >
                    <option value="">Default</option>
                    {textureVariants.map((v) => (
                      <option key={v.url} value={v.url}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  {!canSwitchTexture ? (
                    <div className="mutedNote">Texture variants unavailable for this asset.</div>
                  ) : null}
                </div>
              ) : null}
              {!isProp && actorInstance ? (
                <div className="construct-detailsSection">
                  <div className="construct-detailsSectionTitle">AI package</div>
                  <select
                    className="construct-detailsSelect"
                    value={actorInstance.aiPackage}
                    onChange={(e) =>
                      onSetInstanceAiPackage(actorInstance.id, e.target.value as ActorAiPackage)
                    }
                  >
                    <option value="none">None</option>
                    <option value="testAi">testAi</option>
                  </select>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="construct-detailsFooter construct-detailsFooterSplit">
            <button type="button" className="construct-modalBtn" onClick={onOpenGroupModal}>
              Group
            </button>
            <button
              type="button"
              className="construct-detailsDelete"
              onClick={() => onRemoveInstances(selection.instanceIds)}
            >
              {isMulti ? 'Delete Selected' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="construct-inspector">
      <DetailsHeader displayName={doc.displayName} renameLabel="Rename level" onRename={onRenameLevel} />
      <div className="construct-inspectorBody">
        <div className="mutedNote">Select an element to edit details.</div>
      </div>
    </div>
  );
};
