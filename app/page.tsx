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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-sm">V</div>
            <div>
              <div className="font-black text-lg text-gray-900 leading-tight">VisionClinic</div>
              {clinicName && <div className="text-xs text-gray-500 leading-tight">{clinicName}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/exercises" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium">トレーニング一覧</Link>
            <Link href="/patients" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium">患者一覧</Link>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium">ログアウト</button>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-4 mb-8">
          <Link href="/patients/new" className="card hover:border-indigo-300 hover:shadow-md transition-all block">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👤</div>
              <div>
                <h2 className="text-lg font-bold mb-1">患者を登録する</h2>
                <p className="text-sm text-gray-500">名前・年齢・職業・眼鏡有無を入力</p>
              </div>
            </div>
          </Link>
          <Link href="/analyze" className="card hover:border-orange-300 hover:shadow-md transition-all block">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👁️</div>
              <div>
                <h2 className="text-lg font-bold mb-1">視機能評価を開始</h2>
                <p className="text-sm text-gray-500">30項目チェック + カメラ7項目全自動 → AIがビジョントレーニングを処方</p>
              </div>
            </div>
          </Link>
          <Link href="/settings/treatments" className="card hover:border-purple-300 hover:shadow-md transition-all block">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">⚕️</div>
              <div>
                <h2 className="text-lg font-bold mb-1">施術提案ルール管理</h2>
                <p className="text-sm text-gray-500">二葉先生の知見ベースの施術提案を確認・編集</p>
              </div>
            </div>
          </Link>
        </div>
        <div className="card">
          <h2 className="font-bold text-lg mb-6 text-gray-900">アプリの流れ</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { step:'01', icon:'📝', title:'セルフチェック30項目', desc:'視覚疲労・両眼協調・姿勢連動を3段階で回答' },
              { step:'02', icon:'📷', title:'カメラ7項目全自動', desc:'輻輳・開散・注視・追従・サッカード・瞬目・頭部代償' },
              { step:'03', icon:'📊', title:'機能レベル判定', desc:'正常・軽度・中等度・機能低下の4段階' },
              { step:'04', icon:'🤖', title:'AI処方', desc:'モード別トレーニング＋施術提案を自動生成' },
            ].map(item => (
              <div key={item.step} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-black text-indigo-600 tracking-widest">{item.step}</span>
                <span className="text-2xl">{item.icon}</span>
                <h3 className="font-bold text-sm">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
