import {
  LEVEL_PLAYER_SPAWN_ID,
  type LevelDocument,
  type LevelDocumentActorInstance,
  type LevelDocumentColliderInstance,
  type LevelDocumentPropInstance,
} from '../../catalog/levels/levelDocument.ts';
import { type ConstructLevelSelection } from '../../session/types.ts';

export type LevelInspectorProps = {
  doc: LevelDocument;
  selection: ConstructLevelSelection;
  documentLabel: string;
  onSelectRoot: () => void;
  onSelectInstance: (id: string, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectPlayerSpawn: () => void;
};

const instanceRow = (
  instance: LevelDocumentPropInstance | LevelDocumentActorInstance | LevelDocumentColliderInstance,
  icon: string,
  selected: boolean,
  depth: number,
  onSelectInstance: (id: string, additive: boolean) => void,
) => (
  <div
    key={instance.id}
    className="construct-elementsRow"
    style={{ paddingLeft: depth * 16 }}
    data-selected={selected}
    onClick={(e) => onSelectInstance(instance.id, e.shiftKey || e.metaKey || e.ctrlKey)}
  >
    <span>{icon}</span>
    <span>{instance.name}</span>
  </div>
);

export const LevelInspector = ({
  doc,
  selection,
  documentLabel,
  onSelectRoot,
  onSelectInstance,
  onSelectGroup,
  onSelectPlayerSpawn,
}: LevelInspectorProps) => {
  const isRootSelected = selection.instanceIds.length === 0 && !selection.groupId;
  const selectedIds = new Set(selection.instanceIds);
  const playerSpawnSelected =
    selection.instanceIds.length === 1 && selection.instanceIds[0] === LEVEL_PLAYER_SPAWN_ID;

  const simpleProps = doc.composition.props.filter((p) => p.kind === 'simpleProp');
  const standardProps = doc.composition.props.filter((p) => p.kind === 'standardProp');
  const simpleActors = doc.composition.actors.filter((a) => a.kind === 'simpleActor');
  const standardActors = doc.composition.actors.filter((a) => a.kind === 'standardActor');
  const colliders = doc.composition.colliders;
  const hasProps = simpleProps.length > 0 || standardProps.length > 0;
  const hasActors = simpleActors.length > 0 || standardActors.length > 0;

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
            onClick={onSelectRoot}
          >
            <span>▤</span>
            <span>{doc.displayName}</span>
          </div>

          <div
            className="construct-elementsRow"
            style={{ paddingLeft: 16 }}
            data-selected={playerSpawnSelected}
            onClick={onSelectPlayerSpawn}
          >
            <span>◎</span>
            <span>Player Spawn</span>
          </div>

          {hasProps ? (
            <>
              <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 16 }}>
                <span>▣</span>
                <span>Props</span>
              </div>
              {simpleProps.length > 0 ? (
                <>
                  <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 32 }}>
                    <span>Simple</span>
                  </div>
                  {simpleProps.map((p) => instanceRow(p, '▣', selectedIds.has(p.id), 3, onSelectInstance))}
                </>
              ) : null}
              {standardProps.length > 0 ? (
                <>
                  <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 32 }}>
                    <span>Standard</span>
                  </div>
                  {standardProps.map((p) => instanceRow(p, '▣', selectedIds.has(p.id), 3, onSelectInstance))}
                </>
              ) : null}
            </>
          ) : null}

          {hasActors ? (
            <>
              <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 16 }}>
                <span>◎</span>
                <span>Actors</span>
              </div>
              {simpleActors.length > 0 ? (
                <>
                  <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 32 }}>
                    <span>Simple</span>
                  </div>
                  {simpleActors.map((a) => instanceRow(a, '◎', selectedIds.has(a.id), 3, onSelectInstance))}
                </>
              ) : null}
              {standardActors.length > 0 ? (
                <>
                  <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 32 }}>
                    <span>Standard</span>
                  </div>
                  {standardActors.map((a) => instanceRow(a, '◎', selectedIds.has(a.id), 3, onSelectInstance))}
                </>
              ) : null}
            </>
          ) : null}

          {colliders.length > 0 ? (
            <>
              <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 16 }}>
                <span>◇</span>
                <span>Colliders</span>
              </div>
              {colliders.map((c) => instanceRow(c, '◇', selectedIds.has(c.id), 2, onSelectInstance))}
            </>
          ) : null}

          {doc.groups.length > 0 ? (
            <>
              <div className="construct-elementsRow construct-elementsGroupHeader" style={{ paddingLeft: 16 }}>
                <span>◫</span>
                <span>Groups</span>
              </div>
              {doc.groups.map((g) => (
                <div
                  key={g.id}
                  className="construct-elementsRow"
                  style={{ paddingLeft: 32 }}
                  data-selected={selection.groupId === g.id}
                  onClick={() => onSelectGroup(g.id)}
                >
                  <span>◫</span>
                  <span>{g.name}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
