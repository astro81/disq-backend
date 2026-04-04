// ws/helpers/dm-persister.ts
import { db } from '@/db'
import { dmMessageTable } from '@/db/friendship'
import { messageFileTable } from '@/db/chat'
import { IncomingPayload } from './websocket.types'

export class DmPersister {
    async saveMessage(
        dmConversationId: string,
        userId: string,
        payload: IncomingPayload
    ): Promise<{ dmMessageId: string | null; dmFileId: string | null }> {
        let dmFileId: string | null = null

        try {
            // Save file if present
            if (this.hasFileAttachment(payload)) {
                dmFileId = await this.saveFile(payload)
            }

            // Save message
            const [saved] = await db
                .insert(dmMessageTable)
                .values({
                    dmConversationId,
                    userId,
                    content: payload.text,
                    ...(dmFileId ? { dmFileId } : {}),
                })
                .returning({ dmMessageId: dmMessageTable.dmMessageId })

            return { dmMessageId: saved.dmMessageId, dmFileId }
        } catch (error) {
            console.error('[DM-WS] Failed to persist DM message:', error)
            return { dmMessageId: null, dmFileId: null }
        }
    }

    private hasFileAttachment(payload: IncomingPayload): boolean {
        return !!(payload.fileUrl && payload.fileName && payload.filePublicId)
    }

    private async saveFile(payload: IncomingPayload): Promise<string | null> {
        const [savedFile] = await db
            .insert(messageFileTable)
            .values({
                messageFileUrl: payload.fileUrl!,
                messageFileName: payload.fileName!,
                messageFilePublicId: payload.filePublicId!,
                messageFileSize: payload.fileSize ?? null,
                messageFileType: payload.fileType ?? null,
            })
            .returning({ messageFileId: messageFileTable.messageFileId })

        return savedFile.messageFileId
    }
}

export const dmPersister = new DmPersister()
