'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function HomePage() {
  const router = useRouter()
  const [clinicName, setClinicName] = useState<string>('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await sb.from('vc_clinics').select('name').eq('owner_user_id', user.id).maybeSingle()
      if (data?.name) setClinicName(data.name)
    })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 has-bottom-nav">
      {/* モバイルヘッダー */}
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xs">V</div>
            <div>
              <div className="font-black text-base text-gray-900 leading-tight">VisionClinic</div>
              {clinicName && <div className="text-[10px] text-gray-500 leading-tight">{clinicName}</div>}
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 text-xs font-medium px-2 py-1.5">ログアウト</button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* メインアクション */}
        <Link href="/analyze" className="block mb-4">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">👁️</div>
              <div>
                <h2 className="text-lg font-black mb-0.5">視機能評価を開始</h2>
                <p className="text-sm text-indigo-200">チェック → カメラ → AI処方</p>
              </div>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/patients/new" className="card !p-4 hover:border-indigo-300 active:scale-[0.98] transition-transform block">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl mb-2">👤</div>
            <h3 className="font-bold text-sm">患者登録</h3>
            <p className="text-xs text-gray-500 mt-0.5">名前・年齢・職業</p>
          </Link>
          <Link href="/settings/treatments" className="card !p-4 hover:border-purple-300 active:scale-[0.98] transition-transform block">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl mb-2">⚕️</div>
            <h3 className="font-bold text-sm">施術ルール</h3>
            <p className="text-xs text-gray-500 mt-0.5">提案ルール管理</p>
          </Link>
        </div>

        {/* アプリの流れ */}
        <div className="card">
          <h2 className="font-bold text-base mb-4 text-gray-900">アプリの流れ</h2>
          <div className="space-y-3">
            {[
              { step:'1', title:'セルフチェック', desc:'30項目を3段階で回答', color:'bg-blue-500' },
              { step:'2', title:'カメラ評価', desc:'7項目を約40秒で全自動測定', color:'bg-indigo-500' },
              { step:'3', title:'レベル判定', desc:'正常〜機能低下の4段階', color:'bg-purple-500' },
              { step:'4', title:'AI処方', desc:'トレーニング＋施術提案', color:'bg-orange-500' },
            ].map(item => (
              <div key={item.step} className="flex items-center gap-3">
                <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0`}>{item.step}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">{item.title}</h3>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ボトムナビゲーション */}
      <nav className="bottom-nav no-print">
        <div className="bottom-nav-inner">
          <Link href="/" className="bottom-nav-item active">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
            <span className="text-[10px] font-bold">ホーム</span>
          </Link>
          <Link href="/analyze" className="bottom-nav-item">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            <span className="text-[10px] font-bold">評価</span>
          </Link>
          <Link href="/training" className="bottom-nav-item">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="text-[10px] font-bold">実行</span>
          </Link>
          <Link href="/patients" className="bottom-nav-item">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            <span className="text-[10px] font-bold">患者</span>
          </Link>
          <Link href="/exercises" className="bottom-nav-item">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            <span className="text-[10px] font-bold">種目</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
