export const EQUIPMENT_SLOT_TAGS = {
  rightHand: 'slot:rightHand',
  leftHand: 'slot:leftHand',
} as const;

export type EquipmentSlotTag =
  (typeof EQUIPMENT_SLOT_TAGS)[keyof typeof EQUIPMENT_SLOT_TAGS];
