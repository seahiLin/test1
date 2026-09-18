import { Hono } from 'hono'
import { chatInputSchema } from '@weave/agents/contracts'
import { conversationRepository } from '../db/conversations'
import { requireSession } from '../middleware/session'
import type { AppEnv } from '../env'

export const chatRoutes = new Hono<AppEnv>()
chatRoutes.use('*', requireSession)

chatRoutes.all('/:id', async (c) => {
  const user = c.get('user')
  const conversations = conversationRepository(c.env.DB, user.id)
  const id = c.req.param('id')
  const owned = await conversations.find(id)
  if (!owned) return c.json({ error: '会话不存在或无权访问' }, 404)
  if (!['GET', 'HEAD', 'POST'].includes(c.req.method))
    return c.json({ error: '不支持此操作' }, 405)
  let title: string | undefined
  let request = c.req.raw
  if (c.req.method === 'POST') {
    if (c.req.header('Origin') !== c.env.FRONTEND_URL)
      return c.json({ error: '请求来源不正确' }, 403)
    const input = chatInputSchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success) return c.json({ error: '消息格式不正确' }, 400)
    title = input.data.body.replace(/\s+/g, ' ').slice(0, 48)
    request = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.data),
    })
  } else {
    // Forward stream negotiation without passing login cookies into agents.
    const headers = new Headers()
    for (const name of ['accept', 'if-none-match', 'last-event-id']) {
      const value = c.req.header(name)
      if (value) headers.set(name, value)
    }
    request = new Request(request.url, { method: c.req.method, headers })
  }
  try {
    const response = await c.env.AGENTS.conversation(request)
    // Read the small admission receipt before another cross-service await.
    // History/SSE bodies stay streaming.
    const body =
      response.status === 202 ? await response.arrayBuffer() : response.body
    if (response.status === 202 && title) {
      // Admission is already durable. A directory failure must not turn it into
      // a failed send and cause the browser to resubmit the same message.
      await conversations.recordAdmission(id, title).catch(() => {
        console.error('Conversation directory update failed')
      })
    }
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'private, no-store')
    return new Response(body, { status: response.status, headers })
  } catch {
    return c.json({ error: '模型服务暂时不可用，请稍后重试' }, 502)
  }
})
