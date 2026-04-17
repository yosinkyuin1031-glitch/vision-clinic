'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function SignupPage() {
  const router = useRouter()
  const [clinicName, setClinicName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const sb = createClient()
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { clinic_name: clinicName } },
    })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    // vc_clinics に院レコードを作成（RLS: owner_user_id = auth.uid()）
    if (data.user) {
      const { error: clinicErr } = await sb.from('vc_clinics').insert({
        name: clinicName,
        owner_user_id: data.user.id,
      })
      if (clinicErr) {
        setLoading(false)
        setError('院情報の作成に失敗: ' + clinicErr.message)
        return
      }
    }
    setLoading(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-white text-xl mx-auto mb-3">V</div>
          <h1 className="text-2xl font-black text-gray-900">院アカウント作成</h1>
          <p className="text-sm text-gray-500 mt-1">VisionClinic の院アカウントを発行します</p>
        </div>
        <div className="card">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">院名</label>
              <input type="text" required value={clinicName} onChange={e => setClinicName(e.target.value)} className="input" placeholder="○○整体院" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">メールアドレス</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="clinic@example.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">パスワード（8文字以上）</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '作成中...' : '院アカウント作成'}
            </button>
          </form>
          <p className="text-sm text-gray-500 text-center mt-4">
            既にアカウントをお持ちの方 <Link href="/login" className="text-blue-600 font-bold hover:underline">ログイン</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
