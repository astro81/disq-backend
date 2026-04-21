import { ClientMeta } from './websocket.types'

/**
 * Manages WebSocket channels (rooms), handling client membership
 * and message broadcasting across connected clients.
 */
class ChannelManager {
    /** Internal map of channel IDs to their connected clients. */
    private channels = new Map<string, Set<ClientMeta>>()

    /**
     * Adds a client to the specified channel, creating the channel if it doesn't exist.
     * @param channelId - The unique identifier of the channel.
     * @param client - The client metadata object to add.
     */
    addClient(channelId: string, client: ClientMeta): void {
        if (!this.channels.has(channelId)) {
            this.channels.set(channelId, new Set())
        }
        this.channels.get(channelId)!.add(client)
    }

    /**
     * Removes a client from the specified channel.
     * Automatically deletes the channel if it becomes empty after removal.
     * @param channelId - The unique identifier of the channel.
     * @param client - The client metadata object to remove.
     */
    removeClient(channelId: string, client: ClientMeta): void {
        const room = this.channels.get(channelId)
        if (room) {
            room.delete(client)
            // Clean up the channel entirely when no clients remain
            if (room.size === 0) {
                this.channels.delete(channelId)
            }
        }
    }

    /**
     * Retrieves the set of clients currently in a channel.
     * @param channelId - The unique identifier of the channel.
     * @returns The set of clients in the channel, or `undefined` if the channel doesn't exist.
     */
    getRoom(channelId: string): Set<ClientMeta> | undefined {
        return this.channels.get(channelId)
    }

    /**
     * Broadcasts a message to all clients in a channel, with the option to exclude a specific client.
     * Only sends to clients whose WebSocket connection is in the OPEN state (readyState === 1).
     * @param channelId - The unique identifier of the channel.
     * @param message - The message string to broadcast.
     * @param excludeClient - Optional client to skip when broadcasting (e.g. the message sender).
     */
    broadcast(channelId: string, message: string, excludeClient?: ClientMeta): void {
        const room = this.channels.get(channelId)
        if (!room) return

        room.forEach((client) => {
            // Skip the excluded client and any clients with non-open connections
            if (client !== excludeClient && client.ws.readyState === 1) {
                client.ws.send(message)
            }
        })
    }

    /**
     * Broadcasts a message to every client in a channel without any exclusions.
     * Only sends to clients whose WebSocket connection is in the OPEN state (readyState === 1).
     * @param channelId - The unique identifier of the channel.
     * @param message - The message string to broadcast.
     */
    broadcastToAll(channelId: string, message: string): void {
        const room = this.channels.get(channelId)
        if (!room) return

        room.forEach((client) => {
            if (client.ws.readyState === 1) {
                client.ws.send(message)
            }
        })
    }
}

export const channelManager = new ChannelManager()