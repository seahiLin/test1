import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { createAuth } from './auth'
import { chatRoutes } from './routes/chat'
import { conversationRoutes } from './routes/conversations'
import type { AppEnv } from './env'

const app = new Hono<AppEnv>()
app.use('/api/*', (c, next) =>
  cors({ origin: c.env.FRONTEND_URL, credentials: true })(c, next),
)
app.use('/api/*', bodyLimit({ maxSize: 128 * 1024 }))
app.get('/api/health', (c) => c.json({ ok: true }))
app.all('/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))
app.route('/api/conversations', conversationRoutes)
app.route('/api/chat', chatRoutes)
app.onError((_error, c) => c.json({ error: '服务器内部错误' }, 500))

export default app
