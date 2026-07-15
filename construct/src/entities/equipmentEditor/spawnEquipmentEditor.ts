import { type GpuDevice, type GltfCache, type Registry, type TextureCache } from 'viberanium';
import {
  EQUIPMENT_MESH_PART_ID,
  type EquipmentDocument,
  type EquipmentDocumentCollider,
} from '../../catalog/equipment/equipmentDocument.ts';
import {
  type PropDocumentAssetPart,
  type PropDocumentColliderPart,
} from '../../catalog/props/propDocument.ts';
import {
  clearPropEditorEntities,
  defaultColliderPart,
  removePropPartEntity,
} from '../propEditor/spawnPropEditor.ts';
import { spawnAssetPartEntity } from '../propEditor/spawnAssetPart.ts';
import { spawnColliderPartEntity } from '../propEditor/spawnColliderPart.ts';

export { clearPropEditorEntities as clearEquipmentEditorEntities };

export const equipmentMeshToPropPart = (doc: EquipmentDocument): PropDocumentAssetPart | null => {
  if (!doc.mesh.url) return null;

  return {
    id: EQUIPMENT_MESH_PART_ID,
    name: doc.displayName.trim() || 'Mesh',
    kind: 'asset',
    url: doc.mesh.url,
    materialPrefix: doc.mesh.materialPrefix || 'prop',
    tags: [],
    position: [doc.mesh.position[0], doc.mesh.position[1], doc.mesh.position[2]],
    rotation: [0, 0, 0, 1],
    scale: [doc.mesh.scale[0], doc.mesh.scale[1], doc.mesh.scale[2]],
  };
};

export const equipmentColliderToPropPart = (
  collider: EquipmentDocumentCollider,
): PropDocumentColliderPart => ({
  id: collider.id,
  name: collider.name,
  kind: 'collider',
  shape: collider.shape,
  halfExtents: collider.halfExtents,
  radius: collider.radius,
  halfHeight: collider.halfHeight,
  position: [collider.position[0], collider.position[1], collider.position[2]],
  rotation: [collider.rotation[0], collider.rotation[1], collider.rotation[2], collider.rotation[3]],
  scale: [collider.scale[0], collider.scale[1], collider.scale[2]],
});

export const equipmentDocToPropParts = (doc: EquipmentDocument) => ({
  meshPart: equipmentMeshToPropPart(doc),
  colliderParts: doc.colliders.map(equipmentColliderToPropPart),
});

export const defaultEquipmentCollider = (
  shape: 'box' | 'cylinder' | 'sphere',
  id: string,
  role: EquipmentDocumentCollider['role'],
): EquipmentDocumentCollider => {
  const part = defaultColliderPart(shape, id);

  return {
    id: part.id,
    name: part.name,
    role,
    shape: part.shape,
    halfExtents: part.halfExtents,
    radius: part.radius,
    halfHeight: part.halfHeight,
    position: part.position,
    rotation: part.rotation,
    scale: part.scale,
  };
};

export const spawnEquipmentContent = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  rootId: number,
  doc: EquipmentDocument,
  showColliders: boolean,
) => {
  const { meshPart, colliderParts } = equipmentDocToPropParts(doc);

  if (meshPart) {
    await spawnAssetPartEntity(device, registry, textures, gltfCache, rootId, meshPart);
  }

  for (const part of colliderParts) {
    spawnColliderPartEntity(device, registry, rootId, part, showColliders);
  }
};

export const replaceEquipmentMeshEntity = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  rootId: number,
  doc: EquipmentDocument,
) => {
  removePropPartEntity(registry, EQUIPMENT_MESH_PART_ID);
  const meshPart = equipmentMeshToPropPart(doc);
  if (!meshPart) return;
  await spawnAssetPartEntity(device, registry, textures, gltfCache, rootId, meshPart);
};
