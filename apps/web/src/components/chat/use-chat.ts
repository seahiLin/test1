import { useFlueAgent } from '@flue/react'
import { useEffect, useRef, useState } from 'react'

export type ChatProps = {
  conversationId: string | null
  userId: string
  initialPrompt?: string
  onCreate: (prompt: string) => Promise<void>
  onInitialConsumed: () => void
  onSent: () => void
}

export function useChat({
  conversationId,
  userId,
  initialPrompt,
  onCreate,
  onInitialConsumed,
  onSent,
}: ChatProps) {
  const agent = useFlueAgent({
    url: conversationId
      ? `/api/chat/${encodeURIComponent(conversationId)}`
      : undefined,
  })
  const storageKey = `weave:draft:${userId}:${conversationId ?? 'new'}`
  const [prompt, setPrompt] = useState(() => {
    try {
      return initialPrompt ?? sessionStorage.getItem(storageKey) ?? ''
    } catch {
      return initialPrompt ?? ''
    }
  })
  const [sendError, setSendError] = useState('')
  const [creating, setCreating] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const sending = useRef(false)
  const initialSent = useRef(false)
  const busy = agent.status === 'submitted' || agent.status === 'streaming'
  const ready = !conversationId || agent.historyReady
  const empty = agent.messages.length === 0
  const modelError = /402|insufficient credits/i.test(
    agent.error?.message ?? '',
  )
    ? '模型服务额度不足，暂时无法回复。你的消息已保留。'
    : '连接暂时中断，已收到的内容会保留。可以重新连接以恢复回复。'

  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(storageKey, prompt)
      else sessionStorage.removeItem(storageKey)
    } catch {
      /* Storage may be unavailable. */
    }
    const input = textarea.current
    if (input) {
      input.style.height = '0px'
      input.style.height = `${Math.min(input.scrollHeight, 192)}px`
    }
  }, [prompt, storageKey])

  async function submit(text: string) {
    if (!text.trim() || busy || !ready || sending.current) return
    sending.current = true
    setSendError('')
    try {
      if (!conversationId) {
        setCreating(true)
        await onCreate(text.trim())
      } else {
        await agent.sendMessage(text.trim())
        setPrompt((current) => (current.trim() === text.trim() ? '' : current))
        onSent()
      }
    } catch {
      setSendError('消息未发送成功。草稿已保留，请重试。')
    } finally {
      sending.current = false
      setCreating(false)
    }
  }
  useEffect(() => {
    if (initialPrompt && agent.historyReady && !initialSent.current) {
      initialSent.current = true
      onInitialConsumed()
      void submit(initialPrompt)
    }
  }, [initialPrompt, agent.historyReady])

  return {
    agent,
    prompt,
    setPrompt,
    sendError,
    setSendError,
    creating,
    textarea,
    busy,
    ready,
    empty,
    modelError,
    submit,
  }
}
