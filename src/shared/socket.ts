/**
 * Socket.IO helpers shared across the infrastructure layer.
 */

/**
 * Returns the Socket.IO room name for a lobby.
 * All clients in this room receive lobby-related events.
 */
export function lobbyRoom(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}
