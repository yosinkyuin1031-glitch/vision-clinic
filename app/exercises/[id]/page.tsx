'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { VisionExercise, ExerciseCategory } from '@/types'
import { QRCodeSVG } from 'qrcode.react'

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'pursuit', label: '追従（滑動性眼球運動）' },
  { value: 'saccade', label: '跳躍（サッケード）' },
  { value: 'convergence', label: '輻輳（寄り目）' },
  { value: 'peripheral', label: '周辺視野' },
  { value: 'eye_stretch', label: 'アイストレッチ' },
  { value: 'balance', label: 'バランス' },
]

export default function ExerciseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ex, setEx] = useState<VisionExercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    instruction: '',
    category: 'pursuit' as ExerciseCategory,
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    default_bpm: '' as string,
    duration_sec: 60 as number,
    image_url: '',
    video_url: '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('vision_exercises').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        const v = data as VisionExercise
        setEx(v)
        setForm({
          name: v.name || '',
          description: v.description || '',
          instruction: v.instruction || '',
          category: (v.category as ExerciseCategory) || 'pursuit',
          difficulty: v.difficulty || 'beginner',
          default_bpm: v.default_bpm != null ? String(v.default_bpm) : '',
          duration_sec: v.duration_sec || 60,
          image_url: v.image_url || '',
          video_url: v.video_url || '',
        })
      }
      setLoading(false)
    })
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/exercises/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        instruction: form.instruction,
        category: form.category,
        difficulty: form.difficulty,
        default_bpm: form.default_bpm ? Number(form.default_bpm) : null,
        duration_sec: form.duration_sec,
        image_url: form.image_url || null,
        video_url: form.video_url || null,
      })
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>
  if (!ex) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">トレーニングが見つかりません</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/exercises" className="text-gray-400 hover:text-gray-600 text-sm">← 一覧に戻る</Link>
            <span className="font-black text-lg text-gray-900">{ex.name}</span>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm !px-5 !py-2.5">
            {saving ? '保存中...' : saved ? '保存しました' : '保存する'}
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* プレビュー */}
        <div className="card">
          <h2 className="font-bold text-sm text-gray-500 mb-3">プレビュー</h2>
          <div className="flex items-center gap-4">
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt={form.name} className="w-24 h-24 object-contain rounded-xl bg-gray-50" />
            ) : (
              <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-xs">👁️</div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg">{form.name || 'トレーニング名'}</h3>
              <p className="text-sm text-orange-500 font-bold">
                {form.duration_sec}秒{form.default_bpm ? ` / ${form.default_bpm} BPM` : ''}
              </p>
              <p className="text-xs text-gray-500 mt-1">{form.description}</p>
            </div>
            {form.video_url && (
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <QRCodeSVG value={form.video_url} size={72} level="M" />
                <span className="text-xs text-gray-400">動画QR</span>
              </div>
            )}
          </div>
        </div>

        {/* トレーニング内容 */}
        <div className="card">
          <h2 className="font-bold text-base mb-4 text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-sm">1</span>
            種目内容
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">種目名</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="label">説明（なぜこのトレーニングが有効か）</label>
              <textarea className="input min-h-[80px]" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div>
              <label className="label">やり方の詳細</label>
              <textarea className="input min-h-[80px]" value={form.instruction} onChange={e => setForm({...form, instruction: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">カテゴリ</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value as ExerciseCategory})}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">難易度</label>
                <select className="input" value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced'})}>
                  <option value="beginner">初級</option>
                  <option value="intermediate">中級</option>
                  <option value="advanced">上級</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">推奨BPM（メトロノーム）</label>
                <input type="number" className="input" value={form.default_bpm} onChange={e => setForm({...form, default_bpm: e.target.value})} placeholder="例: 58" />
                <p className="text-xs text-gray-400 mt-1">空欄ならBPM不要（輻輳・ストレッチ等）</p>
              </div>
              <div>
                <label className="label">推奨実施秒数</label>
                <input type="number" className="input" value={form.duration_sec} onChange={e => setForm({...form, duration_sec: Number(e.target.value)})} />
              </div>
            </div>
          </div>
        </div>

        {/* イラスト */}
        <div className="card">
          <h2 className="font-bold text-base mb-4 text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center text-sm">2</span>
            イラスト画像
          </h2>
          <div>
            <label className="label">画像URL</label>
            <input className="input" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="例: /exercises/pursuit.png" />
            <p className="text-xs text-gray-400 mt-1.5">public/exercisesフォルダの画像パスを入力してください</p>
          </div>
          {form.image_url && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.image_url} alt="プレビュー" className="max-h-48 object-contain" />
            </div>
          )}
        </div>

        {/* 動画URL */}
        <div className="card">
          <h2 className="font-bold text-base mb-4 text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center text-sm">3</span>
            動画URL
          </h2>
          <div>
            <label className="label">YouTube動画URL（限定公開推奨）</label>
            <input className="input" value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} placeholder="例: https://youtu.be/xxxxx" />
            <p className="text-xs text-gray-400 mt-1.5">URLを入力すると、印刷時にQRコードが自動表示されます</p>
          </div>
          {form.video_url && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <QRCodeSVG value={form.video_url} size={120} level="M" />
                  <span className="text-xs text-gray-500 font-medium">印刷時にこのQRが表示されます</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">患者さんがスマホでこのQRコードを読み取ると、動画が再生されます。</p>
                  <a href={form.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700">
                    動画を確認する →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-center">
          {saving ? '保存中...' : saved ? '保存しました' : '保存する'}
        </button>
      </main>
    </div>
  )
}
