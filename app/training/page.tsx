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

const CATEGORY_ICON: Record<ExerciseCategory, string> = {
  pursuit: '◎', saccade: '⚡', convergence: '◉', peripheral: '👁',
  eye_stretch: '🔄', balance: '⚖', coordination: '✋', warmup: '🔄',
}

// ========================================
// 音声合成ユーティリティ
// ========================================
function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = 0.9
  u.pitch = 1.0
  window.speechSynthesis.speak(u)
}

function beep(freq = 880, duration = 0.08) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.value = 0.15
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), 200)
  } catch { /* silent fail */ }
}

// ========================================
// メトロノーム
// ========================================
function useMetronome(bpm: number | null, active: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!active || !bpm || bpm <= 0) return
    beep()
    intervalRef.current = setInterval(() => beep(), 60000 / bpm)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [bpm, active])
}

// ========================================
// 画面外トレーニング: 追従（ゆっくり追従 / 円追従）
// ========================================
function PursuitGuide({ elapsed, name }: { elapsed: number; name: string }) {
  const isCircle = name.includes('円')
  const cycle = isCircle ? 4 : 3

  // 円追従: 時計回り→反時計回り
  if (isCircle) {
    const round = Math.floor(elapsed / cycle)
    const phase = (elapsed % cycle) / cycle
    const directions = ['↑ 上', '→ 右', '↓ 下', '← 左']
    const dir = directions[Math.floor(phase * 4)]
    const clockwise = round % 2 === 0
    return (
      <div className="text-center">
        <p className="text-sm text-indigo-300 mb-2 font-bold">{clockwise ? '時計回り' : '反時計回り'} {round + 1}周目</p>
        <p className="text-6xl font-black text-white mb-4">{dir}</p>
        <p className="text-lg text-white/80">指先をゆっくり円を描くように動かし<br/>目だけで追ってください</p>
        <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
          <p className="text-sm text-white/60">💡 顔の前30cmに指を立て、大きな円を描く</p>
        </div>
      </div>
    )
  }

  // ゆっくり追従: 左右→上下→斜め
  const patterns = [
    { label: '← → 左右', desc: '指を左右にゆっくり動かす' },
    { label: '↑ ↓ 上下', desc: '指を上下にゆっくり動かす' },
    { label: '↗ ↙ 斜め', desc: '指を右上↔左下に動かす' },
    { label: '↖ ↘ 斜め', desc: '指を左上↔右下に動かす' },
  ]
  const patIdx = Math.floor(elapsed / (cycle * 2)) % patterns.length
  const pat = patterns[patIdx]
  const phase = (elapsed % cycle) / cycle
  const goingRight = phase < 0.5

  return (
    <div className="text-center">
      <p className="text-sm text-blue-300 mb-2 font-bold">パターン {patIdx + 1}/4</p>
      <p className="text-6xl font-black text-white mb-4">{pat.label}</p>
      <div className="w-full h-2 bg-white/20 rounded-full mb-4">
        <div className="h-full bg-blue-400 rounded-full transition-all duration-100"
          style={{ width: `${goingRight ? phase * 200 : (1 - phase) * 200}%`, maxWidth: '100%' }} />
      </div>
      <p className="text-lg text-white/80">{pat.desc}</p>
      <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
        <p className="text-sm text-white/60">💡 顔の前30cmに指を立て、頭は動かさず目だけで追う</p>
      </div>
    </div>
  )
}

