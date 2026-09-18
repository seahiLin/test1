import { Hono } from 'hono'
import { conversationRepository } from '../db/conversations'
import { requireSession } from '../middleware/session'
import type { AppEnv } from '../env'

export const conversationRoutes = new Hono<AppEnv>()
conversationRoutes.use('*', requireSession)

// Application directory: Flue deliberately does not enumerate conversations.
conversationRoutes.get('/', async (c) => {
  const user = c.get('user')
  const results = await conversationRepository(c.env.DB, user.id).list()
  c.header('Cache-Control', 'private, no-store')
  return c.json({ conversations: results })
})
conversationRoutes.post('/', async (c) => {
  const user = c.get('user')
  if (c.req.header('Origin') !== c.env.FRONTEND_URL)
    return c.json({ error: '请求来源不正确' }, 403)
  const item = await conversationRepository(c.env.DB, user.id).create()
  return c.json(item, 201)
})
