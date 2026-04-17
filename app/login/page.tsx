'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const nextPath = search.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const sb = createClient()
    const { error } = await sb.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push(nextPath)
    router.refresh()
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-4">ログイン</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">メールアドレス</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="clinic@example.com" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">パスワード</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="••••••••" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
      <p className="text-sm text-gray-500 text-center mt-4">
        ※ アカウント作成・パスワード再発行は管理者にお問い合わせください
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-white text-2xl mx-auto mb-3">V</div>
          <h1 className="text-2xl font-black text-gray-900">VisionClinic</h1>
          <p className="text-sm text-gray-500 mt-1">視機能評価・ビジョントレーニング</p>
        </div>
        <Suspense fallback={<div className="card">読み込み中...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
