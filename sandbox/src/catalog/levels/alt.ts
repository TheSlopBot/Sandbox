import { CUBE_SMALL, CUBE_LARGE } from '../assets/kaykit.ts';
import { type LevelDefinition } from './levelDefinition.ts';
import { DEFAULT_NAV_GRID, buildCombatMechPerfSpawns } from './helpers.ts';

export const LEVEL_ALT: LevelDefinition = {
  id: 'alt',
  displayName: 'Test Corridor',
  navGrid: DEFAULT_NAV_GRID,
  props: [
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -10.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -7.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -5.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: -2.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 0.0, z: 0.0, yaw: Math.PI / 4 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 2.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 5.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 7.5, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 10.0, z: 0.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 0.0, z: -5.0 } },
    { url: CUBE_SMALL, prefix: 'proto', opts: { x: 0.0, z: 5.0 } },
    { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: 0.0, z: -10.0, yaw: Math.PI / 2 } },
    { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: 0.0, z: 10.0, yaw: -Math.PI / 2 } },
    { url: CUBE_LARGE, prefix: 'proto_large', opts: { x: -12.0, z: 8.0, yaw: Math.PI / 3 } },
  ],
  combatMechs: buildCombatMechPerfSpawns(100),
};
