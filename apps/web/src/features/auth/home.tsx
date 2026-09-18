import { useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Conversations } from '@/components/conversations'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Home() {
  const {
    data: session,
    isPending,
    error: sessionError,
  } = authClient.useSession()
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email'))
    const password = String(data.get('password'))
    try {
      const result = register
        ? await authClient.signUp.email({
            email,
            password,
            name: String(data.get('name')),
          })
        : await authClient.signIn.email({ email, password })
      if (result.error) setError(result.error.message ?? '认证失败')
    } catch {
      setError('无法连接认证服务')
    } finally {
      setBusy(false)
    }
  }
  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error(result.error.message)
    } catch {
      setError('退出失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  if (session)
    return (
      <Conversations
        key={session.user.id}
        userId={session.user.id}
        name={session.user.name}
        onSignOut={signOut}
        signingOut={busy}
        accountError={error}
      />
    )
  return (
    <div className="auth-page">
      <header className="auth-header">
        <span className="wordmark">weave</span>
      </header>
      <main className="auth-main">
        <div className="auth-form-wrap">
          {isPending ? (
            <div className="history-loading" role="status">
              <LoaderCircle size={17} className="animate-spin" />
              正在打开工作空间…
            </div>
          ) : (
            <form onSubmit={authenticate} className="auth-form">
              <div className="auth-form-heading">
                <h2>{register ? '创建账号' : '登录'}</h2>
              </div>
              {register && (
                <label>
                  <span>名字</span>
                  <Input
                    name="name"
                    placeholder="怎么称呼你"
                    required
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                <span>邮箱</span>
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                <span>密码</span>
                <Input
                  name="password"
                  type="password"
                  placeholder={register ? '至少 8 位字符' : '输入你的密码'}
                  minLength={8}
                  required
                  autoComplete={register ? 'new-password' : 'current-password'}
                />
              </label>
              {(error || sessionError) && (
                <p role="alert" className="auth-error">
                  {error || '暂时无法连接服务，请稍后重试。'}
                </p>
              )}
              <Button className="auth-submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <>{register ? '创建账号' : '登录'}</>
                )}
              </Button>
              <p className="auth-switch">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRegister(!register)
                    setError('')
                  }}
                >
                  {register ? '登录' : '创建账号'}
                </button>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
