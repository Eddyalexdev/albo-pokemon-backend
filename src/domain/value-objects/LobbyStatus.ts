export const LobbyStatus = {
  Waiting: 'waiting',
  Ready: 'ready',
  Battling: 'battling',
  Finished: 'finished',
} as const;

export type LobbyStatus = (typeof LobbyStatus)[keyof typeof LobbyStatus];