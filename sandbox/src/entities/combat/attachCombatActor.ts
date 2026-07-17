import {
  type Entity,
  type ActorDefinition,
  createHealth,
  createCombatIntent,
  createEquipmentSlots,
  createRightHandStateMachine,
  createLeftHandStateMachine,
  createRightHandClipMap,
  createLeftHandClipMap,
  createAnimationHandMasks,
  createAnimationAimOffset,
  createAnimationPoseOverlay,
  createAnimationFullBody,
  createChildren,
  COMPONENT_KEYS,
  type EquipmentPlaceholderSlot,
  type SkeletalModel,
} from 'viberanium';
import { EQUIPMENT_SLOT_TAGS } from '../../catalog/keys/equipment.ts';

const collectPlaceholders = (actor: ActorDefinition): EquipmentPlaceholderSlot[] =>
  actor.attachments
    .filter((attachment) => attachment.placeholder)
    .map((attachment) => ({
      id: attachment.id,
      slotTags: attachment.tags.length > 0 ? attachment.tags : inferTags(attachment.id),
      boneName: attachment.boneName,
      position: attachment.position,
      rotation: attachment.rotation,
      scale: attachment.scale,
    }));

const inferTags = (id: string): string[] => {
  if (id.includes('right') || id.includes('Right')) return [EQUIPMENT_SLOT_TAGS.rightHand];
  if (id.includes('left') || id.includes('Left')) return [EQUIPMENT_SLOT_TAGS.leftHand];
  return [];
};

export const attachCombatActor = (
  entity: Entity,
  actor: ActorDefinition,
  opts: { health?: number } = {},
): void => {
  entity.components[COMPONENT_KEYS.health] = createHealth(opts.health ?? 10);
  entity.components[COMPONENT_KEYS.combatIntent] = createCombatIntent();
  entity.components[COMPONENT_KEYS.equipmentSlots] = createEquipmentSlots(
    collectPlaceholders(actor),
  );
  entity.components[COMPONENT_KEYS.rightHandStateMachine] = createRightHandStateMachine();
  entity.components[COMPONENT_KEYS.leftHandStateMachine] = createLeftHandStateMachine();
  entity.components[COMPONENT_KEYS.rightHandClipMap] = createRightHandClipMap();
  entity.components[COMPONENT_KEYS.leftHandClipMap] = createLeftHandClipMap();
  entity.components[COMPONENT_KEYS.animationAimOffset] = createAnimationAimOffset();
  entity.components[COMPONENT_KEYS.animationPoseOverlay] = createAnimationPoseOverlay();
  entity.components[COMPONENT_KEYS.animationFullBody] = createAnimationFullBody();

  const model = entity.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (model) {
    entity.components[COMPONENT_KEYS.animationHandMasks] = createAnimationHandMasks(model.bodyScene);
  }

  if (!entity.components[COMPONENT_KEYS.children]) {
    entity.components[COMPONENT_KEYS.children] = createChildren();
  }
};
