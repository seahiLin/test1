import type { FormEvent } from 'react'
import { ArrowUp, LoaderCircle, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import type { useChat } from './use-chat'

type Props = Pick<
  ReturnType<typeof useChat>,
  | 'agent'
  | 'prompt'
  | 'setPrompt'
  | 'sendError'
  | 'setSendError'
  | 'creating'
  | 'textarea'
  | 'busy'
  | 'ready'
  | 'modelError'
  | 'submit'
> & { conversationId: string | null }

export function Composer({
  agent,
  prompt,
  setPrompt,
  sendError,
  setSendError,
  creating,
  textarea,
  busy,
  ready,
  modelError,
  submit,
  conversationId,
}: Props) {
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(prompt)
  }
  return (
    <div className="composer-wrap">
      {(sendError || agent.error) && (
        <div role="alert" className="chat-error">
          <span>{sendError || modelError}</span>
          {agent.error && (
            <button
              type="button"
              onClick={() => {
                setSendError('')
                agent.refresh()
              }}
            >
              <RotateCcw size={13} />
              重新连接
            </button>
          )}
        </div>
      )}
      <form onSubmit={send} className="composer">
        <label htmlFor="chat-prompt" className="sr-only">
          消息
        </label>
        <textarea
          ref={textarea}
          id="chat-prompt"
          rows={1}
          value={prompt}
          maxLength={16000}
          placeholder="发送消息…"
          disabled={creating}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.keyCode !== 229
            ) {
              event.preventDefault()
              if (!busy) event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          className="send-button"
          aria-label="发送消息"
          title="发送消息 · Enter"
          disabled={busy || creating || !ready || !prompt.trim()}
        >
          {creating || (conversationId && !ready) ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <ArrowUp size={17} />
          )}
        </Button>
      </form>
    </div>
  )
}
