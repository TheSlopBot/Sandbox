import {
  type GpuDevice,
  type TextureHandle,
  type Entity,
  type GltfCache,
  type Material,
  type Registry,
  type RenderPipeline,
  type TextureCache,
  type Transform,
  type AnimClip,
  type SimplePropCollider,
  type LevelGroundVariant,
} from 'viberanium';
import { type ConstructOrbit } from '../entities/orbit/orbit.ts';
import { type ConstructOrbitOriginMarker } from '../entities/orbit/orbitOriginMarker.ts';
import { type ConstructAnim } from '../entities/orbit/constructAnim.ts';
import {
  type ActorAiPackage,
  type ActorColliderShape,
  type ActorDocument,
  type ActorDocumentClips,
  type ActorDocumentColliderParent,
  type ActorEditorSelection,
  createEmptyActorDocument,
} from '../catalog/actors/actorDocument.ts';
import {
  type PropDocument,
  type PropEditorTransformMode,
  createEmptyPropDocument,
} from '../catalog/props/propDocument.ts';
import {
  type EquipmentDocument,
  type EquipmentDocumentCollider,
  type EquipmentDocumentProjectile,
  type EquipmentEditorSelection,
  createEmptyEquipmentDocument,
} from '../catalog/equipment/equipmentDocument.ts';
import { type LevelDocument, createEmptyLevelDocument } from '../catalog/levels/levelDocument.ts';

export type ConstructTextureVariant = {
  label: string;
  url: string;
};

export type ConstructLoadedModel = {
  kind: 'StaticProp' | 'CharacterModel';
  modelUrl: string;
  boneNames: string[];
  textureVariants: ConstructTextureVariant[];
  activeTextureVariantUrl: string | null;
};

export type ConstructLoadedAnimationPack = {
  packUrl: string;
  clipNames: string[];
};

export type ConstructTransformPatch = {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number, number];
};

export type ConstructLevelSelection = {
  instanceIds: string[];
  groupId: string | null;
};

