import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { LogOut, PanelLeftClose, Plus, Search, X } from 'lucide-react'
import type { useConversations } from './use-conversations'

type Props = Pick<
  ReturnType<typeof useConversations>,
  'items' | 'selected' | 'loading' | 'error' | 'refresh'
> & {
  name: string
  signingOut: boolean
  onSignOut: () => void
  onCollapse: () => void
  select: (id: string | null) => void
}

function dateGroup(timestamp: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  return timestamp >= today.getTime()
    ? '今天'
    : timestamp >= yesterday.getTime()
      ? '昨天'
      : '更早'
}

export function Sidebar({
  items,
  selected,
  loading,
  error,
  refresh,
  name,
  signingOut,
  onSignOut,
  onCollapse,
  select,
}: Props) {
  const [search, setSearch] = useState('')
  const filtered = items.filter((item) =>
    item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
  return (
    <>
      <div className="sidebar-brand">
        <span className="wordmark">weave</span>
        <button
          type="button"
          className="icon-button desktop-only"
          aria-label="收起侧栏"
          onClick={onCollapse}
        >
          <PanelLeftClose size={17} />
        </button>
        <Dialog.Close asChild>
          <button
            type="button"
            className="icon-button mobile-only"
            aria-label="关闭侧栏"
          >
            <X size={18} />
          </button>
        </Dialog.Close>
      </div>
      <button
        type="button"
        className="new-conversation"
        onClick={() => select(null)}
        disabled={loading}
      >
        <Plus size={17} />
        <span>新对话</span>
      </button>
      {items.length > 0 && (
        <div className="sidebar-search">
          <Search size={14} />
          <input
            aria-label="搜索对话"
            placeholder="搜索对话"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => setSearch('')}
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
      <nav className="conversation-nav" aria-label="历史对话">
        {loading ? (
          <div className="sidebar-skeleton" aria-label="正在加载对话">
            <i />
            <i />
            <i />
          </div>
        ) : error ? (
          <div className="sidebar-empty" role="alert">
            {error}
            <button type="button" onClick={refresh}>
              重新加载
            </button>
          </div>
        ) : filtered.length === 0 ? (
          search ? (
            <div className="sidebar-empty">没有找到对话</div>
          ) : null
        ) : (
          ['今天', '昨天', '更早'].map((group) => {
            const rows = filtered.filter(
              (item) => dateGroup(item.updatedAt) === group,
            )
            return (
              rows.length > 0 && (
                <div className="conversation-group" key={group}>
                  <h2>{group}</h2>
                  {rows.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.title}
                      aria-current={item.id === selected ? 'page' : undefined}
                      onClick={() => select(item.id)}
                      className={`conversation-item ${item.id === selected ? 'active' : ''}`}
                    >
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              )
            )
          })
        )}
      </nav>
      <div className="sidebar-account">
        <div>
          <p>{name || '我的账号'}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          title="退出登录"
          aria-label="退出登录"
          disabled={signingOut}
          onClick={onSignOut}
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  )
}
