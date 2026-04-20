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
  coordination: '協調運動',
  warmup: 'ウォームアップ',
}

const CATEGORY_COLOR: Record<ExerciseCategory, string> = {
  pursuit: 'bg-blue-100 text-blue-700',
  saccade: 'bg-orange-100 text-orange-700',
  convergence: 'bg-purple-100 text-purple-700',
  peripheral: 'bg-green-100 text-green-700',
  eye_stretch: 'bg-pink-100 text-pink-700',
  balance: 'bg-teal-100 text-teal-700',
  coordination: 'bg-amber-100 text-amber-700',
  warmup: 'bg-gray-100 text-gray-700',
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
    <div className="min-h-screen bg-gray-50 has-bottom-nav">
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium min-h-[44px] flex items-center">← 戻る</Link>
          <span className="font-bold text-gray-900 text-sm">トレーニング種目</span>
          <div className="w-10" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setFilter('all')} className={`text-xs font-bold px-3 py-1.5 rounded-full min-h-[32px] ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            すべて
          </button>
          {(Object.keys(CATEGORY_LABEL) as ExerciseCategory[]).map(c => (
            <button key={c} onClick={() => setFilter(c)} className={`text-xs font-bold px-3 py-1.5 rounded-full min-h-[32px] ${filter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ex => (
              <Link key={ex.id} href={`/exercises/${ex.id}`} className="card block active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                  {ex.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ex.image_url} alt={ex.name} className="w-12 h-12 object-contain rounded-xl bg-gray-50 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-xs flex-shrink-0">👁️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <h3 className="font-bold text-sm">{ex.name}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_COLOR[ex.category]}`}>{CATEGORY_LABEL[ex.category]}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{ex.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {ex.duration_sec}秒{ex.default_bpm ? ` / ${ex.default_bpm}BPM` : ''}
                      </span>
                      {ex.video_url && (
                        <span className="text-[10px] font-bold text-green-600">動画あり</span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm flex-shrink-0">›</div>
                </div>
              </Link>
            ))}
          </div>
        )}
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
          <Link href="/patients" className="bottom-nav-item">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            <span className="text-[10px] font-bold">患者</span>
          </Link>
          <Link href="/exercises" className="bottom-nav-item active">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            <span className="text-[10px] font-bold">種目</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
