'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicId } from '@/lib/use-clinic'

export default function NewPatientPage() {
  const router = useRouter()
  const { clinicId } = useClinicId()
  const [form, setForm] = useState({ name:'', age:'', gender:'', phone:'', occupation:'', wears_glasses:false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.name) { setError('名前は必須です'); return }
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        phone: form.phone || null,
        occupation: form.occupation || null,
        wears_glasses: form.wears_glasses,
      }
      if (clinicId) body.clinic_id = clinicId
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push('/patients')
    } catch(e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <Link href="/patients" className="text-gray-500 hover:text-gray-900 text-sm font-medium min-h-[44px] flex items-center">← 戻る</Link>
          <span className="font-bold text-gray-900 text-sm">新規患者登録</span>
          <div className="w-10" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="card space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}
          <div>
            <label className="label">名前 <span className="text-red-500">*</span></label>
            <input type="text" placeholder="例: 田中 花子" value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">年齢</label>
              <input type="number" placeholder="例: 45" value={form.age} onChange={e => setForm(p => ({...p, age:e.target.value}))} className="input" />
            </div>
            <div>
              <label className="label">性別</label>
              <select value={form.gender} onChange={e => setForm(p => ({...p, gender:e.target.value}))} className="input">
                <option value="">選択してください</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">電話番号</label>
            <input type="tel" placeholder="例: 090-1234-5678" value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))} className="input" />
          </div>
          <div>
            <label className="label">職業</label>
            <input type="text" placeholder="例: デスクワーク、野球選手、学生" value={form.occupation} onChange={e => setForm(p => ({...p, occupation:e.target.value}))} className="input" />
            <p className="text-xs text-gray-500 mt-1">画面作業時間や必要な視覚パフォーマンスの参考にします</p>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input type="checkbox" checked={form.wears_glasses} onChange={e => setForm(p => ({...p, wears_glasses:e.target.checked}))} className="w-5 h-5 rounded" />
              <span className="text-sm font-medium text-gray-700">眼鏡・コンタクトを使用している</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Link href="/patients" className="btn-secondary flex-1 text-center">キャンセル</Link>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1 disabled:opacity-40">
              {loading ? '登録中...' : '登録する'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
