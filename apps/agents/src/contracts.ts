import { z } from 'zod'

// Only a new user turn crosses the API boundary; Flue owns durable context.
export const chatInputSchema = z.object({
  kind: z.literal('user'),
  body: z.string().trim().min(1).max(16000),
}).strict()