// ========================================
// 画面外トレーニング: サッカード
// ========================================
function SaccadeGuide({ elapsed, name }: { elapsed: number; name: string }) {
  const isRandom = name.includes('ランダム')
  const cycle = 1.5
  const idx = Math.floor(elapsed / cycle)

  if (isRandom) {
    const targets = ['左上の角', '右下の角', '時計', '右上の角', 'ドアノブ', '左下の角', '自分の手', '正面の壁']
    const target = targets[idx % targets.length]
    return (
      <div className="text-center">
        <p className="text-sm text-orange-300 mb-2 font-bold">{idx + 1}回目</p>
        <p className="text-5xl font-black text-white mb-4">👀</p>
        <p className="text-3xl font-black text-yellow-400 mb-4">{target}</p>
        <p className="text-lg text-white/80">を素早く見てください！</p>
        <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
          <p className="text-sm text-white/60">💡 頭は動かさず、目だけでジャンプさせる</p>
        </div>
      </div>
    )
  }

  // 水平サッカード
  const isLeft = idx % 2 === 0
  return (
    <div className="text-center">
      <p className="text-sm text-orange-300 mb-2 font-bold">{idx + 1}回目</p>
      <p className="text-8xl font-black text-white mb-4">{isLeft ? '←' : '→'}</p>
      <p className="text-xl font-bold text-yellow-400 mb-2">{isLeft ? '左の指' : '右の指'}を見て！</p>
      <p className="text-white/60">ピッという音で切替</p>
      <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
        <p className="text-sm text-white/60">💡 両手を左右に広げて指を立て、音に合わせて素早く視線をジャンプ</p>
      </div>
    </div>
  )
}

// ========================================
// 画面外トレーニング: 輻輳（遠近切替）
// ========================================
function ConvergenceGuide({ elapsed, name }: { elapsed: number; name: string }) {
  const isJump = name.includes('ジャンプ')
  const cycle = isJump ? 2 : 3
  const phase = (elapsed % cycle) / cycle
  const isNear = phase < 0.5
  const count = Math.floor(elapsed / cycle) + 1

  return (
    <div className="text-center">
      <p className="text-sm text-purple-300 mb-2 font-bold">{count}回目</p>
      <div className={`mx-auto rounded-full border-4 border-white mb-6 transition-all duration-500 flex items-center justify-center ${
        isNear ? 'w-32 h-32 bg-purple-500' : 'w-12 h-12 bg-purple-300'
      }`}>
        <span className="text-white font-black text-lg">{isNear ? '近く' : '遠く'}</span>
      </div>
      <p className="text-2xl font-black text-white mb-2">
        {isNear ? '👆 親指を近づけて見る' : '🏔 遠くの壁を見る'}
      </p>
      <p className="text-white/60">{isNear ? '鼻先10cmまで近づける' : '部屋の一番遠い点を見る'}</p>
      <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
        <p className="text-sm text-white/60">💡 {isJump ? '素早く切替！' : 'ゆっくり切替。'}親指を顔の前に立てて使う</p>
      </div>
    </div>
  )
}

// ========================================
// 画面外トレーニング: 注視
// ========================================
function FixationGuide({ elapsed }: { elapsed: number }) {
  const tips = [
    'まばたきは自然にしてOK',
    '目だけ動かさずじっと見る',
    '意識を点に集中する',
    'リラックスして見つめる',
  ]
  const tipIdx = Math.floor(elapsed / 3) % tips.length

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-red-500 rounded-full border-4 border-white shadow-lg shadow-red-500/50 mx-auto mb-6" />
      <p className="text-2xl font-black text-white mb-2">壁の一点をじっと見つめる</p>
      <p className="text-white/60 mb-6">目の前の壁にシールや点を貼り、そこを見つめ続ける</p>
      <p className="text-sm text-green-400 font-bold">{tips[tipIdx]}</p>
    </div>
  )
}

// ========================================
// 画面外トレーニング: 周辺視野
// ========================================
function PeripheralGuide({ elapsed }: { elapsed: number }) {
  const cycle = 3
  const directions = ['右側', '左側', '上側', '下側', '右上', '左下', '左上', '右下']
  const idx = Math.floor(elapsed / cycle) % directions.length
  const dir = directions[idx]

  return (
    <div className="text-center">
      <p className="text-sm text-green-300 mb-2 font-bold">{idx + 1}/8方向</p>
      <div className="w-12 h-12 bg-red-500 rounded-full border-2 border-white mx-auto mb-4" />
      <p className="text-lg text-white/60 mb-2">正面を見たまま…</p>
      <p className="text-4xl font-black text-cyan-400 mb-4">「{dir}」に注意を向ける</p>
      <p className="text-white/60">視線は中央、意識だけを{dir}に広げる</p>
      <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
        <p className="text-sm text-white/60">💡 誰かに{dir}で指を動かしてもらい「何本？」と答える練習も効果的</p>
      </div>
    </div>
  )
}

