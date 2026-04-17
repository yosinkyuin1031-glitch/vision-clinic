'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { VisionExercise, ExerciseCategory } from '@/types'

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  pursuit: '追従',
  saccade: '跳躍',
  convergence: '輻輳',
  peripheral: '周辺視野',
  eye_stretch: 'アイストレッチ',
  balance: 'バランス',
}

const CATEGORY_COLOR: Record<ExerciseCategory, string> = {
  pursuit: 'bg-blue-100 text-blue-700',
  saccade: 'bg-orange-100 text-orange-700',
  convergence: 'bg-purple-100 text-purple-700',
  peripheral: 'bg-green-100 text-green-700',
  eye_stretch: 'bg-pink-100 text-pink-700',
  balance: 'bg-teal-100 text-teal-700',
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<VisionExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('vision_exercises').select('*').order('category').order('difficulty').then(({ data }) => {
      setExercises((data as VisionExercise[]) || [])
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? exercises : exercises.filter(e => e.category === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← ダッシュボード</Link>
            <span className="font-black text-lg text-gray-900">ビジョントレーニング一覧</span>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-4">各種目のやり方・メトロノームBPM・動画URLを管理できます</p>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilter('all')} className={`text-xs font-bold px-3 py-1.5 rounded-full ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            すべて
          </button>
          {(Object.keys(CATEGORY_LABEL) as ExerciseCategory[]).map(c => (
            <button key={c} onClick={() => setFilter(c)} className={`text-xs font-bold px-3 py-1.5 rounded-full ${filter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ex => (
              <Link key={ex.id} href={`/exercises/${ex.id}`} className="card hover:border-indigo-300 hover:shadow-md transition-all block">
                <div className="flex items-center gap-4">
                  {ex.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ex.image_url} alt={ex.name} className="w-16 h-16 object-contain rounded-xl bg-gray-50 flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-xs flex-shrink-0">👁️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-base">{ex.name}</h3>
                      <span className={`badge ${CATEGORY_COLOR[ex.category]}`}>{CATEGORY_LABEL[ex.category]}</span>
                      <span className={`badge ${ex.difficulty === 'beginner' ? 'badge-green' : ex.difficulty === 'intermediate' ? 'badge-yellow' : 'badge-red'}`}>
                        {ex.difficulty === 'beginner' ? '初級' : ex.difficulty === 'intermediate' ? '中級' : '上級'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{ex.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">
                        {ex.duration_sec}秒{ex.default_bpm ? ` / ${ex.default_bpm} BPM` : ''}
                      </span>
                      {ex.video_url ? (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">動画あり</span>
                      ) : (
                        <span className="text-xs text-gray-300">動画未設定</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-sm font-bold text-indigo-600">設定 →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
