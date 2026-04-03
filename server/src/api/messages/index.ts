import { Hono } from 'hono'
import { eq, desc, and, lt } from 'drizzle-orm'
import { db } from '@/db'
import { messageFileTable, messageTable } from '@/db/chat'
import { channelTable, memberTable, user } from '@/db/schema'

const app = new Hono()

const MESSAGE_BATCH = 30

// GET /api/messages/:channelId?cursor=<messageId>
// Expects header: x-user-id: <userId>
app.get('/:channelId', async (c) => {
    const channelId = c.req.param('channelId')
    const cursor = c.req.query('cursor')
    const userId = c.req.header('x-user-id')

    if (!channelId) return c.json({ error: 'channelId is required' }, 400)
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const channel = await db.query.channelTable.findFirst({
        where: eq(channelTable.channelId, channelId),
    })

    if (!channel) return c.json({ error: 'Channel not found' }, 404)

    const membership = await db.query.memberTable.findFirst({
        where: and(
            eq(memberTable.serverId, channel.serverId),
            eq(memberTable.userId, userId),
        ),
    })

    if (!membership) return c.json({ error: 'Forbidden' }, 403)

    const conditions = [
        eq(messageTable.channelId, channelId),
        eq(messageTable.messageDeleted, false),
        ...(cursor ? [lt(messageTable.messageId, cursor)] : []),
    ]

    const messages = await db
        .select({
            messageId: messageTable.messageId,
            messageContent: messageTable.messageContent,
            createdAt: messageTable.createdAt,
            updatedAt: messageTable.updatedAt,
            memberId: messageTable.memberId,
            userId: user.id,
            displayName: user.displayName,
            username: user.name,
            userProfileImage: user.image,
            userBannerImage: user.profileBannerImage,
            role: memberTable.role,
            messageFileUrl: messageFileTable.messageFileUrl,
            messageFileName: messageFileTable.messageFileName,
            messageFileType: messageFileTable.messageFileType,
            messageFileSize: messageFileTable.messageFileSize,
        })
        .from(messageTable)
        .innerJoin(memberTable, eq(messageTable.memberId, memberTable.memberId))
        .innerJoin(user, eq(memberTable.userId, user.id))
        .leftJoin(messageFileTable, eq(messageTable.messageFileId, messageFileTable.messageFileId))
        .where(and(...conditions))
        .orderBy(desc(messageTable.createdAt))
        .limit(MESSAGE_BATCH)

    const ordered = messages.reverse()
    const nextCursor = messages.length === MESSAGE_BATCH ? messages[0].messageId : null

    return c.json({ messages: ordered, nextCursor })
})

export default app