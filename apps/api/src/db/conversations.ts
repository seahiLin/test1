import { and, desc, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { conversation } from './schema'

const DEFAULT_TITLE = '新对话'

// Every operation is scoped to its authenticated owner.
export function conversationRepository(binding: D1Database, userId: string) {
  const db = drizzle(binding)
  const owned = (id: string) =>
    and(eq(conversation.id, id), eq(conversation.userId, userId))

  return {
    list() {
      return db
        .select({
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        })
        .from(conversation)
        .where(eq(conversation.userId, userId))
        .orderBy(desc(conversation.updatedAt), desc(conversation.id))
    },
    async create() {
      const now = Date.now()
      const item = {
        id: crypto.randomUUID(),
        title: DEFAULT_TITLE,
        createdAt: now,
        updatedAt: now,
      }
      await db.insert(conversation).values({ ...item, userId })
      return item
    },
    find(id: string) {
      return db
        .select({ id: conversation.id })
        .from(conversation)
        .where(owned(id))
        .get()
    },
    recordAdmission(id: string, title: string) {
      return db
        .update(conversation)
        .set({
          title: sql`CASE WHEN ${conversation.title} = ${DEFAULT_TITLE} THEN ${title} ELSE ${conversation.title} END`,
          updatedAt: Date.now(),
        })
        .where(owned(id))
        .run()
    },
  }
}
