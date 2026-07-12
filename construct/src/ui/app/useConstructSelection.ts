import { useState } from 'react';
import { type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';
import { type ConstructLevelSelection } from '../../session/types.ts';

export const useConstructSelection = () => {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [actorSelection, setActorSelection] = useState<ActorEditorSelection>(null);
  const [levelSelection, setLevelSelection] = useState<ConstructLevelSelection>({
    instanceIds: [],
    groupId: null,
  });

  return {
    selectedPartId,
    setSelectedPartId,
    actorSelection,
    setActorSelection,
    levelSelection,
    setLevelSelection,
  };
};

export type UseConstructSelectionResult = ReturnType<typeof useConstructSelection>;
