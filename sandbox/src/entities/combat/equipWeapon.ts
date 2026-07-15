import {
  type GpuDevice,
  type Registry,
  type Entity,
  type TextureCache,
  type GltfCache,
  type WeaponDefinition,
  type EquipmentSlots,
  type SkeletalModel,
  type RightHandClipMap,
  type LeftHandClipMap,
  type RightHandStateMachine,
  type AnimationClip,
  createTransform,
  createChildOf,
  createChildren,
  createMeshDraws,
  createBoneAttachment,
  createAttachmentOffset,
  createWeapon,
  createInterleavedMesh,
  createAnimationClip,
  addChildId,
  removeChildId,
  destroyMesh,
  findBoneNodeIndex,
  getOrBuildRuntimeScene,
  buildGltfMaterials,
  buildRetargetedClips,
  updateWorldFromLocals,
  m4,
  m4Mul,
  COMPONENT_KEYS,
  normalizeWeaponClipBinding,
  clearRightHandClipMap,
  clearLeftHandClipMap,
} from 'viberanium';
import { EQUIPMENT_SLOT_TAGS } from '../../catalog/keys/equipment.ts';
import { pickClip } from '../actor/pickClip.ts';

const IDENTITY_ROTATION: [number, number, number, number] = [0, 0, 0, 1];

const handForWeapon = (weapon: WeaponDefinition): 'right' | 'left' | null => {
  if (weapon.slotTags.includes(EQUIPMENT_SLOT_TAGS.rightHand)) return 'right';
  if (weapon.slotTags.includes(EQUIPMENT_SLOT_TAGS.leftHand)) return 'left';
  return null;
};

const loadWeaponClip = async (
  gltfCache: GltfCache,
  bodyScene: SkeletalModel['bodyScene'],
  weapon: WeaponDefinition,
  slot: 'attack' | 'aim' | 'reload' | 'block' | 'idleHold',
): Promise<AnimationClip | undefined> => {
  const binding = normalizeWeaponClipBinding(weapon.clips[slot], weapon.animPack?.generalGlb);
  if (!binding?.clipName || !binding.animPackUrl) return undefined;

  const loaded = await gltfCache.getOrLoad(binding.animPackUrl);
  const clips = buildRetargetedClips(loaded, bodyScene.nodes);
  return createAnimationClip(pickClip(clips, binding.clipName));
};

const unequipSlot = (
  registry: Registry,
  wielder: Entity,
  slots: EquipmentSlots,
  hand: 'right' | 'left',
): void => {
  const slot = slots[hand];
  if (slot.entityId === null) return;

  const children = wielder.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (children) removeChildId(children, slot.entityId);
  if (registry.get(slot.entityId)) registry.deregister(slot.entityId);
  slot.entityId = null;
  slot.equippedId = null;

  const model = wielder.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (hand === 'right') {
    const clipMap = wielder.components[COMPONENT_KEYS.rightHandClipMap] as
      | RightHandClipMap
      | undefined;
    if (clipMap) clearRightHandClipMap(clipMap);
  } else {
    const clipMap = wielder.components[COMPONENT_KEYS.leftHandClipMap] as
      | LeftHandClipMap
      | undefined;
    if (clipMap) clearLeftHandClipMap(clipMap);
  }
  if (model) model.clipsDirty = true;
};

const fillHandClips = async (
  gltfCache: GltfCache,
  wielder: Entity,
  weapon: WeaponDefinition,
  hand: 'right' | 'left',
): Promise<void> => {
  const model = wielder.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (!model) return;

  if (hand === 'right') {
    const clipMap = wielder.components[COMPONENT_KEYS.rightHandClipMap] as
      | RightHandClipMap
      | undefined;
    if (!clipMap) return;
    clearRightHandClipMap(clipMap);

    const idleHold = await loadWeaponClip(gltfCache, model.bodyScene, weapon, 'idleHold');
    const attack = await loadWeaponClip(gltfCache, model.bodyScene, weapon, 'attack');
    const aim = await loadWeaponClip(gltfCache, model.bodyScene, weapon, 'aim');
    const reload = await loadWeaponClip(gltfCache, model.bodyScene, weapon, 'reload');

    if (idleHold) clipMap.clips.idleHold = idleHold;
    if (attack) clipMap.clips.attack = attack;
    if (aim) clipMap.clips.aim = aim;
    if (reload) clipMap.clips.reload = reload;

    const fsm = wielder.components[COMPONENT_KEYS.rightHandStateMachine] as
      | RightHandStateMachine
      | undefined;
    if (fsm && attack?.clip.duration && attack.clip.duration > 0) {
      fsm.attackDuration = attack.clip.duration;
    }
  } else {
    const clipMap = wielder.components[COMPONENT_KEYS.leftHandClipMap] as
      | LeftHandClipMap
      | undefined;
    if (!clipMap) return;
    clearLeftHandClipMap(clipMap);

    const idleHold = await loadWeaponClip(gltfCache, model.bodyScene, weapon, 'idleHold');
    const block = await loadWeaponClip(gltfCache, model.bodyScene, weapon, 'block');
    if (idleHold) clipMap.clips.idleHold = idleHold;
    if (block) clipMap.clips.block = block;
  }

  model.clipsDirty = true;
};

