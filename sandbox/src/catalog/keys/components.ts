export const GAME_COMPONENT_KEYS = {
  playerController: 'playerController',
  playerHelmet: 'playerHelmet',
  playerJetpack: 'playerJetpack',
  playerBlade: 'playerBlade',
  testAi: 'testAi',
  robot: 'robot',
  combatMech: 'combatMech',
  dummy: 'dummy',
} as const;

export type GameComponentKey = (typeof GAME_COMPONENT_KEYS)[keyof typeof GAME_COMPONENT_KEYS];
