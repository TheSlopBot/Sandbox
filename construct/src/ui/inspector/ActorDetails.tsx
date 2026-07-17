import { useEffect, useState } from 'react';
import {
  type ActorAiPackage,
  type ActorDocument,
  type ActorDocumentAttachment,
  type ActorDocumentClips,
  type ActorDocumentCollider,
  type ActorEditorSelection,
  attachmentListLabel,
  collectDocumentTags,
} from '../../catalog/actors/actorDocument.ts';
import type { KaykitManifestEntry, KaykitTextureVariant } from '../../catalog/manifest/kaykitManifest.ts';
import { createEulerQuat, quatToEulerDegrees } from './euler.ts';
import { TagList } from './TagList.tsx';
import { AxisRow, DetailsHeader } from './shared.tsx';

export type ActorDetailsProps = {
  doc: ActorDocument;
  selection: ActorEditorSelection;
  textureVariants: KaykitTextureVariant[];
  animPacks: KaykitManifestEntry[];
  onRenameActor: () => void;
  onActorTagsChange: (tags: string[]) => void;
  onActorClipsChange: (partial: Partial<ActorDocumentClips>) => void;
  onAiPackageChange: (aiPackage: ActorAiPackage) => void;
  onCharacterVariantChange: (url: string | null) => void;
  onAttachmentRename: (id: string, name: string) => void;
  onAttachmentLocal: (
    id: string,
    patch: {
      position?: [number, number, number];
      scale?: [number, number, number];
      rotation?: [number, number, number, number];
    },
  ) => void;
  onAttachmentTagsChange: (id: string, tags: string[]) => void;
  onAttachmentPlaceholderChange: (id: string, placeholder: boolean) => void;
  onAttachmentVariantChange: (id: string, url: string | null) => void;
  onAttachmentDelete: (id: string) => void;
  onColliderRename: (id: string, name: string) => void;
  onColliderLocal: (
    id: string,
    patch: {
      position?: [number, number, number];
      scale?: [number, number, number];
      rotation?: [number, number, number, number];
    },
  ) => void;
  onColliderFlagsChange: (
    id: string,
    flags: { collision?: boolean; hitbox?: boolean },
  ) => void;
  onColliderDelete: (id: string) => void;
};

const Header = ({
  displayName,
  onRename,
}: {
  displayName: string;
  onRename: () => void;
}) => <DetailsHeader displayName={displayName} renameLabel="Rename actor" onRename={onRename} />;

const findAttachment = (
  doc: ActorDocument,
  id: string,
): ActorDocumentAttachment | null => doc.attachments.find((a) => a.id === id) ?? null;

const findCollider = (
  doc: ActorDocument,
  id: string,
): ActorDocumentCollider | null => doc.colliders.find((c) => c.id === id) ?? null;

const colliderParentLabel = (doc: ActorDocument, collider: ActorDocumentCollider): string => {
  if (collider.parent.kind === 'character') return 'character';
  if (collider.parent.kind === 'bone') return collider.parent.boneName;
  const attachment = findAttachment(doc, collider.parent.attachmentId);
  return attachment ? attachmentListLabel(attachment) : collider.parent.attachmentId;
};

const matchManifestUrl = (entryUrl: string, stored: string): boolean => {
  if (entryUrl === stored) return true;

  const prefix = import.meta.env.BASE_URL;
  const relative = stored.startsWith(prefix) ? stored.slice(prefix.length) : stored;

  return entryUrl === relative;
};

