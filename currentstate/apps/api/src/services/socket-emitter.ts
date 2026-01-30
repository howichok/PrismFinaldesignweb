import type { Server as SocketIOServer } from "socket.io";

/**
 * Singleton module to share Socket.io server instance across services.
 * This allows notification and other services to emit events without
 * circular dependencies or prop drilling.
 */

let io: SocketIOServer | null = null;

/**
 * Set the Socket.io server instance. Call this once during app bootstrap.
 */
export function setSocketIO(server: SocketIOServer): void {
  io = server;
}

/**
 * Get the Socket.io server instance.
 * Returns null if not yet initialized.
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit an event to a specific user's room.
 * @param userId The user ID to emit to
 * @param event The event name
 * @param data The data to send
 */
export function emitToUser<T>(userId: string, event: string, data: T): void {
  if (!io) {
    console.warn("[SocketEmitter] Socket.io not initialized, cannot emit event:", event);
    return;
  }
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit an event to all connected sockets (broadcast).
 * @param event The event name
 * @param data The data to send
 */
export function emitToAll<T>(event: string, data: T): void {
  if (!io) {
    console.warn("[SocketEmitter] Socket.io not initialized, cannot emit event:", event);
    return;
  }
  io.emit(event, data);
}
