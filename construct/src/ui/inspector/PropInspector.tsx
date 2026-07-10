import { type PropDocumentPart, partListLabel } from '../../catalog/props/propDocument.ts';

export type PropInspectorProps = {
  parts: PropDocumentPart[];
  selectedPartId: string | null;
  onSelectPart: (partId: string) => void;
  documentLabel: string;
};

export const PropInspector = ({
  parts,
  selectedPartId,
  onSelectPart,
  documentLabel,
}: PropInspectorProps) => (
  <div className="construct-inspector">
    <div className="construct-inspectorHeader">
      <span>Elements</span>
      <span className="construct-subtle">{documentLabel}</span>
    </div>
    <div className="construct-inspectorBody">
      {parts.length === 0 ? (
        <div className="mutedNote">Add assets or colliders from the explorer.</div>
      ) : (
        parts.map((part) => (
          <div
            key={part.id}
            className="treeRow"
            data-selected={selectedPartId === part.id}
            onClick={() => onSelectPart(part.id)}
          >
            <div className="treeIcon">{part.kind === 'asset' ? '▣' : '◇'}</div>
            <div className="treeName">{partListLabel(part)}</div>
          </div>
        ))
      )}
    </div>
  </div>
);