// ========================================
// 画面外: デジタルストリング（ブロックストリング代替）
// ========================================
function DigitalStringGuide({ elapsed }: { elapsed: number }) {
  const cycle = 4
  const beadIdx = Math.floor(elapsed / cycle) % 3
  const beads = ['手前のビーズ（30cm）', '中間のビーズ（60cm）', '奥のビーズ（1m）']

  return (
    <div className="text-center">
      <p className="text-sm text-purple-300 mb-2 font-bold">ブロックストリング</p>
      <div className="flex items-center justify-center gap-4 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className={`rounded-full border-2 transition-all duration-500 ${
            i === beadIdx ? 'w-10 h-10 bg-purple-500 border-white scale-125' : 'w-6 h-6 bg-gray-600 border-gray-400'
          }`} />
        ))}
      </div>
      <p className="text-2xl font-black text-white mb-2">{beads[beadIdx]}を見る</p>
      <p className="text-white/60 mb-4">紐が「X字」に見えれば両眼が使えています</p>
      <div className="mt-4 bg-white/10 rounded-xl p-4 text-left space-y-2">
        <p className="text-sm text-white/60">💡 1mの紐にビーズを3個通し、鼻先から伸ばす</p>
        <p className="text-sm text-white/60">💡 紐がなければ、3つの指を前後に並べて代用</p>
      </div>
    </div>
  )
}

// ========================================
// 画面外: バランス連動
// ========================================
function BalanceGuide({ elapsed }: { elapsed: number }) {
  const phases = [
    { t: 10, label: '片足立ち＋正面注視', desc: '片足で立ち、壁の一点を見つめる' },
    { t: 20, label: '片足立ち＋追従', desc: '片足のまま、指先をゆっくり左右に動かして目で追う' },
    { t: 40, label: '片足立ち＋閉眼', desc: '目を閉じてバランスを保つ（10秒）' },
    { t: 50, label: '反対の足で片足立ち＋注視', desc: '足を替えて壁の一点を見つめる' },
    { t: 60, label: '完了', desc: 'お疲れ様でした' },
  ]
  const phase = phases.find(p => elapsed < p.t) || phases[phases.length - 1]

  return (
    <div className="text-center">
      <p className="text-5xl mb-4">🧘</p>
      <p className="text-2xl font-black text-white mb-2">{phase.label}</p>
      <p className="text-lg text-white/80">{phase.desc}</p>
      <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
        <p className="text-sm text-white/60">💡 ふらついたら壁に手をつく。安全第一で</p>
      </div>
    </div>
  )
}

// ========================================
// 画面外: 眼と首の分離
// ========================================
function NeckSeparationGuide({ elapsed }: { elapsed: number }) {
  const cycle = 4
  const phase = (elapsed % cycle) / cycle
  let instruction = ''
  let icon = ''
  if (phase < 0.25) { instruction = '首をゆっくり左へ'; icon = '←' }
  else if (phase < 0.5) { instruction = '正面に戻す'; icon = '●' }
  else if (phase < 0.75) { instruction = '首をゆっくり右へ'; icon = '→' }
  else { instruction = '正面に戻す'; icon = '●' }

  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-red-500/50 mx-auto mb-6" />
      <p className="text-6xl font-black text-white mb-4">{icon}</p>
      <p className="text-2xl font-black text-white mb-2">{instruction}</p>
      <p className="text-white/60">赤い点（壁の一点）から目を離さず</p>
      <div className="mt-6 bg-white/10 rounded-xl p-4 text-left">
        <p className="text-sm text-white/60">💡 壁にシールを貼り、それを見つめたまま首だけ動かす</p>
      </div>
    </div>
  )
}

// ========================================
// 画面上トレーニング: ナンバータッチ
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
        x = 10 + Math.random() * 80
        y = 10 + Math.random() * 80
        ok = nums.every(n => Math.hypot(n.x - x, n.y - y) > 14)
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
    <div>
      <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden">
        {numbers.map(item => (
          <button key={item.n} onClick={() => handleTap(item.n)}
            className={`absolute w-11 h-11 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all
              ${item.n < nextNum ? 'bg-green-500/30 border-green-500/30 text-green-300 scale-75' :
                item.n === nextNum ? 'bg-yellow-400 border-yellow-200 text-gray-900 scale-110 shadow-lg shadow-yellow-400/30' :
                'bg-gray-700 border-gray-500 text-white active:scale-95'}`}
            style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
            disabled={item.n < nextNum}>
            {item.n}
          </button>
        ))}
        <div className="absolute top-3 left-0 right-0 text-center">
          <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${wrong ? 'bg-red-500 text-white' : 'bg-black/60 text-white'}`}>
            {wrong ? '違います！' : `次: ${nextNum}`}
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-white/40 mt-2">頭を動かさず、目だけで数字を探す</p>
    </div>
  )
}

