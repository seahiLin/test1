export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export async function listConversations(
  signal: AbortSignal,
): Promise<Conversation[]> {
  const response = await fetch('/api/conversations', { signal })
  if (!response.ok) throw new Error('无法加载会话列表')
  const data = (await response.json()) as { conversations: Conversation[] }
  return data.conversations
}

export async function createConversation(): Promise<Conversation> {
  const response = await fetch('/api/conversations', { method: 'POST' })
  if (!response.ok) throw new Error('创建失败')
  return response.json() as Promise<Conversation>
}
