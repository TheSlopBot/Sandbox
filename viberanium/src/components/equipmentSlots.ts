export type EquipmentSlotState = {
  equippedId: string | null;
  entityId: number | null;
};

export type EquipmentPlaceholderSlot = {
  id: string;
  slotTags: string[];
  boneName: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type EquipmentSlots = {
  right: EquipmentSlotState;
  left: EquipmentSlotState;
  placeholders: EquipmentPlaceholderSlot[];
};

export const createEquipmentSlots = (
  placeholders: EquipmentPlaceholderSlot[] = [],
): EquipmentSlots => ({
  right: { equippedId: null, entityId: null },
  left: { equippedId: null, entityId: null },
  placeholders,
});
