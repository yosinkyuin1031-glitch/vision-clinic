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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium">← ダッシュボード</Link>
          <span className="font-bold text-gray-900">患者一覧</span>
          <Link href="/patients/new" className="btn-primary text-sm py-2 px-4">+ 新規</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <input type="text" placeholder="名前で検索..." value={search} onChange={e => setSearch(e.target.value)} className="input max-w-sm mb-6" />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-bold">患者が登録されていません</p>
            <p className="text-sm mt-1">右上の「+ 新規」から登録してください</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="card hover:shadow-md transition-all">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-bold text-lg text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">
                    {p.age ? `${p.age}歳` : '年齢未登録'} /
                    {p.gender === 'male' ? ' 男性' : p.gender === 'female' ? ' 女性' : ' 未設定'}
                    {p.occupation ? ` / ${p.occupation}` : ''}
                    {p.wears_glasses ? ' / 眼鏡使用' : ''} ·
                    登録 {new Date(p.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/patients/${p.id}`} className="btn-secondary text-sm py-2 px-4">詳細</Link>
                  <Link href={`/analyze?patient_id=${p.id}`} className="btn-primary text-sm py-2 px-4">視機能評価</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
