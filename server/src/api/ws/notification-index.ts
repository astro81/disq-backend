// ws/notification-index.ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { notificationManager } from './helpers/notification-manager'

const notificationWs = new Hono()

notificationWs.get('/ws/notifications/:userId', upgradeWebSocket((c) => {
    const userId = c.req.param('userId')
    if (!userId) return {}

    return {
        onOpen(_, wsClient) {
            notificationManager.addClient(userId, wsClient.raw as any)
            console.log(`[Notification-WS] User ${userId} connected for background notifications`)
        },

        onClose(_, wsClient) {
            notificationManager.removeClient(userId, wsClient.raw as any)
            console.log(`[Notification-WS] User ${userId} disconnected`)
        },

        onError(error) {
            console.error(`[Notification-WS] Error for user ${userId}:`, error)
        },
    }
}))

export default notificationWs
