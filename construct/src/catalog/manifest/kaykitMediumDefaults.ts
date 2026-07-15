const KAYKIT_BASE = `${import.meta.env.BASE_URL}assets/kaykit`;

export const KAYKIT_MEDIUM_ANIM_PACK = {
  generalGlb: `${KAYKIT_BASE}/KayKit Character Animations 1.1/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`,
  movementGlb: `${KAYKIT_BASE}/KayKit Character Animations 1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`,
  movementAdvancedGlb: `${KAYKIT_BASE}/KayKit Character Animations 1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementAdvanced.glb`,
};

export const KAYKIT_MEDIUM_CLIPS = {
  idle: 'idle_a',
  run: 'running_a',
  walkBack: 'Walking_Backwards',
  jumpStart: 'jump_start',
  jumpIdle: 'jump_idle',
  jumpLand: 'jump_land',
};
