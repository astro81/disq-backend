import {
    boolean,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '@/db/user';
import { messageFileTable } from '@/db/chat';

// Enums
export const friendshipStatusEnum = pgEnum('FriendshipStatus', [
    'PENDING',
    'ACCEPTED',
    'REJECTED'
]);

// Friendship table
export const friendshipTable = pgTable(
    'friendship',
    {
        friendshipId: uuid('friendship_id').defaultRandom().primaryKey(),

        requesterId: uuid('requester_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

        addresseeId: uuid('addressee_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

        status: friendshipStatusEnum('status').default('PENDING').notNull(),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull()
    },
    (table) => [
        index('friendship_requester_idx').on(table.requesterId),
        index('friendship_addressee_idx').on(table.addresseeId),
        index('friendship_status_idx').on(table.status),
        // A user can only send one request to another user
        uniqueIndex('friendship_unique_pair').on(table.requesterId, table.addresseeId)
    ]
);

// DM Conversation table
export const dmConversationTable = pgTable(
    'dm_conversation',
    {
        dmConversationId: uuid('dm_conversation_id').defaultRandom().primaryKey(),

        userOneId: uuid('user_one_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

        userTwoId: uuid('user_two_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => [
        index('dm_conv_user_one_idx').on(table.userOneId),
        index('dm_conv_user_two_idx').on(table.userTwoId),
        uniqueIndex('dm_conv_unique_pair').on(table.userOneId, table.userTwoId)
    ]
);

// DM Message table
export const dmMessageTable = pgTable(
    'dm_message',
    {
        dmMessageId: uuid('dm_message_id').defaultRandom().primaryKey(),

        content: text('content').notNull(),

        userId: uuid('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

        dmConversationId: uuid('dm_conversation_id')
            .notNull()
            .references(() => dmConversationTable.dmConversationId, {
                onDelete: 'cascade',
                onUpdate: 'cascade'
            }),

        dmFileId: uuid('dm_file_id').references(() => messageFileTable.messageFileId, {
            onDelete: 'cascade',
            onUpdate: 'cascade'
        }),

        deleted: boolean('deleted').default(false).notNull(),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull()
    },
    (table) => [
        index('dm_msg_user_idx').on(table.userId),
        index('dm_msg_conversation_idx').on(table.dmConversationId),
        index('dm_msg_conv_msg_idx').on(table.dmConversationId, table.dmMessageId),
        index('dm_msg_file_idx').on(table.dmFileId)
    ]
);

// Relations

export const friendshipRelations = relations(friendshipTable, ({ one }) => ({
    requester: one(user, {
        fields: [friendshipTable.requesterId],
        references: [user.id],
        relationName: 'friendship_requester'
    }),
    addressee: one(user, {
        fields: [friendshipTable.addresseeId],
        references: [user.id],
        relationName: 'friendship_addressee'
    })
}));

export const dmConversationRelations = relations(dmConversationTable, ({ one, many }) => ({
    userOne: one(user, {
        fields: [dmConversationTable.userOneId],
        references: [user.id],
        relationName: 'dm_user_one'
    }),
    userTwo: one(user, {
        fields: [dmConversationTable.userTwoId],
        references: [user.id],
        relationName: 'dm_user_two'
    }),
    messages: many(dmMessageTable)
}));

export const dmMessageRelations = relations(dmMessageTable, ({ one }) => ({
    author: one(user, {
        fields: [dmMessageTable.userId],
        references: [user.id]
    }),
    conversation: one(dmConversationTable, {
        fields: [dmMessageTable.dmConversationId],
        references: [dmConversationTable.dmConversationId]
    }),
    file: one(messageFileTable, {
        fields: [dmMessageTable.dmFileId],
        references: [messageFileTable.messageFileId]
    })
}));

// Types
export type Friendship = typeof friendshipTable.$inferSelect;
export type DmConversation = typeof dmConversationTable.$inferSelect;
export type DmMessage = typeof dmMessageTable.$inferSelect;
