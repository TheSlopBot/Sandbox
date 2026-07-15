import {
  type EquipmentDocument,
  type EquipmentEditorSelection,
} from '../../catalog/equipment/equipmentDocument.ts';

export type EquipmentInspectorProps = {
  doc: EquipmentDocument;
  selection: EquipmentEditorSelection;
  documentLabel: string;
  onSelect: (sel: EquipmentEditorSelection) => void;
};

export const EquipmentInspector = ({
  doc,
  selection,
  documentLabel,
  onSelect,
}: EquipmentInspectorProps) => {
  const isRootSelected = selection?.kind === 'root';
  const isMeshSelected = selection?.kind === 'mesh';
  const selectedCollider = selection?.kind === 'collider' ? selection.colliderId : null;
  const isProjectileSelected = selection?.kind === 'projectile';
  const meshLabel = doc.mesh.url
    ? (doc.mesh.url.split('/').slice(-1)[0] ?? 'Mesh')
    : 'Mesh';

  return (
    <div className="construct-inspector">
      <div className="construct-inspectorHeader">
        <span>Elements</span>
        <span className="construct-subtle">{documentLabel}</span>
      </div>
      <div className="construct-inspectorBody">
        <div className="construct-elementsTree">
          <div
            className="construct-elementsRow"
            data-selected={isRootSelected}
            onClick={() => onSelect({ kind: 'root' })}
          >
            <span>◎</span>
            <span>{doc.displayName || 'Equipment'}</span>
          </div>
          <div
            className="construct-elementsRow"
            style={{ paddingLeft: 16 }}
            data-selected={isMeshSelected}
            onClick={() => onSelect({ kind: 'mesh' })}
          >
            <span>▣</span>
            <span>{meshLabel}</span>
          </div>
          <div className="construct-elementsRow" style={{ paddingLeft: 16 }}>
            <span>◇</span>
            <span>Colliders</span>
          </div>
          {doc.colliders.length === 0 ? (
            <div className="mutedNote" style={{ paddingLeft: 32 }}>
              No colliders
            </div>
          ) : (
            doc.colliders.map((c) => (
              <div
                key={c.id}
                className="construct-elementsRow"
                style={{ paddingLeft: 32 }}
                data-selected={selectedCollider === c.id}
                onClick={() => onSelect({ kind: 'collider', colliderId: c.id })}
              >
                <span>◇</span>
                <span>
                  {c.name} - {c.shape} ({c.role})
                </span>
              </div>
            ))
          )}
          {doc.kind === 'ranged' ? (
            <div
              className="construct-elementsRow"
              style={{ paddingLeft: 16 }}
              data-selected={isProjectileSelected}
              onClick={() => onSelect({ kind: 'projectile' })}
            >
              <span>○</span>
              <span>Projectile</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
