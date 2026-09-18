import { WorkerEntrypoint } from 'cloudflare:workers'
import { Hono } from 'hono'
import { createAgentRouter } from '@flue/runtime/routing'
import { Assistant } from './agents/assistant'

// Only the authenticated API Worker invokes this private service entrypoint.
const conversations = new Hono().route('/api/chat', createAgentRouter(Assistant))
export class AgentsService extends WorkerEntrypoint {
  async conversation(request: Request): Promise<Response> {
    return conversations.fetch(request, this.env, this.ctx)
  }
}