const resolveGeneralClipNames = (
  doc: ActorDocument,
  animPacks: KaykitManifestEntry[],
): string[] => {
  const generalGlb = doc.animPack?.generalGlb;
  if (!generalGlb) return [];

  const pack = animPacks.find((p) => matchManifestUrl(p.url, generalGlb)) ?? null;

  return [...(pack?.clipNames ?? [])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
};

const ClipNameRow = ({
  label,
  value,
  clipNames,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  clipNames: string[];
  disabled: boolean;
  onCommit: (next: string) => void;
}) => {
  const known = clipNames.includes(value);

  return (
    <div className="construct-detailsAnimRow construct-detailsAnimRow--clipOnly">
      <span>{label}</span>
      <select
        className="construct-detailsSelect"
        disabled={disabled || clipNames.length === 0}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;

          onCommit(next);
        }}
      >
        {!known ? <option value={value}>{value || '(none)'}</option> : null}
        {clipNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
};

export const ActorDetails = ({
  doc,
  selection,
  textureVariants,
  animPacks,
  onRenameActor,
  onActorTagsChange,
  onActorClipsChange,
  onAiPackageChange,
  onCharacterVariantChange,
  onAttachmentRename,
  onAttachmentLocal,
  onAttachmentTagsChange,
  onAttachmentPlaceholderChange,
  onAttachmentVariantChange,
  onAttachmentDelete,
  onColliderRename,
  onColliderLocal,
  onColliderFlagsChange,
  onColliderDelete,
}: ActorDetailsProps) => {
  const documentTags = collectDocumentTags(doc);
  const attachment =
    selection?.kind === 'attachment' ? findAttachment(doc, selection.attachmentId) : null;
  const collider =
    selection?.kind === 'collider' ? findCollider(doc, selection.colliderId) : null;
  const [nameDraft, setNameDraft] = useState(attachment?.name ?? collider?.name ?? '');

  useEffect(() => {
    setNameDraft(attachment?.name ?? collider?.name ?? '');
  }, [attachment?.id, attachment?.name, collider?.id, collider?.name]);

  if (!selection || selection.kind === undefined) {
    return (
      <div className="construct-inspector">
        <Header displayName={doc.displayName} onRename={onRenameActor} />
        <div className="construct-inspectorBody">
          <div className="mutedNote">Select an element to edit details.</div>
        </div>
      </div>
    );
  }

  if (selection.kind === 'bone') {
    return (
      <div className="construct-inspector">
        <Header displayName={doc.displayName} onRename={onRenameActor} />
        <div className="construct-inspectorBody construct-detailsBody">
          <div className="construct-detailsField">
            <span>Bone</span>
            <span className="construct-detailsReadonly">{selection.boneName}</span>
          </div>
          <div className="mutedNote">
            Select an asset under this bone, or add a collider from the explorer.
          </div>
        </div>
      </div>
    );
  }

  if (selection.kind === 'actor') {
    const canSwitchTexture = textureVariants.length > 0;
    const activeVariantUrl = doc.character?.textureVariantUrl ?? null;
    const clipNames = resolveGeneralClipNames(doc, animPacks);
    const hit = doc.clips?.hit ?? 'hit_a';
    const death = doc.clips?.death ?? 'death_a';
    const deathPose = doc.clips?.deathPose ?? 'death_a_pose';
    const clipsDisabled = !doc.animPack?.generalGlb;

    return (
      <div className="construct-inspector">
        <Header displayName={doc.displayName} onRename={onRenameActor} />
        <div className="construct-inspectorBody construct-detailsBody">
          <div className="construct-detailsField">
            <span>Type</span>
            <span className="construct-detailsReadonly">Actor</span>
          </div>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">Variant</div>
            <select
              className="construct-detailsSelect"
              disabled={!doc.character || !canSwitchTexture}
              value={activeVariantUrl ?? ''}
              onChange={(e) => onCharacterVariantChange(e.target.value || null)}
            >
              <option value="">Default</option>
              {textureVariants.map((v) => (
                <option key={v.url} value={v.url}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">AI package</div>
            <select
              className="construct-detailsSelect"
              value={doc.aiPackage}
              onChange={(e) => onAiPackageChange(e.target.value as ActorAiPackage)}
            >
              <option value="none">None</option>
              <option value="testAi">testAi</option>
            </select>
          </div>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">Animations</div>
            <ClipNameRow
              label="Hit"
              value={hit}
              clipNames={clipNames}
              disabled={clipsDisabled}
              onCommit={(next) => onActorClipsChange({ hit: next })}
            />
            <ClipNameRow
              label="Death"
              value={death}
              clipNames={clipNames}
              disabled={clipsDisabled}
              onCommit={(next) => onActorClipsChange({ death: next })}
            />
            <ClipNameRow
              label="Death pose"
              value={deathPose}
              clipNames={clipNames}
              disabled={clipsDisabled}
              onCommit={(next) => onActorClipsChange({ deathPose: next })}
            />
          </div>
          <TagList
            title="Actor tags"
            tags={doc.tags}
            documentTags={documentTags}
            onChange={onActorTagsChange}
          />
        </div>
      </div>
    );
  }

  if (selection.kind === 'collider' && collider) {
    const euler = quatToEulerDegrees(collider.rotation);

    const commitName = () => {
      const next = nameDraft.trim();
      if (!next || next === collider.name) {
        setNameDraft(collider.name);
        return;
      }
      onColliderRename(collider.id, next);
    };

    return (
      <div className="construct-inspector">
        <Header displayName={doc.displayName} onRename={onRenameActor} />
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
            <span>Shape</span>
            <span className="construct-detailsReadonly">{collider.shape}</span>
          </div>
          <div className="construct-detailsField">
            <span>Attached to</span>
            <span className="construct-detailsReadonly">{colliderParentLabel(doc, collider)}</span>
          </div>
          <AxisRow
            label="Position"
            values={collider.position}
            onCommit={(position) => onColliderLocal(collider.id, { position })}
          />
          <AxisRow
            label="Scale"
            values={collider.scale}
            onCommit={(scale) => onColliderLocal(collider.id, { scale })}
          />
          <AxisRow
            label="Rotation"
            values={euler}
            onCommit={(degrees) => {
              const q = createEulerQuat(degrees);
              onColliderLocal(collider.id, {
                rotation: [q[0]!, q[1]!, q[2]!, q[3]!],
              });
            }}
          />
          <div className="construct-detailsSwitchStack">
            <div className="construct-detailsSwitchRow">
              <span>Collision</span>
              <input
                type="checkbox"
                checked={collider.collision}
                onChange={(e) =>
                  onColliderFlagsChange(collider.id, { collision: e.target.checked })
                }
              />
            </div>
            <div className="construct-detailsSwitchRow">
              <span>Hitbox</span>
              <input
                type="checkbox"
                checked={collider.hitbox}
                onChange={(e) =>
                  onColliderFlagsChange(collider.id, { hitbox: e.target.checked })
                }
              />
            </div>
          </div>
          <div className="construct-detailsFooter">
            <button
              type="button"
              className="construct-detailsDelete"
              onClick={() => onColliderDelete(collider.id)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!attachment) {
    return (
      <div className="construct-inspector">
        <Header displayName={doc.displayName} onRename={onRenameActor} />
        <div className="construct-inspectorBody">
          <div className="mutedNote">Select an element to edit details.</div>
        </div>
      </div>
    );
  }

  const euler = quatToEulerDegrees(attachment.rotation);
  const canSwitchTexture = textureVariants.length > 0;
  const activeVariantUrl = attachment.textureVariantUrl ?? null;

  const commitName = () => {
    const next = nameDraft.trim();
    if (!next || next === attachment.name) {
      setNameDraft(attachment.name);
      return;
    }
    onAttachmentRename(attachment.id, next);
  };

  return (
    <div className="construct-inspector">
      <Header displayName={doc.displayName} onRename={onRenameActor} />
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
          <span>Bone</span>
          <span className="construct-detailsReadonly">{attachment.boneName}</span>
        </div>
        <AxisRow
          label="Position"
          values={attachment.position}
          onCommit={(position) => onAttachmentLocal(attachment.id, { position })}
        />
        <AxisRow
          label="Scale"
          values={attachment.scale}
          onCommit={(scale) => onAttachmentLocal(attachment.id, { scale })}
        />
        <AxisRow
          label="Rotation"
          values={euler}
          onCommit={(degrees) => {
            const q = createEulerQuat(degrees);
            onAttachmentLocal(attachment.id, {
              rotation: [q[0]!, q[1]!, q[2]!, q[3]!],
            });
          }}
        />
        <div className="construct-detailsSection">
          <div className="construct-detailsSectionTitle">Variant</div>
          <select
            className="construct-detailsSelect"
            disabled={!canSwitchTexture}
            value={activeVariantUrl ?? ''}
            onChange={(e) => onAttachmentVariantChange(attachment.id, e.target.value || null)}
          >
            <option value="">Default</option>
            {textureVariants.map((v) => (
              <option key={v.url} value={v.url}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="construct-detailsSwitchRow">
          <span>Placeholder</span>
          <input
            type="checkbox"
            checked={attachment.placeholder}
            onChange={(e) => onAttachmentPlaceholderChange(attachment.id, e.target.checked)}
          />
        </div>
        <TagList
          tags={attachment.tags}
          documentTags={documentTags}
          onChange={(tags) => onAttachmentTagsChange(attachment.id, tags)}
        />
        <div className="construct-detailsFooter">
          <button
            type="button"
            className="construct-detailsDelete"
            onClick={() => onAttachmentDelete(attachment.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
