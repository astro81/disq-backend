// ws/helpers/dm-manager.ts
import { ClientMeta } from './websocket.types'

/** Manages DM conversation rooms (mirrors channel-manager) */
class DmManager {
    private rooms = new Map<string, Set<ClientMeta>>()

    addClient(conversationId: string, client: ClientMeta): void {
        if (!this.rooms.has(conversationId)) {
            this.rooms.set(conversationId, new Set())
        }
        this.rooms.get(conversationId)!.add(client)
    }

    removeClient(conversationId: string, client: ClientMeta): void {
        const room = this.rooms.get(conversationId)
        if (room) {
            room.delete(client)
            if (room.size === 0) {
                this.rooms.delete(conversationId)
            }
        }
    }

    broadcastToAll(conversationId: string, message: string): void {
        const room = this.rooms.get(conversationId)
        if (!room) return

        room.forEach((client) => {
            if (client.ws.readyState === 1) {
                client.ws.send(message)
            }
        })
    }
}

export const dmManager = new DmManager()
