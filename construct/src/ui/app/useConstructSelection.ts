import { useState } from 'react';
import { type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';
import { type EquipmentEditorSelection } from '../../catalog/equipment/equipmentDocument.ts';
import { type ConstructLevelSelection } from '../../session/types.ts';

export const useConstructSelection = () => {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [actorSelection, setActorSelection] = useState<ActorEditorSelection>(null);
  const [equipmentSelection, setEquipmentSelection] = useState<EquipmentEditorSelection>({
    kind: 'root',
  });
  const [levelSelection, setLevelSelection] = useState<ConstructLevelSelection>({
    instanceIds: [],
    groupId: null,
  });

  return {
    selectedPartId,
    setSelectedPartId,
    actorSelection,
    setActorSelection,
    equipmentSelection,
    setEquipmentSelection,
    levelSelection,
    setLevelSelection,
  };
};

export type UseConstructSelectionResult = ReturnType<typeof useConstructSelection>;
