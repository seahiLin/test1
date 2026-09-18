import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyMessage({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = window.setTimeout(() => setState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      className="message-copy"
      aria-label={state === 'copied' ? '已复制' : '复制回复'}
      title="复制回复"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('copied')
        } catch {
          setState('error')
        }
      }}
    >
      {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">
        {state === 'copied'
          ? '已复制'
          : state === 'error'
            ? '复制失败，请手动复制'
            : ''}
      </span>
    </button>
  )
}
