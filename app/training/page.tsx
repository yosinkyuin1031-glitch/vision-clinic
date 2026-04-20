'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { VisionExercise, ExerciseCategory } from '@/types'

// ========================================
// 定数
// ========================================

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  pursuit: '追従', saccade: '跳躍', convergence: '輻輳', peripheral: '周辺視野',
  eye_stretch: 'アイストレッチ', balance: 'バランス', coordination: '協調運動', warmup: 'ウォームアップ',
}

const CATEGORY_COLOR: Record<ExerciseCategory, string> = {
  pursuit: 'bg-blue-500', saccade: 'bg-orange-500', convergence: 'bg-purple-500', peripheral: 'bg-green-500',
  eye_stretch: 'bg-pink-500', balance: 'bg-teal-500', coordination: 'bg-amber-500', warmup: 'bg-gray-500',
}

// ========================================
// メトロノーム
// ========================================
function useMetronome(bpm: number | null, active: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || !bpm || bpm <= 0) return
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.stop(ctx.currentTime + 0.08)
    }
    play()
    intervalRef.current = setInterval(play, 60000 / bpm)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      ctx.close()
    }
  }, [bpm, active])
}

// ========================================
// 追従アニメーション
// ========================================
function PursuitAnimation({ elapsed, duration }: { elapsed: number; duration: number }) {
  const progress = elapsed / duration
  const angle = progress * Math.PI * 2 * 3 // 3周
  const x = 50 + Math.cos(angle) * 35
  const y = 50 + Math.sin(angle) * 30
  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden">
      <div className="absolute w-8 h-8 bg-green-400 rounded-full shadow-lg shadow-green-400/50 border-2 border-white"
        style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', transition: 'all 50ms linear' }} />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">緑の点を目だけで追ってください</p>
    </div>
  )
}

// ========================================
// サッカードアニメーション
// ========================================
function SaccadeAnimation({ elapsed, duration }: { elapsed: number; duration: number }) {
  const cycle = 1.2
  const idx = Math.floor(elapsed / cycle)
  const positions = [
    { x: 15, y: 50 }, { x: 85, y: 50 }, { x: 50, y: 20 }, { x: 50, y: 80 },
    { x: 20, y: 25 }, { x: 80, y: 75 }, { x: 80, y: 25 }, { x: 20, y: 75 },
  ]
  const pos = positions[idx % positions.length]
  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden">
      <div className="absolute w-8 h-8 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50 border-2 border-white animate-pulse"
        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }} />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">点が出たらすぐそこを見てください ({idx + 1}回目)</p>
    </div>
  )
}

// ========================================
// 輻輳（遠近切替）アニメーション
// ========================================
function ConvergenceAnimation({ elapsed }: { elapsed: number }) {
  const cycle = 3
  const phase = (elapsed % cycle) / cycle
  const isNear = phase < 0.5
  const size = isNear ? 48 : 12
  const label = isNear ? '近く（寄り目）' : '遠く（リラックス）'
  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
      <div className="bg-indigo-400 rounded-full border-2 border-white transition-all duration-500 ease-in-out"
        style={{ width: size, height: size, boxShadow: `0 0 ${size}px rgba(129,140,248,0.5)` }} />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">{label}</p>
    </div>
  )
}

// ========================================
// 注視アニメーション
// ========================================
function FixationAnimation() {
  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
      <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-red-500/50" />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">赤い点をじっと見つめてください</p>
    </div>
  )
}

// ========================================
// 周辺視野アニメーション
// ========================================
function PeripheralAnimation({ elapsed }: { elapsed: number }) {
  const flashIdx = Math.floor(elapsed * 1.5)
  const positions = [
    { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 },
    { x: 50, y: 5 }, { x: 95, y: 50 }, { x: 50, y: 95 }, { x: 5, y: 50 },
  ]
  const active = positions[flashIdx % positions.length]
  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden">
      <div className="absolute w-5 h-5 bg-red-500 rounded-full border border-white"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      <div className="absolute w-6 h-6 bg-cyan-400 rounded-full border border-white animate-ping"
        style={{ left: `${active.x}%`, top: `${active.y}%`, transform: 'translate(-50%, -50%)' }} />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">中央を見つめたまま、光る点に気づいてください</p>
    </div>
  )
}

