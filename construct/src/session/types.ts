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
} from 'viberanium';
import { type ConstructOrbit } from '../entities/orbit/orbit.ts';
import { type ConstructOrbitOriginMarker } from '../entities/orbit/orbitOriginMarker.ts';
import { type ConstructAnim } from '../entities/orbit/constructAnim.ts';
import {
  type ActorAiPackage,
  type ActorColliderShape,
  type ActorDocument,
  type ActorDocumentColliderParent,
  type ActorEditorSelection,
  createEmptyActorDocument,
} from '../catalog/actors/actorDocument.ts';
import {
  type PropDocument,
  type PropEditorTransformMode,
  createEmptyPropDocument,
} from '../catalog/props/propDocument.ts';

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
  addColliderPart: (shape: 'box' | 'cylinder' | 'sphere' | 'capsule') => PropDocument;
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
  unload: () => void;
};

export type ConstructEditorMode = 'preview' | 'prop' | 'actor';

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

export type ConstructSessionState = {
  editorMode: ConstructEditorMode;
  propDocument: PropDocument;
  propDocListener: ((doc: PropDocument) => void) | null;
  actorDocument: ActorDocument;
  actorDocListener: ((doc: ActorDocument) => void) | null;
  partCounter: number;
  attachmentCounter: number;
  colliderCounter: number;
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
  partCounter: 0,
  attachmentCounter: 0,
  colliderCounter: 0,
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
