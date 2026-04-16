export const LobbyStatus = {
  Waiting: 'waiting',
  Ready: 'ready',
  Battling: 'battling',
  Finished: 'finished',
} as const;

export type LobbyStatusValue = (typeof LobbyStatus)[keyof typeof LobbyStatus];