import { type Entity } from 'viberanium';
import { syncAttachmentOffsetFromLocal } from './spawnActorEditor.ts';

export const syncActorAttachmentAfterLocalChange = (entity: Entity) => {
  syncAttachmentOffsetFromLocal(entity);
};