export const equipWeapon = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  wielder: Entity,
  weapon: WeaponDefinition,
): Promise<boolean> => {
  const slots = wielder.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots | undefined;
  const model = wielder.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (!slots || !model) return false;

  const hand = handForWeapon(weapon);
  if (!hand) return false;

  const placeholder =
    slots.placeholders.find((p) => p.slotTags.some((tag) => weapon.slotTags.includes(tag))) ??
    null;
  const boneName = placeholder?.boneName ?? (hand === 'right' ? 'hand.r' : 'hand.l');
  const boneNodeIndex = findBoneNodeIndex(model.bodyScene.nodes, boneName);
  if (boneNodeIndex < 0) return false;

  unequipSlot(registry, wielder, slots, hand);

  const loaded = await gltfCache.getOrLoad(weapon.mesh.url);
  const attachScene = getOrBuildRuntimeScene(loaded);
  updateWorldFromLocals(attachScene.nodes);
  const mats = buildGltfMaterials(loaded, weapon.mesh.materialPrefix, textures);

  const slotOffset = createAttachmentOffset(
    placeholder?.position ?? [0, 0, 0],
    placeholder?.rotation ?? IDENTITY_ROTATION,
    placeholder?.scale ?? [1, 1, 1],
  );
  const meshOffset = createAttachmentOffset(
    weapon.mesh.position,
    IDENTITY_ROTATION,
    weapon.mesh.scale,
  );
  const localOffset = m4Mul(m4(), slotOffset, meshOffset);

  const parts = [];
  for (const pair of attachScene.meshNodePairs) {
    const modelMesh = attachScene.models[pair.meshIndex];
    if (!modelMesh) continue;
    for (const prim of modelMesh.primitives) {
      if (prim.kind === 'skinned') continue;
      const material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;
      parts.push({
        mesh: createInterleavedMesh(device, prim.vertices, prim.indices),
        material,
        gltfNodeIndex: pair.nodeIndex,
        visible: true,
      });
    }
  }

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = createTransform();
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(wielder.id);
  entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
    attachScene,
    boneNodeIndex,
    localOffset,
  );
  entity.components[COMPONENT_KEYS.meshDraws] = createMeshDraws(parts);
  entity.components[COMPONENT_KEYS.weapon] = createWeapon({
    defId: weapon.id,
    kind: weapon.kind,
    slot: hand,
    damage: weapon.stats.damage,
    hitWindowStart: weapon.stats.hitWindowStart,
    hitWindowEnd: weapon.stats.hitWindowEnd,
    fireRate: weapon.stats.fireRate,
    projectileSpeed: weapon.projectile?.speed,
    blockAngleDeg: weapon.stats.blockAngleDeg,
  });

  for (const part of parts) {
    entity.onDeregister.push(() => destroyMesh(device, part.mesh));
  }

  registry.register(entity);

  const children = wielder.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (children) addChildId(children, entity.id);
  else wielder.components[COMPONENT_KEYS.children] = createChildren([entity.id]);

  slots[hand].entityId = entity.id;
  slots[hand].equippedId = weapon.id;

  await fillHandClips(gltfCache, wielder, weapon, hand);
  return true;
};

export const stowRightWeapon = (registry: Registry, wielder: Entity): void => {
  const slots = wielder.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots | undefined;
  if (!slots) return;
  unequipSlot(registry, wielder, slots, 'right');
};

export const unequipLeftWeapon = (registry: Registry, wielder: Entity): void => {
  const slots = wielder.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots | undefined;
  if (!slots) return;
  unequipSlot(registry, wielder, slots, 'left');
};
