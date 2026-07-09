import { GAME_COMPONENT_KEYS } from './components.ts';

export const PLAYER_ATTACHMENT_TAGS = {
  helmet: GAME_COMPONENT_KEYS.playerHelmet,
  jetpack: GAME_COMPONENT_KEYS.playerJetpack,
  blade: GAME_COMPONENT_KEYS.playerBlade,
} as const;
