import type {
  ActorDocument,
  ActorDocumentAttachment,
  ActorDocumentCollider,
  ActorEditorSelection,
} from '../../catalog/actors/actorDocument.ts';
import { attachmentListLabel, colliderListLabel } from '../../catalog/actors/actorDocument.ts';

export type ActorInspectorProps = {
  doc: ActorDocument;
  boneNames: readonly string[];
  selection: ActorEditorSelection;
  documentLabel: string;
  onSelect: (sel: ActorEditorSelection) => void;
};

export const ActorInspector = ({
  doc,
  boneNames,
  selection,
  documentLabel,
  onSelect,
}: ActorInspectorProps) => {
  const characterLabel = doc.character
    ? (doc.character.url.split('/').slice(-1)[0] ?? 'Character')
    : 'No character';

  const isActorSelected = selection?.kind === 'actor';
  const selectedBone = selection?.kind === 'bone' ? selection.boneName : null;
  const selectedAttachment =
    selection?.kind === 'attachment' ? selection.attachmentId : null;
  const selectedCollider = selection?.kind === 'collider' ? selection.colliderId : null;

  const attachmentsByBone = new Map<string, ActorDocumentAttachment[]>();
  for (const a of doc.attachments) {
    const list = attachmentsByBone.get(a.boneName) ?? [];
    list.push(a);
    attachmentsByBone.set(a.boneName, list);
  }

  const collidersByBone = new Map<string, ActorDocumentCollider[]>();
  const collidersByAttachment = new Map<string, ActorDocumentCollider[]>();
  for (const c of doc.colliders) {
    if (c.parent.kind === 'bone') {
      const list = collidersByBone.get(c.parent.boneName) ?? [];
      list.push(c);
      collidersByBone.set(c.parent.boneName, list);
    } else {
      const list = collidersByAttachment.get(c.parent.attachmentId) ?? [];
      list.push(c);
      collidersByAttachment.set(c.parent.attachmentId, list);
    }
  }

  const sortedBoneNames = [...boneNames].sort((a, b) => a.localeCompare(b));

  return (
    <div className="construct-inspector">
      <div className="construct-inspectorHeader">
        <span>Elements</span>
        <span className="construct-subtle">{documentLabel}</span>
      </div>
      <div className="construct-inspectorBody">
        {!doc.character ? (
          <div className="mutedNote">Add a character from the explorer.</div>
        ) : (
          <div className="construct-elementsTree">
            <div
              className="construct-elementsRow"
              data-selected={isActorSelected}
              onClick={() => onSelect({ kind: 'actor' })}
            >
              <span>◎</span>
              <span>{characterLabel}</span>
            </div>
            {sortedBoneNames.map((boneName) => {
              const attachments = attachmentsByBone.get(boneName) ?? [];
              const boneColliders = collidersByBone.get(boneName) ?? [];
              return (
                <div key={boneName}>
                  <div
                    className="construct-elementsRow"
                    style={{ paddingLeft: 16 }}
                    data-selected={selectedBone === boneName}
                    onClick={() => onSelect({ kind: 'bone', boneName })}
                  >
                    <span>○</span>
                    <span>{boneName}</span>
                  </div>
                  {attachments.map((a) => (
                    <div key={a.id}>
                      <div
                        className="construct-elementsRow"
                        style={{ paddingLeft: 32 }}
                        data-selected={selectedAttachment === a.id}
                        onClick={() => onSelect({ kind: 'attachment', attachmentId: a.id })}
                      >
                        <span>▣</span>
                        <span>{attachmentListLabel(a)}</span>
                      </div>
                      {(collidersByAttachment.get(a.id) ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="construct-elementsRow"
                          style={{ paddingLeft: 48 }}
                          data-selected={selectedCollider === c.id}
                          onClick={() => onSelect({ kind: 'collider', colliderId: c.id })}
                        >
                          <span>◇</span>
                          <span>{colliderListLabel(c)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {boneColliders.map((c) => (
                    <div
                      key={c.id}
                      className="construct-elementsRow"
                      style={{ paddingLeft: 32 }}
                      data-selected={selectedCollider === c.id}
                      onClick={() => onSelect({ kind: 'collider', colliderId: c.id })}
                    >
                      <span>◇</span>
                      <span>{colliderListLabel(c)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
