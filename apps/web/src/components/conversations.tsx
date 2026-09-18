import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { LoaderCircle, PanelLeftOpen } from 'lucide-react'
import { Chat } from './chat'
import { Sidebar } from './conversations/sidebar'
import { useConversations } from './conversations/use-conversations'

type Props = {
  userId: string
  name: string
  onSignOut: () => void
  signingOut: boolean
  accountError?: string
}
export function Conversations({
  userId,
  name,
  onSignOut,
  signingOut,
  accountError,
}: Props) {
  const {
    items,
    selected,
    setSelected,
    loading,
    error,
    initial,
    setInitial,
    create,
    refresh,
  } = useConversations(userId)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  function select(id: string | null) {
    setSelected(id)
    setMobileOpen(false)
  }
  const active = items.find((item) => item.id === selected)
  const sidebar = (
    <Sidebar
      items={items}
      selected={selected}
      loading={loading}
      error={error}
      refresh={refresh}
      name={name}
      signingOut={signingOut}
      onSignOut={onSignOut}
      onCollapse={() => setCollapsed(true)}
      select={select}
    />
  )
  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className={`workspace ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar desktop-sidebar" aria-label="侧栏">
          {sidebar}
        </aside>
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay" />
          <Dialog.Content
            className="sidebar mobile-sidebar"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">对话导航</Dialog.Title>
            {sidebar}
          </Dialog.Content>
        </Dialog.Portal>
        <main className="workspace-main">
          <header className="chat-header">
            <div className="header-leading">
              <Dialog.Trigger asChild>
                <button
                  className="icon-button mobile-only"
                  type="button"
                  aria-label="打开侧栏"
                >
                  <PanelLeftOpen size={18} />
                </button>
              </Dialog.Trigger>
              {collapsed && (
                <button
                  className="icon-button desktop-only"
                  type="button"
                  aria-label="展开侧栏"
                  onClick={() => setCollapsed(false)}
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <span className="header-title">{active?.title ?? ''}</span>
            </div>
          </header>
          {accountError && (
            <div className="account-error" role="alert">
              {accountError}
            </div>
          )}
          {loading ? (
            <div className="workspace-loading" role="status">
              <LoaderCircle size={18} className="animate-spin" />
              <span className="sr-only">正在加载</span>
            </div>
          ) : (
            <Chat
              key={selected ?? 'new'}
              conversationId={selected}
              userId={userId}
              initialPrompt={
                initial?.id === selected ? initial.prompt : undefined
              }
              onCreate={async (prompt) => {
                await create(prompt)
                setMobileOpen(false)
              }}
              onInitialConsumed={() => setInitial(null)}
              onSent={refresh}
            />
          )}
        </main>
      </div>
    </Dialog.Root>
  )
}