// ========================================
// 画面上トレーニング: 目と手の協調
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
    const newScore = correct ? score + 1 : score
    if (correct) setScore(newScore)
    const newTotal = total + 1
    setTotal(newTotal)
    if (newTotal >= maxRounds) {
      setTimeout(() => onComplete(newScore), 300)
      return
    }
    setTimeout(() => { setFlash(null); nextArrow() }, 400)
  }

  const arrowRotation = { up: '0', down: '180', left: '-90', right: '90' }

  return (
    <div className="w-full">
      <div className="w-full aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center mb-4 relative">
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
  const lastBeepRef = useRef(0)

  // メトロノーム（サッカード系に使用）
  useMetronome(selected?.default_bpm ?? null, playing && !paused)

  // サッカードの切替ビープ
  useEffect(() => {
    if (!playing || paused || !selected) return
    if (selected.category !== 'saccade' || selected.name === 'ナンバータッチ') return
    const cycle = selected.name.includes('ランダム') ? 1.5 : 1.5
    const currentIdx = Math.floor(elapsed / cycle)
    if (currentIdx !== lastBeepRef.current) {
      lastBeepRef.current = currentIdx
      beep(660, 0.1)
      // 音声で方向を読み上げ（水平サッカード）
      if (!selected.name.includes('ランダム')) {
        speak(currentIdx % 2 === 0 ? '左' : '右')
      }
    }
  }, [elapsed, playing, paused, selected])

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
    if (isGameType) return

    const tick = () => {
      const now = performance.now()
      const e = (now - startRef.current) / 1000
      setElapsed(e)
      if (e >= selected.duration_sec) {
        setPlaying(false)
        setGameResult(-1) // 完了マーカー
        beep(440, 0.3)
        speak('終了です。お疲れ様でした')
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
    lastBeepRef.current = -1
    startRef.current = performance.now()
    // 開始アナウンス
    setTimeout(() => speak(`${ex.name}を始めます`), 300)
  }

  const togglePause = () => {
    if (paused) {
      startRef.current += performance.now() - pausedAtRef.current
      setPaused(false)
    } else {
      pausedAtRef.current = performance.now()
      setPaused(true)
      window.speechSynthesis?.cancel()
    }
  }

  const stopExercise = () => {
    setPlaying(false)
    setPaused(false)
    setElapsed(0)
    setGameResult(null)
    window.speechSynthesis?.cancel()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const remaining = selected ? Math.max(0, selected.duration_sec - Math.floor(elapsed)) : 0
  const progress = selected ? Math.min(100, (elapsed / selected.duration_sec) * 100) : 0

  const handleGameComplete = (score: number) => {
    setPlaying(false)
    setGameResult(score)
    beep(440, 0.3)
  }

  // アニメーション/ガイド描画
  const renderGuide = () => {
    if (!selected) return null
    const name = selected.name

    // 画面上ゲーム系
    if (name === 'ナンバータッチ') return <NumberTouchGame onComplete={handleGameComplete} />
    if (name === '目と手の協調トレーニング') return <EyeHandGame onComplete={handleGameComplete} />

    // 画面外ガイド系
    if (name === '眼と首の分離運動') return <NeckSeparationGuide elapsed={elapsed} />
    if (name.includes('デジタルストリング')) return <DigitalStringGuide elapsed={elapsed} />
    if (name.includes('バランス')) return <BalanceGuide elapsed={elapsed} />
    if (name.includes('注視')) return <FixationGuide elapsed={elapsed} />
    if (name.includes('周辺視野')) return <PeripheralGuide elapsed={elapsed} />

    if (selected.category === 'pursuit') return <PursuitGuide elapsed={elapsed} name={name} />
    if (selected.category === 'saccade') return <SaccadeGuide elapsed={elapsed} name={name} />
    if (selected.category === 'convergence') return <ConvergenceGuide elapsed={elapsed} name={name} />

    // その他: 汎用ガイド
    return <FixationGuide elapsed={elapsed} />
  }

  // ========================================
  // プレイ中画面
  // ========================================
  if (playing && selected) {
    const isGameType = selected.name === 'ナンバータッチ' || selected.name === '目と手の協調トレーニング'
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col safe-area-inset">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={stopExercise} className="text-white/60 text-sm font-bold min-h-[44px] px-2">✕ 終了</button>
          <span className="text-white font-bold text-sm">{selected.name}</span>
          {!isGameType ? (
            <button onClick={togglePause} className="text-white/60 text-sm font-bold min-h-[44px] px-2">
              {paused ? '▶ 再開' : '⏸ 停止'}
            </button>
          ) : <div className="w-16" />}
        </div>

        {/* プログレスバー */}
        {!isGameType && (
          <div className="h-1.5 bg-gray-800 mx-4 rounded-full">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {paused ? (
            <div className="text-center">
              <p className="text-5xl mb-4">⏸</p>
              <p className="text-white/60 text-lg mb-6">一時停止中</p>
              <button onClick={togglePause} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg">再開する</button>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              {renderGuide()}
            </div>
          )}
        </div>

        {/* タイマー表示 */}
        {!isGameType && !paused && (
          <div className="px-4 py-6 text-center">
            <p className="text-6xl font-black text-white tabular-nums">{remaining}<span className="text-xl text-white/40">秒</span></p>
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

          {!isGameType && (
            <div className="card mb-6">
              <p className="text-sm text-gray-500">トレーニング時間</p>
              <p className="text-3xl font-black text-indigo-600">{selected.duration_sec}<span className="text-lg">秒</span></p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => startExercise(selected)} className="btn-secondary flex-1">もう一度</button>
            <button onClick={() => { setSelected(null); setGameResult(null) }} className="btn-primary flex-1">種目選択へ</button>
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
        <p className="text-sm text-gray-500 mb-4">種目を選んでスタート。画面の指示に従って目を動かしましょう。</p>

        {/* 注意書き */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-800 font-bold mb-1">💡 効果的なトレーニングのために</p>
          <p className="text-xs text-blue-600">多くの種目は<strong>画面の外</strong>（壁・指・ペン）を使います。画面は指示とタイマーの役割です。</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {exercises.map(ex => {
              const isScreen = ex.name === 'ナンバータッチ' || ex.name === '目と手の協調トレーニング'
              return (
                <button key={ex.id} onClick={() => startExercise(ex)}
                  className="card w-full text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${CATEGORY_COLOR[ex.category]} rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0`}>
                      {CATEGORY_ICON[ex.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-sm text-gray-900">{ex.name}</h3>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {CATEGORY_LABEL[ex.category]}
                        </span>
                        {isScreen && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">画面操作</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">{ex.description}</p>
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
              )
            })}
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
