import { createMiddleware } from 'hono/factory'
import { createAuth } from '../auth'
import type { AppEnv } from '../env'

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  })
  if (!session) return c.json({ error: '请先登录' }, 401)
  c.set('user', session.user)
  await next()
})