export type ConstructSession = {
  canvas: HTMLCanvasElement;
  gameRegistry: Registry;
  sceneRegistry: Registry;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  setActive: (active: boolean) => void;
  loadModel: (modelUrl: string, textureVariants?: ConstructTextureVariant[]) => Promise<ConstructLoadedModel>;
  loadAnimationPack: (packUrl: string) => Promise<ConstructLoadedAnimationPack>;
  applyClip: (clipName: string) => void;
  clearAnimationPreview: () => void;
  resetToBindPose: () => void;
  setAnimationPaused: (paused: boolean) => void;
  setTextureVariant: (variantUrl: string | null) => Promise<void>;
  setPartTextureVariant: (partId: string, variantUrl: string | null) => Promise<PropDocument>;
  newProp: () => PropDocument;
  enterPropMode: () => Promise<PropDocument>;
  getPropDocument: () => PropDocument;
  loadPropDocument: (doc: PropDocument) => Promise<PropDocument>;
  addAssetPart: (url: string, materialPrefix?: string) => Promise<PropDocument>;
  addColliderPart: (shape: 'box' | 'cylinder' | 'sphere') => PropDocument;
  selectPart: (partId: string | null) => void;
  setTransformMode: (mode: PropEditorTransformMode) => void;
  renameProp: (name: string) => PropDocument;
  updatePartName: (partId: string, name: string) => PropDocument;
  updatePartTags: (partId: string, tags: string[]) => PropDocument;
  updatePartLocal: (partId: string, patch: ConstructTransformPatch) => PropDocument;
  removePart: (partId: string) => PropDocument;
  setPropDocumentListener: (fn: ((doc: PropDocument) => void) | null) => void;
  enterActorMode: () => Promise<ActorDocument>;
  newActor: () => ActorDocument;
  getActorDocument: () => ActorDocument;
  loadActorDocument: (doc: ActorDocument) => Promise<ActorDocument>;
  setActorCharacter: (url: string, materialPrefix: string) => Promise<ActorDocument>;
  addActorAttachment: (url: string, boneName: string, materialPrefix?: string) => Promise<ActorDocument>;
  addActorCollider: (
    shape: ActorColliderShape,
    parent: ActorDocumentColliderParent,
  ) => ActorDocument;
  selectActor: (sel: ActorEditorSelection) => void;
  renameActor: (name: string) => ActorDocument;
  updateActorTags: (tags: string[]) => ActorDocument;
  updateActorClips: (partial: Partial<ActorDocumentClips>) => ActorDocument;
  updateCharacterTextureVariant: (variantUrl: string | null) => Promise<ActorDocument>;
  setAiPackage: (aiPackage: ActorAiPackage) => ActorDocument;
  updateAttachmentName: (attachmentId: string, name: string) => ActorDocument;
  updateAttachmentLocal: (attachmentId: string, patch: ConstructTransformPatch) => ActorDocument;
  updateAttachmentTags: (attachmentId: string, tags: string[]) => ActorDocument;
  updateAttachmentPlaceholder: (attachmentId: string, placeholder: boolean) => Promise<ActorDocument>;
  updateAttachmentTextureVariant: (attachmentId: string, variantUrl: string | null) => Promise<ActorDocument>;
  removeAttachment: (attachmentId: string) => ActorDocument;
  updateColliderName: (colliderId: string, name: string) => ActorDocument;
  updateColliderLocal: (colliderId: string, patch: ConstructTransformPatch) => ActorDocument;
  updateColliderFlags: (
    colliderId: string,
    flags: { collision?: boolean; hitbox?: boolean },
  ) => ActorDocument;
  removeCollider: (colliderId: string) => ActorDocument;
  setActorDocumentListener: (fn: ((doc: ActorDocument) => void) | null) => void;
  getActorBoneNames: () => string[];
  getOrbitAngles: () => { yawRad: number; pitchRad: number };
  newEquipment: () => EquipmentDocument;
  enterEquipmentMode: () => Promise<EquipmentDocument>;
  getEquipmentDocument: () => EquipmentDocument;
  loadEquipmentDocument: (doc: EquipmentDocument) => Promise<EquipmentDocument>;
  setEquipmentMesh: (url: string, materialPrefix?: string) => Promise<EquipmentDocument>;
  addEquipmentCollider: (shape: 'box' | 'cylinder' | 'sphere') => EquipmentDocument;
  selectEquipment: (sel: EquipmentEditorSelection) => void;
  renameEquipment: (name: string) => EquipmentDocument;
  updateEquipmentKind: (kind: EquipmentDocument['kind']) => EquipmentDocument;
  updateEquipmentSlotTags: (tags: string[]) => EquipmentDocument;
  updateEquipmentStats: (partial: Partial<EquipmentDocument['stats']>) => EquipmentDocument;
  updateEquipmentClips: (partial: Partial<EquipmentDocument['clips']>) => EquipmentDocument;
  updateEquipmentProjectile: (projectile: EquipmentDocumentProjectile | undefined) => EquipmentDocument;
  updateEquipmentColliderRole: (
    colliderId: string,
    role: EquipmentDocumentCollider['role'],
  ) => EquipmentDocument;
  updateEquipmentColliderName: (colliderId: string, name: string) => EquipmentDocument;
  updateEquipmentPartLocal: (partId: string, patch: ConstructTransformPatch) => EquipmentDocument;
  removeEquipmentCollider: (colliderId: string) => EquipmentDocument;
  clearEquipmentMesh: () => EquipmentDocument;
  setEquipmentDocumentListener: (fn: ((doc: EquipmentDocument) => void) | null) => void;
  enterLevelMode: () => Promise<LevelDocument>;
  newLevel: () => Promise<LevelDocument>;
  getLevelDocument: () => LevelDocument;
  loadLevelDocument: (doc: LevelDocument) => Promise<LevelDocument>;
  setLevelDocumentListener: (fn: ((doc: LevelDocument) => void) | null) => void;
  computeSimplePropCollider: (url: string) => Promise<SimplePropCollider>;
  addSimpleProp: (
    url: string,
    materialPrefix: string,
    displayName: string,
    textureVariantUrl?: string | null,
  ) => Promise<LevelDocument>;
  addStandardProp: (doc: PropDocument) => Promise<LevelDocument>;
  addSimpleActor: (
    url: string,
    materialPrefix: string,
    displayName: string,
    textureVariantUrl?: string | null,
  ) => Promise<LevelDocument>;
  addStandardActor: (doc: ActorDocument) => Promise<LevelDocument>;
  addLevelCollider: (shape: 'box' | 'cylinder' | 'sphere') => Promise<LevelDocument>;
  selectLevelInstances: (ids: string[]) => void;
  selectLevelGroup: (groupId: string | null) => void;
  selectLevelRoot: () => void;
  selectLevelPlayerSpawn: () => void;
  selectLevelGroundPlane: () => void;
  setGroundPlaneVariant: (variant: LevelGroundVariant) => LevelDocument;
  getLevelSelection: () => ConstructLevelSelection;
  renameLevel: (name: string) => LevelDocument;
  renameInstance: (instanceId: string, name: string) => LevelDocument;
  renameGroup: (groupId: string, name: string) => LevelDocument;
  updateInstanceLocal: (instanceId: string, patch: ConstructTransformPatch) => LevelDocument;
  updateGroupLocal: (groupId: string, patch: ConstructTransformPatch) => LevelDocument;
  setInstanceAiPackage: (instanceId: string, aiPackage: ActorAiPackage) => LevelDocument;
  setSimpleVariant: (instanceId: string, variantUrl: string | null) => Promise<LevelDocument>;
  removeInstances: (ids: string[]) => LevelDocument;
  createGroup: (instanceIds: string[], name?: string) => LevelDocument;
  assignToGroup: (instanceIds: string[], groupId: string) => LevelDocument;
  ungroup: (groupId: string) => LevelDocument;
  ungroupInstances: (instanceIds: string[]) => LevelDocument;
  deleteGroup: (groupId: string, removeMembers: boolean) => LevelDocument;
  setShowColliders: (show: boolean) => void;
  setShowBones: (show: boolean) => void;
  getShowColliders: () => boolean;
  getShowBones: () => boolean;
  unload: () => void;
};

