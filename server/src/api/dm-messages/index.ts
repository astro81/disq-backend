import { Hono } from 'hono'
import { eq, desc, and, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { dmConversationTable, dmMessageTable } from '@/db/friendship'
import { user } from '@/db/user'
import { messageFileTable } from '@/db/chat'
import { dmManager } from '@/api/ws/helpers/dm-manager'
import { messageBuilder } from '@/api/ws/helpers/message-builder'

const app = new Hono()

const DM_MESSAGE_BATCH = 30

// POST /api/dm-messages/conversation — get or create a DM conversation
app.post('/conversation', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const { otherUserId } = await c.req.json<{ otherUserId: string }>()
    if (!otherUserId) return c.json({ error: 'otherUserId is required' }, 400)

    // Normalize ordering so the same pair always maps to one row
    const [userOneId, userTwoId] =
        userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId]

    // Try to find existing conversation
    const existing = await db.query.dmConversationTable.findFirst({
        where: and(
            eq(dmConversationTable.userOneId, userOneId),
            eq(dmConversationTable.userTwoId, userTwoId)
        )
    })

    if (existing) return c.json({ conversation: existing })

    // Create new conversation
    const [conversation] = await db
        .insert(dmConversationTable)
        .values({ userOneId, userTwoId })
        .returning()

    return c.json({ conversation }, 201)
})

// GET /api/dm-messages/:conversationId?cursor=<dmMessageId>
app.get('/:conversationId', async (c) => {
    const conversationId = c.req.param('conversationId')
    const cursor = c.req.query('cursor')
    const userId = c.req.header('x-user-id')

    if (!conversationId) return c.json({ error: 'conversationId is required' }, 400)
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    // Verify user is part of this conversation
    const conversation = await db.query.dmConversationTable.findFirst({
        where: eq(dmConversationTable.dmConversationId, conversationId)
    })

    if (!conversation) return c.json({ error: 'Conversation not found' }, 404)
    if (conversation.userOneId !== userId && conversation.userTwoId !== userId) {
        return c.json({ error: 'Forbidden' }, 403)
    }

    const conditions = [
        eq(dmMessageTable.dmConversationId, conversationId),
        eq(dmMessageTable.deleted, false),
        ...(cursor ? [lt(dmMessageTable.dmMessageId, cursor)] : []),
    ]

    const messages = await db
        .select({
            dmMessageId: dmMessageTable.dmMessageId,
            content: dmMessageTable.content,
            createdAt: dmMessageTable.createdAt,
            updatedAt: dmMessageTable.updatedAt,
            userId: user.id,
            username: user.name,
            displayName: user.displayName,
            userProfileImage: user.image,
            userBannerImage: user.profileBannerImage,

            // File metadata
            messageFileUrl: messageFileTable.messageFileUrl,
            messageFileName: messageFileTable.messageFileName,
            messageFileSize: messageFileTable.messageFileSize,
            messageFileType: messageFileTable.messageFileType,
        })
        .from(dmMessageTable)
        .innerJoin(user, eq(dmMessageTable.userId, user.id))
        .leftJoin(messageFileTable, eq(dmMessageTable.dmFileId, messageFileTable.messageFileId))
        .where(and(...conditions))
        .orderBy(desc(dmMessageTable.createdAt))
        .limit(DM_MESSAGE_BATCH)

    const ordered = messages.reverse()
    const nextCursor = messages.length === DM_MESSAGE_BATCH ? messages[0].dmMessageId : null

    return c.json({ messages: ordered, nextCursor })
})

// DELETE /api/dm-messages/:conversationId/:messageId
// Soft-delete a DM message (sets deleted = true)
app.delete('/:conversationId/:messageId', async (c) => {
    const conversationId = c.req.param('conversationId')
    const messageId = c.req.param('messageId')
    const userId = c.req.header('x-user-id')

    if (!conversationId || !messageId) return c.json({ error: 'conversationId and messageId are required' }, 400)
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    // Verify conversation exists & user is part of it
    const conversation = await db.query.dmConversationTable.findFirst({
        where: eq(dmConversationTable.dmConversationId, conversationId)
    })
    if (!conversation) return c.json({ error: 'Conversation not found' }, 404)
    if (conversation.userOneId !== userId && conversation.userTwoId !== userId) {
        return c.json({ error: 'Forbidden' }, 403)
    }

    // Verify message exists and belongs to the requesting user
    const message = await db.query.dmMessageTable.findFirst({
        where: and(
            eq(dmMessageTable.dmMessageId, messageId),
            eq(dmMessageTable.dmConversationId, conversationId),
        ),
    })
    if (!message) return c.json({ error: 'Message not found' }, 404)
    if (message.userId !== userId) {
        return c.json({ error: 'You can only delete your own messages' }, 403)
    }

    // Soft delete
    await db.update(dmMessageTable)
        .set({ deleted: true })
        .where(eq(dmMessageTable.dmMessageId, messageId))

    // Broadcast deletion
    // For DMs, conversationId is passed as channelId to buildDeletionMessage
    const deletionMsg = messageBuilder.buildDeletionMessage(conversationId, messageId)
    dmManager.broadcastToAll(conversationId, messageBuilder.serializeMessage(deletionMsg))

    return c.json({ success: true })
})

export default app