// ========================================
// ナンバータッチ
// ========================================
function NumberTouchGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [numbers, setNumbers] = useState<{ n: number; x: number; y: number }[]>([])
  const [nextNum, setNextNum] = useState(1)
  const [wrong, setWrong] = useState(false)
  const [startTime] = useState(Date.now())
  const total = 20

  useEffect(() => {
    const nums: { n: number; x: number; y: number }[] = []
    for (let i = 1; i <= total; i++) {
      let x: number, y: number, ok: boolean
      do {
        x = 8 + Math.random() * 84
        y = 8 + Math.random() * 84
        ok = nums.every(n => Math.hypot(n.x - x, n.y - y) > 12)
      } while (!ok)
      nums.push({ n: i, x, y })
    }
    setNumbers(nums)
  }, [])

  const handleTap = (n: number) => {
    if (n === nextNum) {
      setWrong(false)
      if (n === total) {
        const elapsed = (Date.now() - startTime) / 1000
        onComplete(Math.round(elapsed * 10) / 10)
      } else {
        setNextNum(n + 1)
      }
    } else {
      setWrong(true)
      setTimeout(() => setWrong(false), 300)
    }
  }

  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden">
      {numbers.map(item => (
        <button key={item.n} onClick={() => handleTap(item.n)}
          className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all
            ${item.n < nextNum ? 'bg-green-500 border-green-300 text-white scale-75 opacity-50' :
              item.n === nextNum ? 'bg-yellow-400 border-yellow-200 text-gray-900 scale-110' :
              'bg-gray-700 border-gray-500 text-white'}`}
          style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
          disabled={item.n < nextNum}>
          {item.n}
        </button>
      ))}
      <div className="absolute top-3 left-0 right-0 text-center">
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${wrong ? 'bg-red-500 text-white' : 'bg-black/50 text-white'}`}>
          {wrong ? '違います！' : `次: ${nextNum}`}
        </span>
      </div>
    </div>
  )
}

// ========================================
// 目と手の協調
// ========================================
function EyeHandGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [arrow, setArrow] = useState<'up' | 'down' | 'left' | 'right'>('up')
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null)
  const maxRounds = 15

  const nextArrow = useCallback(() => {
    const dirs: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right']
    setArrow(dirs[Math.floor(Math.random() * 4)])
  }, [])

  useEffect(() => { nextArrow() }, [nextArrow])

  const handleTap = (dir: 'up' | 'down' | 'left' | 'right') => {
    const correct = dir === arrow
    setFlash(correct ? 'correct' : 'wrong')
    if (correct) setScore(s => s + 1)
    setTotal(t => {
      const next = t + 1
      if (next >= maxRounds) {
        setTimeout(() => onComplete(correct ? score + 1 : score), 300)
      }
      return next
    })
    setTimeout(() => { setFlash(null); nextArrow() }, 400)
  }

  const arrowChar = { up: '↑', down: '↓', left: '←', right: '→' }
  const arrowRotation = { up: '0', down: '180', left: '-90', right: '90' }

  return (
    <div className="w-full">
      <div className="w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center mb-4 relative">
        <div className={`text-8xl font-black transition-all duration-200 ${
          flash === 'correct' ? 'text-green-400 scale-125' : flash === 'wrong' ? 'text-red-400 scale-90' : 'text-white'
        }`} style={{ transform: `rotate(${arrowRotation[arrow]}deg)` }}>
          ↑
        </div>
        <p className="absolute top-3 right-3 text-white/60 text-sm font-bold">{total}/{maxRounds}</p>
        <p className="absolute top-3 left-3 text-green-400 text-sm font-bold">正解 {score}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button onClick={() => handleTap('up')} className="bg-indigo-600 text-white text-2xl font-black py-4 rounded-xl active:scale-95 transition-transform">↑</button>
        <div />
        <button onClick={() => handleTap('left')} className="bg-indigo-600 text-white text-2xl font-black py-4 rounded-xl active:scale-95 transition-transform">←</button>
        <button onClick={() => handleTap('down')} className="bg-indigo-600 text-white text-2xl font-black py-4 rounded-xl active:scale-95 transition-transform">↓</button>
        <button onClick={() => handleTap('right')} className="bg-indigo-600 text-white text-2xl font-black py-4 rounded-xl active:scale-95 transition-transform">→</button>
      </div>
    </div>
  )
}

