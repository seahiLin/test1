import type { AgentsService } from '@weave/agents'
export interface Env {
  DB: D1Database
  AGENTS: Service<AgentsService>
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  FRONTEND_URL: string
}

export type AppEnv = {
  Bindings: Env
  Variables: { user: { id: string } }
}
