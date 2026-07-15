export type WeaponKind = 'melee' | 'ranged' | 'shield';

export type WeaponColliderDef = {
  role: 'weapon' | 'shield';
  shape: 'box' | 'cylinder' | 'sphere';
  halfExtents?: [number, number, number];
  radius?: number;
  halfHeight?: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export type WeaponClipBinding = {
  clipName: string;
  animPackUrl?: string;
};

export type WeaponClipSlot = 'attack' | 'aim' | 'reload' | 'block' | 'idleHold';

export type WeaponDefinition = {
  id: string;
  displayName: string;
  kind: WeaponKind;
  slotTags: string[];
  mesh: {
    url: string;
    materialPrefix: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  };
  colliders: WeaponColliderDef[];
  projectile?: {
    shape: 'sphere';
    radius: number;
    localOffset: [number, number, number];
    speed: number;
  };
  stats: {
    damage: number;
    hitWindowStart?: number;
    hitWindowEnd?: number;
    fireRate?: number;
    blockAngleDeg?: number;
  };
  torsoYawCurve?: {
    windUpEnd: number;
    swingEnd: number;
    windUpYaw: number;
    swingYaw: number;
  };
  clips: {
    attack?: WeaponClipBinding | string;
    aim?: WeaponClipBinding | string;
    reload?: WeaponClipBinding | string;
    block?: WeaponClipBinding | string;
    idleHold?: WeaponClipBinding | string;
  };
  animPack?: { generalGlb: string };
};

export const normalizeWeaponClipBinding = (
  clip: WeaponClipBinding | string | undefined,
  fallbackAnimPackUrl?: string,
): WeaponClipBinding | undefined => {
  if (!clip) return undefined;
  if (typeof clip === 'string') {
    if (!clip) return undefined;
    return { clipName: clip, animPackUrl: fallbackAnimPackUrl };
  }
  if (!clip.clipName) return undefined;
  return {
    clipName: clip.clipName,
    animPackUrl: clip.animPackUrl ?? fallbackAnimPackUrl,
  };
};

export const collectUrlsFromWeapon = (weapon: WeaponDefinition): string[] => {
  const urls = new Set<string>();
  if (weapon.mesh.url) urls.add(weapon.mesh.url);
  if (weapon.animPack?.generalGlb) urls.add(weapon.animPack.generalGlb);
  for (const key of ['attack', 'aim', 'reload', 'block', 'idleHold'] as const) {
    const binding = normalizeWeaponClipBinding(weapon.clips[key], weapon.animPack?.generalGlb);
    if (binding?.animPackUrl) urls.add(binding.animPackUrl);
  }
  return [...urls];
};
