// ws/dm-index.ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { dmManager } from './helpers/dm-manager'
import { dmPersister } from './helpers/dm-persister'
import { ClientMeta } from './helpers/websocket.types'

const dmWs = new Hono()

dmWs.get('/ws/dm/:conversationId', upgradeWebSocket((c) => {
    const conversationId = c.req.param('conversationId')
    if (!conversationId) return {}

    // Parse user info from query params (same pattern as channel WS)
    const userId = c.req.query('userId') ?? 'unknown'
    const username = c.req.query('username') ?? 'unknown'
    const displayName = c.req.query('displayName') ?? 'Unknown'
    const userProfileImage = c.req.query('userProfileImage') ?? null
    const userBannerImage = c.req.query('userBannerImage') ?? null

    let clientMeta: ClientMeta | null = null

    return {
        onOpen(_, wsClient) {
            clientMeta = {
                ws: wsClient.raw,
                memberId: userId, // In DM context, use userId as the identifier
                userId,
                username,
                displayName,
                userProfileImage,
                userBannerImage,
                role: null,
            }

            dmManager.addClient(conversationId, clientMeta)
            console.log(`[DM-WS] ${displayName} joined DM conversation: ${conversationId}`)
        },

        async onMessage(event) {
            if (!clientMeta) return

            const raw = event.data as string

            let payload: {
                text: string
                fileUrl?: string
                fileName?: string
                filePublicId?: string
                fileSize?: number
                fileType?: string
            }

            try {
                const parsed = JSON.parse(raw)
                payload = parsed && typeof parsed === 'object' && 'text' in parsed
                    ? parsed
                    : { text: raw }
            } catch {
                payload = { text: raw }
            }

            const { dmMessageId } = await dmPersister.saveMessage(
                conversationId,
                clientMeta.userId,
                payload
            )

            const outgoing = {
                dmMessageId,
                conversationId,
                userId: clientMeta.userId,
                message: payload.text,
                timestamp: Date.now(),
                username: clientMeta.username,
                displayName: clientMeta.displayName,
                userProfileImage: clientMeta.userProfileImage,
                userBannerImage: clientMeta.userBannerImage,

                // File metadata
                messageFileUrl: payload.fileUrl,
                messageFileName: payload.fileName,
                messageFileSize: payload.fileSize,
                messageFileType: payload.fileType,
            }

            const serialized = JSON.stringify(outgoing)
            dmManager.broadcastToAll(conversationId, serialized)
        },

        onClose() {
            if (clientMeta) {
                dmManager.removeClient(conversationId, clientMeta)
                console.log(`[DM-WS] ${clientMeta.displayName} left DM conversation: ${conversationId}`)
            }
        },

        onError(error) {
            console.error(`[DM-WS] Error in DM conversation ${conversationId}:`, error)
        },
    }
}))

export default dmWs
