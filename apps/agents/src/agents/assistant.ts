'use agent'

import { env } from 'cloudflare:workers'
import { useModel, setProvider } from '@flue/runtime'
import { createProvider } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'

const bindings = env as unknown as { OPENROUTER_API_KEY: string; OPENROUTER_MODEL: string }
// Register the configured OpenRouter model explicitly; newly released models
// may not yet be in the bundled catalog. Metadata below is for DeepSeek V4 Flash 0731 (free).
setProvider(createProvider({
  id: 'weave-openrouter',
  auth: { apiKey: {
    name: 'OpenRouter',
    resolve: async () => ({ auth: { apiKey: bindings.OPENROUTER_API_KEY } }),
  } },
  models: [{
    id: bindings.OPENROUTER_MODEL,
    name: bindings.OPENROUTER_MODEL,
    api: 'openai-completions',
    provider: 'weave-openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    reasoning: true,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1048576,
    maxTokens: 16384,
  }],
  api: openAICompletionsApi(),
}))

export function Assistant() {
  useModel(`weave-openrouter/${bindings.OPENROUTER_MODEL}`)
  return 'You are Weave, a helpful assistant. Respond in the language used by the user.'
}
