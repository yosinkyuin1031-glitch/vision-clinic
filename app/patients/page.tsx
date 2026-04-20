'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { Patient } from '@/types'

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      // RLSにより自動的に自院の患者のみ取得される
      const sb = createClient()
      const { data } = await sb
        .from('vc_patients')
        .select('*')
        .order('created_at', { ascending: false })
      setPatients((data as Patient[]) || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = search.length > 0
    ? patients.filter(p => p.name.includes(search))
    : patients

  return (
    <div className="min-h-screen bg-gray-50 has-bottom-nav">
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium min-h-[44px] flex items-center">← 戻る</Link>
          <span className="font-bold text-gray-900 text-sm">患者一覧</span>
          <Link href="/patients/new" className="text-indigo-600 font-bold text-sm min-h-[44px] flex items-center">+ 新規</Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <input type="text" placeholder="名前で検索..." value={search} onChange={e => setSearch(e.target.value)} className="input mb-4" />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-bold">患者が登録されていません</p>
            <p className="text-sm mt-1">右上の「+ 新規」から登録してください</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} className="card block active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  {p.gender === 'male' ? '👨' : '👩'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.age ? `${p.age}歳` : '年齢未登録'}
                    {p.gender === 'male' ? ' · 男性' : p.gender === 'female' ? ' · 女性' : ''}
                    {p.occupation ? ` · ${p.occupation}` : ''}
                    {p.wears_glasses ? ' · 眼鏡' : ''}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">登録 {new Date(p.created_at).toLocaleDateString('ja-JP')}</p>
                </div>
                <div className="text-gray-300 text-sm flex-shrink-0">›</div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ボトムナビゲーション */}
      <nav className="bottom-nav no-print">
        <div className="bottom-nav-inner">
          <Link href="/" className="bottom-nav-item">
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
          <Link href="/patients" className="bottom-nav-item active">
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
