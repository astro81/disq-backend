// ws/helpers/notification-manager.ts
import type { ServerWebSocket } from 'bun'

class NotificationManager {
    // Tracks active notification WebSockets by userId
    private users = new Map<string, Set<ServerWebSocket>>()

    addClient(userId: string, ws: ServerWebSocket): void {
        if (!this.users.has(userId)) {
            this.users.set(userId, new Set())
        }
        this.users.get(userId)!.add(ws)
    }

    removeClient(userId: string, ws: ServerWebSocket): void {
        const sockets = this.users.get(userId)
        if (sockets) {
            sockets.delete(ws)
            if (sockets.size === 0) {
                this.users.delete(userId)
            }
        }
    }

    /**
     * Sends a notification to all active sessions of a user.
     * @param userId The recipient user ID
     * @param payload The notification data (will be stringified)
     */
    sendNotification(userId: string, payload: any): void {
        const sockets = this.users.get(userId)
        if (!sockets) return

        const message = JSON.stringify(payload)
        sockets.forEach((ws) => {
            if (ws.readyState === 1) { // OPEN
                ws.send(message)
            }
        })
    }
}

export const notificationManager = new NotificationManager()