export type ConstructEditorMode = 'preview' | 'prop' | 'actor' | 'equipment' | 'level';

export type ConstructSessionDeps = {
  device: GpuDevice;
  registry: Registry;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  orbit: ConstructOrbit;
  markerT: Transform;
  marker: ConstructOrbitOriginMarker;
  constructAnim: ConstructAnim;
};

export type ConstructLevelPivotSnapshot = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type ConstructSessionState = {
  editorMode: ConstructEditorMode;
  propDocument: PropDocument;
  propDocListener: ((doc: PropDocument) => void) | null;
  actorDocument: ActorDocument;
  actorDocListener: ((doc: ActorDocument) => void) | null;
  equipmentDocument: EquipmentDocument;
  equipmentDocListener: ((doc: EquipmentDocument) => void) | null;
  levelDocument: LevelDocument;
  levelDocListener: ((doc: LevelDocument) => void) | null;
  levelSelection: ConstructLevelSelection;
  levelGroupPivotPrev: ConstructLevelPivotSnapshot | null;
  levelMultiPivotPrev: ConstructLevelPivotSnapshot | null;
  levelPropCounter: number;
  levelActorCounter: number;
  levelColliderCounter: number;
  levelGroupCounter: number;
  partCounter: number;
  attachmentCounter: number;
  colliderCounter: number;
  showColliders: boolean;
  showBones: boolean;
  selectionEnt: Entity;
  loadGeneration: number;
  loadedModelUrl: string | null;
  currentClipsByName: Map<string, AnimClip>;
  removeSkeletalSystem: (() => void) | null;
  removeStaticModelSystem: (() => void) | null;
  removeSkeletonOverlaySystem: (() => void) | null;
  removeActorColliderFollowSystem: (() => void) | null;
  activeMaterials: Material[];
  textureVariants: ConstructTextureVariant[];
  activeTextureVariantUrl: string | null;
  defaultBaseColorTex: TextureHandle | null;
};

export const createConstructSessionState = (selectionEnt: Entity): ConstructSessionState => ({
  editorMode: 'preview',
  propDocument: createEmptyPropDocument(),
  propDocListener: null,
  actorDocument: createEmptyActorDocument(),
  actorDocListener: null,
  equipmentDocument: createEmptyEquipmentDocument(),
  equipmentDocListener: null,
  levelDocument: createEmptyLevelDocument(),
  levelDocListener: null,
  levelSelection: { instanceIds: [], groupId: null },
  levelGroupPivotPrev: null,
  levelMultiPivotPrev: null,
  levelPropCounter: 0,
  levelActorCounter: 0,
  levelColliderCounter: 0,
  levelGroupCounter: 0,
  partCounter: 0,
  attachmentCounter: 0,
  colliderCounter: 0,
  showColliders: true,
  showBones: true,
  selectionEnt,
  loadGeneration: 0,
  loadedModelUrl: null,
  currentClipsByName: new Map(),
  removeSkeletalSystem: null,
  removeStaticModelSystem: null,
  removeSkeletonOverlaySystem: null,
  removeActorColliderFollowSystem: null,
  activeMaterials: [],
  textureVariants: [],
  activeTextureVariantUrl: null,
  defaultBaseColorTex: null,
});
