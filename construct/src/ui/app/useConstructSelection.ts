import { useState } from 'react';
import { type ActorEditorSelection } from '../../catalog/actors/actorDocument.ts';

export const useConstructSelection = () => {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [actorSelection, setActorSelection] = useState<ActorEditorSelection>(null);

  return { selectedPartId, setSelectedPartId, actorSelection, setActorSelection };
};

export type UseConstructSelectionResult = ReturnType<typeof useConstructSelection>;
