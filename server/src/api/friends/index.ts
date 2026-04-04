import { Hono } from 'hono'
import { eq, and, or, desc, ilike, ne } from 'drizzle-orm'
import { db } from '@/db'
import { friendshipTable } from '@/db/friendship'
import { user } from '@/db/user'

const app = new Hono()

// GET /api/friends — list accepted friends
app.get('/', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const friendships = await db
        .select({
            friendshipId: friendshipTable.friendshipId,
            friendUserId: user.id,
            friendUsername: user.name,
            friendDisplayName: user.displayName,
            friendImage: user.image,
            friendBannerImage: user.profileBannerImage,
            createdAt: friendshipTable.createdAt,
        })
        .from(friendshipTable)
        .innerJoin(
            user,
            or(
                and(
                    eq(friendshipTable.requesterId, userId),
                    eq(user.id, friendshipTable.addresseeId)
                ),
                and(
                    eq(friendshipTable.addresseeId, userId),
                    eq(user.id, friendshipTable.requesterId)
                )
            )
        )
        .where(
            and(
                eq(friendshipTable.status, 'ACCEPTED'),
                or(
                    eq(friendshipTable.requesterId, userId),
                    eq(friendshipTable.addresseeId, userId)
                )
            )
        )
        .orderBy(desc(friendshipTable.createdAt))

    return c.json({ friends: friendships })
})

// GET /api/friends/search?q=... — search users by name
app.get('/search', async (c) => {
    const userId = c.req.header('x-user-id')
    const query = c.req.query('q')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)
    if (!query) return c.json({ users: [] })

    const users = await db
        .select({
            id: user.id,
            name: user.name,
            displayName: user.displayName,
            image: user.image,
        })
        .from(user)
        .where(
            and(
                ne(user.id, userId),
                or(
                    ilike(user.name, `%${query}%`),
                    ilike(user.displayName, `%${query}%`)
                )
            )
        )
        .limit(10)

    return c.json({ users })
})


// GET /api/friends/pending — list pending incoming requests
app.get('/pending', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const pending = await db
        .select({
            friendshipId: friendshipTable.friendshipId,
            requesterUserId: user.id,
            requesterUsername: user.name,
            requesterDisplayName: user.displayName,
            requesterImage: user.image,
            createdAt: friendshipTable.createdAt,
        })
        .from(friendshipTable)
        .innerJoin(user, eq(user.id, friendshipTable.requesterId))
        .where(
            and(
                eq(friendshipTable.addresseeId, userId),
                eq(friendshipTable.status, 'PENDING')
            )
        )
        .orderBy(desc(friendshipTable.createdAt))

    return c.json({ pending })
})

// GET /api/friends/status/:targetUserId — check friendship status with a user
app.get('/status/:targetUserId', async (c) => {
    const userId = c.req.header('x-user-id')
    const targetUserId = c.req.param('targetUserId')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    if (userId === targetUserId) {
        return c.json({ status: 'SELF' })
    }

    const friendship = await db.query.friendshipTable.findFirst({
        where: or(
            and(
                eq(friendshipTable.requesterId, userId),
                eq(friendshipTable.addresseeId, targetUserId)
            ),
            and(
                eq(friendshipTable.requesterId, targetUserId),
                eq(friendshipTable.addresseeId, userId)
            )
        )
    })

    if (!friendship) return c.json({ status: 'NONE', friendshipId: null })

    return c.json({
        status: friendship.status,
        friendshipId: friendship.friendshipId,
        isRequester: friendship.requesterId === userId
    })
})

// POST /api/friends/request — send friend request
app.post('/request', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const { addresseeId } = await c.req.json<{ addresseeId: string }>()
    if (!addresseeId) return c.json({ error: 'addresseeId is required' }, 400)
    if (userId === addresseeId) return c.json({ error: 'Cannot friend yourself' }, 400)

    // Check if a relationship already exists (in either direction)
    const existing = await db.query.friendshipTable.findFirst({
        where: or(
            and(
                eq(friendshipTable.requesterId, userId),
                eq(friendshipTable.addresseeId, addresseeId)
            ),
            and(
                eq(friendshipTable.requesterId, addresseeId),
                eq(friendshipTable.addresseeId, userId)
            )
        )
    })

    if (existing) {
        if (existing.status === 'ACCEPTED')
            return c.json({ error: 'Already friends' }, 409)
        if (existing.status === 'PENDING')
            return c.json({ error: 'Friend request already pending' }, 409)
        if (existing.status === 'REJECTED') {
            // Allow re-request by updating existing row
            const [updated] = await db
                .update(friendshipTable)
                .set({ status: 'PENDING', requesterId: userId, addresseeId })
                .where(eq(friendshipTable.friendshipId, existing.friendshipId))
                .returning()
            return c.json({ friendship: updated })
        }
    }

    const [friendship] = await db
        .insert(friendshipTable)
        .values({ requesterId: userId, addresseeId })
        .returning()

    return c.json({ friendship }, 201)
})

// POST /api/friends/accept — accept a pending request
app.post('/accept', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const { friendshipId } = await c.req.json<{ friendshipId: string }>()
    if (!friendshipId) return c.json({ error: 'friendshipId is required' }, 400)

    const friendship = await db.query.friendshipTable.findFirst({
        where: eq(friendshipTable.friendshipId, friendshipId)
    })

    if (!friendship) return c.json({ error: 'Friendship not found' }, 404)
    if (friendship.addresseeId !== userId) return c.json({ error: 'Only the addressee can accept' }, 403)
    if (friendship.status !== 'PENDING') return c.json({ error: 'Request is not pending' }, 400)

    const [updated] = await db
        .update(friendshipTable)
        .set({ status: 'ACCEPTED' })
        .where(eq(friendshipTable.friendshipId, friendshipId))
        .returning()

    return c.json({ friendship: updated })
})

// POST /api/friends/reject — reject a pending request
app.post('/reject', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const { friendshipId } = await c.req.json<{ friendshipId: string }>()
    if (!friendshipId) return c.json({ error: 'friendshipId is required' }, 400)

    const friendship = await db.query.friendshipTable.findFirst({
        where: eq(friendshipTable.friendshipId, friendshipId)
    })

    if (!friendship) return c.json({ error: 'Friendship not found' }, 404)
    if (friendship.addresseeId !== userId) return c.json({ error: 'Only the addressee can reject' }, 403)
    if (friendship.status !== 'PENDING') return c.json({ error: 'Request is not pending' }, 400)

    const [updated] = await db
        .update(friendshipTable)
        .set({ status: 'REJECTED' })
        .where(eq(friendshipTable.friendshipId, friendshipId))
        .returning()

    return c.json({ friendship: updated })
})

// DELETE /api/friends/:friendshipId — remove a friendship
app.delete('/:friendshipId', async (c) => {
    const userId = c.req.header('x-user-id')
    if (!userId) return c.json({ error: 'x-user-id header is required' }, 400)

    const friendshipId = c.req.param('friendshipId')

    const friendship = await db.query.friendshipTable.findFirst({
        where: eq(friendshipTable.friendshipId, friendshipId)
    })

    if (!friendship) return c.json({ error: 'Friendship not found' }, 404)

    // Only participants can delete
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
        return c.json({ error: 'Forbidden' }, 403)
    }

    await db
        .delete(friendshipTable)
        .where(eq(friendshipTable.friendshipId, friendshipId))

    return c.json({ success: true })
})

export default app
