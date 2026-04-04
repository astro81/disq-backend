// ws/helpers/dm-persister.ts
import { db } from '@/db'
import { dmMessageTable } from '@/db/friendship'
import { IncomingPayload } from './websocket.types'

export class DmPersister {
    async saveMessage(
        dmConversationId: string,
        userId: string,
        payload: IncomingPayload
    ): Promise<{ dmMessageId: string | null }> {
        try {
            const [saved] = await db
                .insert(dmMessageTable)
                .values({
                    dmConversationId,
                    userId,
                    content: payload.text,
                })
                .returning({ dmMessageId: dmMessageTable.dmMessageId })

            return { dmMessageId: saved.dmMessageId }
        } catch (error) {
            console.error('[DM-WS] Failed to persist DM message:', error)
            return { dmMessageId: null }
        }
    }
}

export const dmPersister = new DmPersister()
