import { LoaderCircle } from 'lucide-react'
import { Composer } from './chat/composer'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from './ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from './ai-elements/message'
import { CopyMessage } from './chat/copy-message'
import { useChat, type ChatProps } from './chat/use-chat'

export function Chat(props: ChatProps) {
  const { conversationId } = props
  const chat = useChat(props)
  const { agent, busy, ready, empty } = chat
  const composer = <Composer {...chat} conversationId={conversationId} />

  return (
    <section
      className={`chat-panel ${empty && ready ? 'chat-empty' : ''}`}
      aria-label="聊天"
    >
      {empty && ready ? (
        <div className="welcome-layout">{composer}</div>
      ) : (
        <>
          <Conversation className="min-h-0" aria-label="消息记录">
            <ConversationContent className="message-list">
              {!ready && !agent.error && (
                <div className="history-loading" role="status">
                  <LoaderCircle size={15} className="animate-spin" />
                  正在恢复对话…
                </div>
              )}
              {agent.messages.map((message) => {
                const text = message.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text)
                  .join('\n\n')
                const streaming = message.parts.some(
                  (part) => part.type === 'text' && part.state === 'streaming',
                )
                const failed = agent.failedSends.some(
                  (send) => send.id === message.id,
                )
                if (!text && message.role !== 'user') return null
                return (
                  <Message
                    key={message.id}
                    from={message.role}
                    className={
                      message.role === 'user'
                        ? 'user-message'
                        : 'assistant-message'
                    }
                  >
                    <MessageContent className="message-content">
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap break-words">
                          {text}
                        </p>
                      ) : (
                        <MessageResponse isAnimating={streaming}>
                          {text}
                        </MessageResponse>
                      )}
                    </MessageContent>
                    {failed && (
                      <p className="failed-message" role="status">
                        这条消息未发送成功，请从输入框重试。
                      </p>
                    )}
                    {message.role === 'assistant' && !streaming && (
                      <div className="message-actions">
                        <CopyMessage text={text} />
                      </div>
                    )}
                  </Message>
                )
              })}
              {busy && (
                <div
                  className="reply-status"
                  role="status"
                  aria-label="正在回复"
                >
                  <LoaderCircle size={14} className="animate-spin" />
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton
              aria-label="回到最新消息"
              title="回到最新消息"
              className="scroll-latest"
            />
          </Conversation>
          <div className="composer-dock">{composer}</div>
        </>
      )}
    </section>
  )
}
