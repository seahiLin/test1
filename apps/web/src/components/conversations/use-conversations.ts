import { useEffect, useState } from 'react'

import { createConversation, listConversations, type Conversation } from './api'

export function useConversations(userId: string) {
  const storageKey = `weave:conversation:${userId}`
  const [items, setItems] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [initial, setInitial] = useState<{ id: string; prompt: string } | null>(
    null,
  )
  useEffect(() => {
    const controller = new AbortController()
    listConversations(controller.signal)
      .then((conversations) => {
        if (controller.signal.aborted) return
        setItems(conversations)
        setSelected((id) =>
          id && conversations.some((item) => item.id === id) ? id : null,
        )
        setError('')
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('无法加载对话，请重试。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reload])
  useEffect(() => {
    try {
      if (selected) localStorage.setItem(storageKey, selected)
      else localStorage.removeItem(storageKey)
    } catch {
      /* Storage is optional. */
    }
  }, [selected, storageKey])
  async function create(prompt: string) {
    const item = await createConversation()
    setReload((value) => value + 1)
    setItems((current) => [item, ...current])
    try {
      sessionStorage.setItem(`weave:draft:${userId}:${item.id}`, prompt)
      sessionStorage.removeItem(`weave:draft:${userId}:new`)
    } catch {
      /* Keep the in-memory draft when storage is unavailable. */
    }
    setInitial({ id: item.id, prompt })
    setSelected(item.id)
  }
  return {
    items,
    selected,
    setSelected,
    loading,
    error,
    initial,
    setInitial,
    create,
    refresh: () => setReload((value) => value + 1),
  }
}