// ========================================
// 眼と首の分離
// ========================================
function NeckSeparation({ elapsed }: { elapsed: number }) {
  const cycle = 4
  const phase = (elapsed % cycle) / cycle
  let instruction = ''
  if (phase < 0.25) instruction = '← 首をゆっくり左へ'
  else if (phase < 0.5) instruction = '正面に戻す'
  else if (phase < 0.75) instruction = '首をゆっくり右へ →'
  else instruction = '正面に戻す'

  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center">
      <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-red-500/50 mb-8" />
      <div className="bg-black/50 rounded-xl px-6 py-3">
        <p className="text-white text-lg font-black text-center">{instruction}</p>
      </div>
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">赤い点から目を離さずに</p>
    </div>
  )
}

// ========================================
// メインコンポーネント
// ========================================
export default function TrainingPage() {
  const [exercises, setExercises] = useState<VisionExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<VisionExercise | null>(null)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [gameResult, setGameResult] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const pausedAtRef = useRef(0)

  // メトロノーム
  useMetronome(selected?.default_bpm ?? null, playing && !paused)

  // 種目一覧取得
  useEffect(() => {
    const supabase = createClient()
    supabase.from('vision_exercises').select('*').order('priority_order').then(({ data }) => {
      setExercises((data as VisionExercise[]) || [])
      setLoading(false)
    })
  }, [])

  // タイマー
  useEffect(() => {
    if (!playing || paused || !selected) return
    const isGameType = selected.name === 'ナンバータッチ' || selected.name === '目と手の協調トレーニング'
    if (isGameType) return // ゲーム系はタイマー不要

    const tick = () => {
      const now = performance.now()
      const e = (now - startRef.current) / 1000
      setElapsed(e)
      if (e >= selected.duration_sec) {
        setPlaying(false)
        setGameResult(-1) // 完了マーカー
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, paused, selected])

  const startExercise = (ex: VisionExercise) => {
    setSelected(ex)
    setPlaying(true)
    setPaused(false)
    setElapsed(0)
    setGameResult(null)
    startRef.current = performance.now()
  }

  const togglePause = () => {
    if (paused) {
      startRef.current += performance.now() - pausedAtRef.current
      setPaused(false)
    } else {
      pausedAtRef.current = performance.now()
      setPaused(true)
    }
  }

  const stopExercise = () => {
    setPlaying(false)
    setPaused(false)
    setElapsed(0)
    setGameResult(null)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const remaining = selected ? Math.max(0, selected.duration_sec - Math.floor(elapsed)) : 0
  const progress = selected ? Math.min(100, (elapsed / selected.duration_sec) * 100) : 0

  // ゲーム完了
  const handleGameComplete = (score: number) => {
    setPlaying(false)
    setGameResult(score)
  }

  // アニメーション描画
  const renderAnimation = () => {
    if (!selected) return null
    const name = selected.name
    const cat = selected.category

    if (name === 'ナンバータッチ') return <NumberTouchGame onComplete={handleGameComplete} />
    if (name === '目と手の協調トレーニング') return <EyeHandGame onComplete={handleGameComplete} />
    if (name === '眼と首の分離運動') return <NeckSeparation elapsed={elapsed} />
    if (cat === 'pursuit') return <PursuitAnimation elapsed={elapsed} duration={selected.duration_sec} />
    if (cat === 'saccade') return <SaccadeAnimation elapsed={elapsed} duration={selected.duration_sec} />
    if (cat === 'convergence') return <ConvergenceAnimation elapsed={elapsed} />
    if (cat === 'peripheral') return <PeripheralAnimation elapsed={elapsed} />
    // fixation系 / その他
    return <FixationAnimation />
  }

  // ========================================
  // プレイ中画面
  // ========================================
  if (playing && selected) {
    const isGameType = selected.name === 'ナンバータッチ' || selected.name === '目と手の協調トレーニング'
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/80">
          <button onClick={stopExercise} className="text-white/60 text-sm font-bold min-h-[44px] px-2">✕ 終了</button>
          <span className="text-white font-bold text-sm">{selected.name}</span>
          {!isGameType ? (
            <button onClick={togglePause} className="text-white/60 text-sm font-bold min-h-[44px] px-2">
              {paused ? '▶ 再開' : '⏸ 一時停止'}
            </button>
          ) : <div className="w-16" />}
        </div>

        {/* プログレスバー */}
        {!isGameType && (
          <div className="h-1 bg-gray-800">
            <div className="h-full bg-indigo-500 transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* アニメーション */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {paused ? (
            <div className="text-center">
              <p className="text-4xl text-white font-black mb-4">⏸</p>
              <p className="text-white/60 text-lg">一時停止中</p>
              <button onClick={togglePause} className="mt-6 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">再開する</button>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              {renderAnimation()}
            </div>
          )}
        </div>

        {/* タイマー表示 */}
        {!isGameType && !paused && (
          <div className="px-4 py-6 text-center">
            <p className="text-5xl font-black text-white tabular-nums">{remaining}<span className="text-lg text-white/40">秒</span></p>
            {selected.default_bpm && (
              <p className="text-sm text-white/40 mt-1">♪ {selected.default_bpm} BPM</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ========================================
  // 結果画面
  // ========================================
  if (gameResult !== null && selected) {
    const isGameType = selected.name === 'ナンバータッチ' || selected.name === '目と手の協調トレーニング'
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">完了！</h2>
          <p className="text-gray-500 mb-6">{selected.name}</p>

          {isGameType && (
            <div className="card mb-6">
              {selected.name === 'ナンバータッチ' ? (
                <div>
                  <p className="text-sm text-gray-500">クリアタイム</p>
                  <p className="text-4xl font-black text-indigo-600">{gameResult}<span className="text-lg">秒</span></p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">正解数</p>
                  <p className="text-4xl font-black text-indigo-600">{gameResult}<span className="text-lg">/15</span></p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => startExercise(selected)} className="btn-secondary flex-1">もう一度</button>
            <button onClick={() => { setSelected(null); setGameResult(null) }} className="btn-primary flex-1">種目選択に戻る</button>
          </div>
        </div>
      </div>
    )
  }

  // ========================================
  // 種目選択画面
  // ========================================
  return (
    <div className="min-h-screen bg-gray-50 has-bottom-nav">
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium min-h-[44px] flex items-center">← 戻る</Link>
          <span className="font-bold text-gray-900 text-sm">トレーニング</span>
          <div className="w-10" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <h1 className="text-xl font-black text-gray-900 mb-1">トレーニングを始める</h1>
        <p className="text-sm text-gray-500 mb-4">種目を選んでスタートしてください</p>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {exercises.map(ex => (
              <button key={ex.id} onClick={() => startExercise(ex)}
                className="card w-full text-left active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${CATEGORY_COLOR[ex.category]} rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0`}>
                    {ex.category === 'pursuit' ? '◎' :
                     ex.category === 'saccade' ? '⚡' :
                     ex.category === 'convergence' ? '◉' :
                     ex.category === 'peripheral' ? '👁' :
                     ex.category === 'coordination' ? '✋' :
                     ex.category === 'warmup' ? '🔄' :
                     ex.category === 'balance' ? '⚖' : '●'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <h3 className="font-bold text-sm text-gray-900">{ex.name}</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {CATEGORY_LABEL[ex.category]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{ex.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {ex.duration_sec}秒{ex.default_bpm ? ` / ${ex.default_bpm}BPM` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0">
                    START
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

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
          <Link href="/training" className="bottom-nav-item active">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="text-[10px] font-bold">実行</span>
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
