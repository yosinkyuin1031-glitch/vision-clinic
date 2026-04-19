'use client'
import { useState, useRef, useEffect, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase-browser'
import { useClinicId } from '@/lib/use-clinic'
import type {
  Patient,
  VisionChecklist30,
  CheckAnswer,
  EyeTrackingData,
  VisionAIAnalysis,
  VisionExercise,
  CameraEvaluation,
  CameraEvalItem,
  FunctionLevel,
  TrainingMode,
} from '@/types'
import {
  getFaceLandmarker,
  extractEyeFrame,
  evaluateConvergence,
  evaluateConvergenceItem,
  evaluateDivergenceItem,
  evaluateFixationItem,
  evaluatePursuitItem,
  evaluateSaccadeItem,
  evaluateBlinkItem,
  evaluateHeadCompensationItem,
  buildCameraEvaluation,
  levelLabel,
  levelColor,
  type EyeFrame,
  type PursuitFrame,
  type SaccadeTrialResult,
} from '@/lib/eye-tracking'

// ========================================
// 型・定数
// ========================================

type Step = 'select_patient' | 'checklist' | 'camera_test' | 'analyzing' | 'result'
type CameraPhase = 'ready' | 'fixation' | 'convergence_base' | 'convergence_near' | 'pursuit' | 'saccade' | 'done'

const STEPS: Step[] = ['select_patient', 'checklist', 'camera_test']
const STEP_LABELS = ['患者選択', 'セルフチェック', 'カメラ評価']

const INIT_CHECKLIST: VisionChecklist30 = {
  a: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  b: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  c: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  note: '',
}

const CHECKLIST_A = [
  'スマホや本で目が疲れやすい',
  '長く読むと文字がぼやける',
  '行を見失う',
  '夕方になると見えにくい',
  '目の奥が重い',
  '目を閉じると楽になる',
  '集中力が続かない',
  'まぶしさを感じやすい',
  '画面を見ると眠くなる',
  '目を細めて見る',
]

const CHECKLIST_B = [
  '物が二重に見える',
  '距離感がつかみにくい',
  '階段が怖い',
  'ボールを取るのが苦手',
  '物にぶつかりやすい',
  '片目を閉じると楽',
  '長く見ると片目を閉じたくなる',
  '近く→遠くの切替が遅い',
  '運転で距離感に不安',
  '片方の目だけ疲れる',
]

const CHECKLIST_C = [
  '首や肩がこる',
  '頭痛がある',
  '姿勢が悪いと言われる',
  '体が左右どちらかに傾く',
  '長く座ると体が曲がる',
  'バランスを崩しやすい',
  '疲れると体が片側に寄る',
  'まっすぐ立てていない気がする',
  '乗り物酔いしやすい',
  '検査では異常がないが不調がある',
]

const ANSWER_LABELS: Record<CheckAnswer, string> = { 0: 'いいえ', 1: 'ときどき', 2: 'はい' }
const ANSWER_COLORS: Record<CheckAnswer, string> = {
  0: 'border-gray-200 bg-white text-gray-600',
  1: 'border-yellow-400 bg-yellow-50 text-yellow-800',
  2: 'border-indigo-400 bg-indigo-50 text-indigo-800',
}

// ========================================
// メインコンポーネント
// ========================================

function AnalyzeContent() {
  const searchParams = useSearchParams()
  const { clinicId } = useClinicId()
  const [step, setStep] = useState<Step>('select_patient')

  // 患者
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoaded, setPatientsLoaded] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)

  // チェックリスト
  const [checklist, setChecklist] = useState<VisionChecklist30>({ ...INIT_CHECKLIST })
  const [checklistCategory, setChecklistCategory] = useState<'a' | 'b' | 'c'>('a')

  // カメラ
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [liveFrame, setLiveFrame] = useState<EyeFrame | null>(null)

  // カメラテストフェーズ
  const [cameraPhase, setCameraPhase] = useState<CameraPhase>('ready')
  const [phaseTimer, setPhaseTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // カメラ評価データ
  const [baseFrame, setBaseFrame] = useState<EyeFrame | null>(null)
  const [nearFrame, setNearFrame] = useState<EyeFrame | null>(null)
  const fixationFramesRef = useRef<EyeFrame[]>([])
  const pursuitFramesRef = useRef<PursuitFrame[]>([])
  const saccadeTrialsRef = useRef<SaccadeTrialResult[]>([])
  const allFramesRef = useRef<EyeFrame[]>([]) // blink + head comp用
  const testStartTimeRef = useRef(0)
  const [cameraEval, setCameraEval] = useState<CameraEvaluation | null>(null)

  // 追従ターゲット
  const [pursuitTarget, setPursuitTarget] = useState({ x: 50, y: 50 })
  const pursuitStartRef = useRef(0)

  // サッカードターゲット
  const [saccadeTarget, setSaccadeTarget] = useState<{ x: number; y: number } | null>(null)
  const [saccadeCount, setSaccadeCount] = useState(0)
  const saccadeStartRef = useRef(0)

  // 治療家メモ
  const [therapistNote, setTherapistNote] = useState('')

  // 結果
  const [result, setResult] = useState<{
    aiAnalysis: VisionAIAnalysis
    exercises: VisionExercise[]
  } | null>(null)
  const [error, setError] = useState('')

  // ========================================
  // 患者ロード
  // ========================================
  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      const { data } = await sb.from('vc_patients').select('*').order('created_at', { ascending: false })
      const list = (data as Patient[]) || []
      setPatients(list)
      setPatientsLoaded(true)
      const pid = searchParams.get('patient_id')
      if (pid) {
        const found = list.find(p => p.id === pid)
        if (found) { setPatient(found); setStep('checklist') }
      }
    }
    load()
  }, [searchParams])

  // ========================================
  // カメラ起動/停止
  // ========================================
  const startCamera = useCallback(async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
      const lm = await getFaceLandmarker()
      const loop = () => {
        if (!videoRef.current || !streamRef.current) return
        const ef = extractEyeFrame(lm, videoRef.current, performance.now())
        if (ef) {
          setLiveFrame(ef)
          allFramesRef.current.push(ef)
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'カメラ起動に失敗しました'
      setCameraError(msg.includes('Permission') || msg.includes('denied')
        ? 'カメラの使用が許可されていません。ブラウザの設定を確認してください。'
        : msg)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => { return () => stopCamera() }, [stopCamera])

  useEffect(() => {
    if (step === 'camera_test') {
      startCamera()
      allFramesRef.current = []
      testStartTimeRef.current = performance.now()
    } else {
      stopCamera()
    }
  }, [step, startCamera, stopCamera])

  // ========================================
  // カメラテストフェーズ管理
  // ========================================

  // 注視テスト開始（10秒）
  const startFixationTest = useCallback(() => {
    setCameraPhase('fixation')
    fixationFramesRef.current = []
    setPhaseTimer(10)
    const start = performance.now()
    const id = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000
      const remaining = Math.max(0, 10 - Math.floor(elapsed))
      setPhaseTimer(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        setCameraPhase('convergence_base')
      }
    }, 200)
    timerRef.current = id
  }, [])

  // 注視テスト中のフレーム収集
  useEffect(() => {
    if (cameraPhase === 'fixation' && liveFrame) {
      fixationFramesRef.current.push(liveFrame)
    }
  }, [cameraPhase, liveFrame])

  // 輻輳テスト: 基準フレーム撮影
  const captureBase = useCallback(() => {
    if (liveFrame) {
      setBaseFrame(liveFrame)
      setCameraPhase('convergence_near')
    }
  }, [liveFrame])

  // 輻輳テスト: 近点フレーム撮影 → 追従テストへ
  const captureNear = useCallback(() => {
    if (liveFrame) {
      setNearFrame(liveFrame)
      // 追従テストへ
      startPursuitTest()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFrame])

  // 追従テスト（8秒）
  const startPursuitTest = useCallback(() => {
    setCameraPhase('pursuit')
    pursuitFramesRef.current = []
    pursuitStartRef.current = performance.now()
    setPhaseTimer(8)

    const id = setInterval(() => {
      const elapsed = (performance.now() - pursuitStartRef.current) / 1000
      const remaining = Math.max(0, 8 - Math.floor(elapsed))
      setPhaseTimer(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        startSaccadeTest()
      }
    }, 200)
    timerRef.current = id
  }, [])

  // 追従ターゲット移動（円運動）
  useEffect(() => {
    if (cameraPhase !== 'pursuit') return
    const animId = setInterval(() => {
      const elapsed = (performance.now() - pursuitStartRef.current) / 1000
      const angle = (elapsed / 8) * Math.PI * 2 * 2 // 2周
      const x = 50 + Math.cos(angle) * 30
      const y = 50 + Math.sin(angle) * 20
      setPursuitTarget({ x, y })
    }, 50)
    return () => clearInterval(animId)
  }, [cameraPhase])

  // 追従フレーム収集
  useEffect(() => {
    if (cameraPhase === 'pursuit' && liveFrame) {
      const videoW = videoRef.current?.videoWidth || 1280
      const videoH = videoRef.current?.videoHeight || 720
      pursuitFramesRef.current.push({
        eyeFrame: liveFrame,
        targetX: (pursuitTarget.x / 100) * videoW,
        targetY: (pursuitTarget.y / 100) * videoH,
      })
    }
  }, [cameraPhase, liveFrame, pursuitTarget])

  // サッカードのターゲット位置（左右中心に8箇所）
  const saccadePositions = useRef([
    { x: 15, y: 50 }, { x: 85, y: 50 },  // 左→右
    { x: 20, y: 30 }, { x: 80, y: 70 },  // 左上→右下
    { x: 85, y: 35 }, { x: 15, y: 65 },  // 右上→左下
    { x: 20, y: 50 }, { x: 80, y: 50 },  // 左→右
  ]).current

  // サッカードテスト
  const showNextSaccadeTargetRef = useRef<() => void>(() => {})

  const startSaccadeTest = useCallback(() => {
    setCameraPhase('saccade')
    saccadeTrialsRef.current = []
    saccadeIrisStartRef.current = null
    setSaccadeCount(0)
    // 最初のターゲットを表示
    setSaccadeTarget(saccadePositions[0])
    saccadeStartRef.current = performance.now()
    setSaccadeCount(1)
  }, [saccadePositions])

  // showNextSaccadeTargetをrefで管理（依存関係の問題を回避）
  showNextSaccadeTargetRef.current = () => {
    const idx = saccadeTrialsRef.current.length
    if (idx >= 8) {
      finishCameraTest()
      return
    }
    setSaccadeTarget(saccadePositions[idx])
    saccadeStartRef.current = performance.now()
    setSaccadeCount(idx + 1)
  }

  // サッカード用: ターゲット出現時の虹彩位置を記録
  const saccadeIrisStartRef = useRef<{ x: number; y: number } | null>(null)

  // サッカード応答（虹彩の移動量で判定）
  useEffect(() => {
    if (cameraPhase !== 'saccade' || !saccadeTarget || !liveFrame) return

    const elapsed = performance.now() - saccadeStartRef.current
    if (elapsed < 200) return // 最低200ms待つ

    // 眼窩内の相対虹彩位置（頭部移動の影響を除去）
    const eyeCX = (liveFrame.rightEyeOuter.x + liveFrame.leftEyeOuter.x) / 2
    const eyeCY = (liveFrame.rightEyeOuter.y + liveFrame.leftEyeOuter.y) / 2
    const irisMidX = (liveFrame.rightIris.x + liveFrame.leftIris.x) / 2
    const irisMidY = (liveFrame.rightIris.y + liveFrame.leftIris.y) / 2
    const relIrisX = irisMidX - eyeCX
    const relIrisY = irisMidY - eyeCY

    // 初回フレーム: 開始位置を記録
    if (!saccadeIrisStartRef.current) {
      saccadeIrisStartRef.current = { x: relIrisX, y: relIrisY }
    }

    // 虹彩の移動量（開始位置からの変化）
    const irisDist = Math.hypot(
      relIrisX - saccadeIrisStartRef.current.x,
      relIrisY - saccadeIrisStartRef.current.y,
    )
    const eyeWidth = liveFrame.eyeWidthPx || 200
    const relMove = irisDist / eyeWidth

    // 虹彩が眼幅の2%以上動いた or 1.5秒経過で次へ
    const reached = relMove > 0.02
    if (elapsed > 1500 || (elapsed > 300 && reached)) {
      saccadeTrialsRef.current.push({
        reactionMs: elapsed,
        overshootPx: irisDist,
        targetReached: reached,
      })
      saccadeIrisStartRef.current = null // 次のターゲット用にリセット
      setTimeout(() => showNextSaccadeTargetRef.current(), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPhase, liveFrame, saccadeTarget])

  // テスト完了→評価計算
  const finishCameraTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null

    const testDuration = performance.now() - testStartTimeRef.current
    const frames = allFramesRef.current

    // 各項目の評価
    const convergenceItem = baseFrame && nearFrame
      ? evaluateConvergenceItem(baseFrame, nearFrame)
      : { score: 50, level: 'mild' as FunctionLevel, rawValue: 0, unit: 'mm', details: '測定スキップ' }

    const divergenceItem = nearFrame && baseFrame
      ? evaluateDivergenceItem(nearFrame, baseFrame)
      : { score: 50, level: 'mild' as FunctionLevel, rawValue: 0, unit: 'mm', details: '測定スキップ' }

    const fixationItem = evaluateFixationItem(fixationFramesRef.current, 10000)
    const pursuitItem = evaluatePursuitItem(pursuitFramesRef.current)
    const saccadeItem = evaluateSaccadeItem(saccadeTrialsRef.current)
    const blinkItem = evaluateBlinkItem(frames, testDuration)
    const headCompItem = evaluateHeadCompensationItem(frames)

    const evaluation = buildCameraEvaluation({
      convergence: convergenceItem,
      divergence: divergenceItem,
      fixation: fixationItem,
      pursuit: pursuitItem,
      saccade: saccadeItem,
      blink: blinkItem,
      headCompensation: headCompItem,
    })

    setCameraEval(evaluation)
    setCameraPhase('done')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFrame, nearFrame])

  // ========================================
  // 分析
  // ========================================
  const analyze = async () => {
    if (!patient) return
    setStep('analyzing')
    setError('')
    try {
      const eye_data: EyeTrackingData = {
        leftIrisDisplacementMm: 0,
        rightIrisDisplacementMm: 0,
        asymmetryRatio: 0,
        nearPointCm: null,
        focusHoldAtApex: true,
        pursuit_smoothness: '',
        saccade_accuracy: '',
        therapist_note: therapistNote,
        cameraEval: cameraEval || undefined,
      }
      if (baseFrame && nearFrame) {
        const c = evaluateConvergence(baseFrame, nearFrame)
        eye_data.leftIrisDisplacementMm = c.leftIrisDisplacementMm
        eye_data.rightIrisDisplacementMm = c.rightIrisDisplacementMm
        eye_data.asymmetryRatio = c.asymmetryRatio
      }

      const body: Record<string, unknown> = {
        patient_id: patient.id,
        eye_data,
        checklist,
        patient_age: patient.age,
        patient_gender: patient.gender,
        occupation: patient.occupation,
        age_group: patient.age_group,
      }
      if (clinicId) body.clinic_id = clinicId

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '分析に失敗しました')
      setResult({ aiAnalysis: json.data.ai_analysis, exercises: json.data.exercises })
      setStep('result')
    } catch (e) {
      const msg = (e instanceof Error ? e.message : '').toLowerCase()
      const isApiKeyError = msg.includes('api-key') || msg.includes('authentication') || msg.includes('401')
      setError(isApiKeyError ? '分析処理に失敗しました。もう一度お試しください。' : (e instanceof Error ? e.message : '分析に失敗しました'))
      setStep('camera_test')
    }
  }

  const currentStepIndex = STEPS.indexOf(step)

  // チェックリストスコア計算
  const clScoreA = checklist.a.reduce<number>((s, v) => s + v, 0)
  const clScoreB = checklist.b.reduce<number>((s, v) => s + v, 0)
  const clScoreC = checklist.c.reduce<number>((s, v) => s + v, 0)
  const clTotal = clScoreA + clScoreB + clScoreC

  return (
    <>
      {/* プログレス */}
      {!['result', 'analyzing'].includes(step) && (
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === s ? 'bg-indigo-600 text-white' : currentStepIndex > i ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</div>
                <span className={`text-xs whitespace-nowrap ${step === s ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>{STEP_LABELS[i]}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mb-4 ${currentStepIndex > i ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* ======== STEP1: 患者選択 ======== */}
      {step === 'select_patient' && (
        <div>
          <h1 className="text-2xl font-black mb-2">患者を選択</h1>
          <p className="text-gray-500 mb-6">視機能評価を行う患者さんを選んでください</p>

          {!patientsLoaded && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {patientsLoaded && patients.length === 0 && (
            <div className="card text-center py-10 mb-6">
              <p className="text-gray-400 mb-3">まだ患者が登録されていません</p>
              <Link href="/patients/new" className="btn-primary inline-block text-sm">+ 患者を登録する</Link>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {patients.map(p => (
              <button key={p.id} onClick={() => setPatient(p)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${patient?.id === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">{p.name}</p>
                    <p className="text-sm text-gray-500">
                      {p.age ? `${p.age}歳` : '年齢未登録'} / {p.gender === 'male' ? '男性' : p.gender === 'female' ? '女性' : '未設定'}
                      {p.occupation ? ` / ${p.occupation}` : ''}
                    </p>
                  </div>
                  {patient?.id === p.id && <span className="badge-blue">選択中</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Link href="/patients/new" className="btn-secondary flex-1 text-center">+ 新規患者登録</Link>
            <button onClick={() => setStep('checklist')} disabled={!patient} className="btn-primary flex-1 disabled:opacity-40">次へ →</button>
          </div>
          <button onClick={() => { if (patient) setStep('camera_test') }}
            disabled={!patient}
            className="w-full mt-3 text-sm text-gray-400 py-2 hover:text-indigo-500 transition-colors disabled:opacity-30">
            カメラ評価だけテスト →
          </button>
        </div>
      )}

      {/* ======== STEP2: 30項目チェックリスト ======== */}
      {step === 'checklist' && (
        <div>
          <h1 id="checklist-top" className="text-2xl font-black mb-2">セルフチェック（30項目）</h1>
          <p className="text-gray-500 mb-4">
            <span className="font-bold text-gray-900">{patient?.name}</span> さんに当てはまるものを選択してください
          </p>

          {/* カテゴリ切替タブ */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
            {([['a', 'A: 視覚疲労'], ['b', 'B: 両眼協調'], ['c', 'C: 姿勢連動']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setChecklistCategory(key)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  checklistCategory === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
                }`}>
                {label}
                <span className="ml-1 text-xs">
                  ({checklist[key].reduce<number>((s, v) => s + v, 0)}/20)
                </span>
              </button>
            ))}
          </div>

          {/* 質問一覧 */}
          <div className="space-y-3 mb-4">
            {(checklistCategory === 'a' ? CHECKLIST_A : checklistCategory === 'b' ? CHECKLIST_B : CHECKLIST_C).map((q, idx) => (
              <div key={idx} className="card !p-4">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  <span className="text-indigo-500 font-bold mr-1">{idx + 1}.</span>{q}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([0, 1, 2] as CheckAnswer[]).map(val => (
                    <button key={val} onClick={() => {
                      setChecklist(prev => {
                        const arr = [...prev[checklistCategory]] as VisionChecklist30['a']
                        arr[idx] = val
                        return { ...prev, [checklistCategory]: arr }
                      })
                    }}
                      className={`py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                        checklist[checklistCategory][idx] === val
                          ? ANSWER_COLORS[val]
                          : 'border-gray-100 bg-gray-50 text-gray-400'
                      }`}>
                      {ANSWER_LABELS[val]}
                      <span className="block text-xs font-normal mt-0.5">{val}点</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* スコアサマリー */}
          <div className="card-blue mb-4">
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div><p className="text-xs text-gray-500">A 疲労</p><p className="font-bold text-lg">{clScoreA}</p></div>
              <div><p className="text-xs text-gray-500">B 協調</p><p className="font-bold text-lg">{clScoreB}</p></div>
              <div><p className="text-xs text-gray-500">C 姿勢</p><p className="font-bold text-lg">{clScoreC}</p></div>
              <div><p className="text-xs text-gray-500">合計</p><p className="font-black text-lg text-indigo-600">{clTotal}/60</p></div>
            </div>
          </div>

          {/* メモ */}
          <div className="card mb-6">
            <label className="label">メモ（任意）</label>
            <textarea rows={2}
              placeholder="例: 読書が苦手、PC作業6時間、野球の捕球で苦戦など"
              value={checklist.note}
              onChange={e => setChecklist(c => ({ ...c, note: e.target.value }))}
              className="input resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('select_patient')} className="btn-secondary">← 戻る</button>
            {checklistCategory !== 'c' ? (
              <button onClick={() => {
                setChecklistCategory(checklistCategory === 'a' ? 'b' : 'c')
                requestAnimationFrame(() => {
                  const el = document.getElementById('checklist-top')
                  if (el) {
                    el.scrollIntoView({ behavior: 'instant', block: 'start' })
                  }
                })
              }} className="btn-primary flex-1">
                {checklistCategory === 'a' ? 'B: 両眼協調へ →' : 'C: 姿勢連動へ →'}
              </button>
            ) : (
              <button onClick={() => setStep('camera_test')} className="btn-primary flex-1">カメラ評価へ →</button>
            )}
          </div>
          <button onClick={() => setStep('camera_test')}
            className="w-full mt-3 text-sm text-gray-400 py-2 hover:text-indigo-500 transition-colors">
            チェックリストをスキップしてカメラ評価へ →
          </button>
        </div>
      )}

      {/* ======== STEP3: カメラ7項目全自動評価 ======== */}
      {step === 'camera_test' && (
        <div>
          <h1 className="text-2xl font-black mb-2">カメラ評価（7項目自動測定）</h1>
          <p className="text-gray-500 mb-4">画面の指示に従って目を動かしてください。自動で7項目を測定します。</p>

          {cameraError && (
            <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl p-4 mb-4 text-sm">
              {cameraError}
              <button onClick={startCamera} className="ml-2 underline font-medium">再試行</button>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl p-4 mb-4 text-sm font-medium">{error}</div>}

          {/* カメラプレビュー */}
          <div className="relative bg-black rounded-2xl overflow-hidden mb-3 aspect-[3/4]">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {liveFrame && cameraReady && cameraPhase === 'ready' && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-green-400 text-xs rounded px-2 py-1 font-bold">
                顔検出OK
              </div>
            )}

            {/* 注視テスト: 中央の赤い点のみ（テキストなし） */}
            {cameraPhase === 'fixation' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 bg-red-500 rounded-full shadow-lg shadow-red-500/50 border-2 border-white" />
              </div>
            )}

            {/* 輻輳テスト: 画面上の点（遠く=小さい / 近く=大きい） */}
            {cameraPhase === 'convergence_base' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-4 bg-indigo-500 rounded-full border-2 border-white" />
              </div>
            )}
            {cameraPhase === 'convergence_near' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 bg-indigo-500 rounded-full border-2 border-white animate-pulse" />
              </div>
            )}

            {/* 追従テスト: 緑の点のみ（テキストなし） */}
            {cameraPhase === 'pursuit' && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute w-7 h-7 bg-green-500 rounded-full shadow-lg shadow-green-500/50 border-2 border-white transition-all duration-75"
                  style={{ left: `${pursuitTarget.x}%`, top: `${pursuitTarget.y}%`, transform: 'translate(-50%,-50%)' }} />
              </div>
            )}

            {/* サッカードテスト: 黄色い点のみ（テキストなし） */}
            {cameraPhase === 'saccade' && saccadeTarget && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute w-8 h-8 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50 border-2 border-white"
                  style={{ left: `${saccadeTarget.x}%`, top: `${saccadeTarget.y}%`, transform: 'translate(-50%,-50%)' }} />
              </div>
            )}
          </div>

          {/* ===== 指示テキスト（カメラ映像の外・下に表示） ===== */}
          {cameraPhase === 'fixation' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-center">
              <p className="text-xs text-red-500 font-bold">STEP 1/4 注視テスト</p>
              <p className="text-sm font-bold text-red-800 mt-0.5">画面中央の赤い点を見つめてください</p>
              <p className="text-3xl font-black text-red-600 mt-1">{phaseTimer}<span className="text-sm font-normal">秒</span></p>
            </div>
          )}

          {cameraPhase === 'pursuit' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-center">
              <p className="text-xs text-green-500 font-bold">STEP 3/4 追従テスト</p>
              <p className="text-sm font-bold text-green-800 mt-0.5">緑の点を目だけで追ってください</p>
              <p className="text-3xl font-black text-green-600 mt-1">{phaseTimer}<span className="text-sm font-normal">秒</span></p>
            </div>
          )}

          {cameraPhase === 'saccade' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-center">
              <p className="text-xs text-yellow-600 font-bold">STEP 4/4 サッカードテスト</p>
              <p className="text-sm font-bold text-yellow-800 mt-0.5">黄色い点が出たら素早くそちらを見てください</p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full ${i < saccadeCount ? 'bg-yellow-500' : 'bg-yellow-200'}`} />
                ))}
              </div>
            </div>
          )}

          {/* フェーズ別コントロール */}
          {cameraPhase === 'ready' && cameraReady && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-indigo-800 mb-3">これから4つのテストを行います</p>
              <div className="space-y-2.5 mb-3">
                {[
                  { step: 1, title: '注視', desc: '中央の赤い点をじっと見つめる', time: '10秒', color: 'bg-red-500' },
                  { step: 2, title: '輻輳', desc: '画面の点を見て寄り目の測定', time: '自動', color: 'bg-indigo-500' },
                  { step: 3, title: '追従', desc: '動く緑の点を目で追いかける', time: '8秒', color: 'bg-green-500' },
                  { step: 4, title: 'サッカード', desc: '黄色い点が出たらそちらを見る', time: '8回', color: 'bg-yellow-500' },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className={`w-7 h-7 ${item.color} rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>{item.step}</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-indigo-800">{item.title}<span className="text-xs font-normal text-indigo-600 ml-1">({item.time})</span></p>
                      <p className="text-xs text-indigo-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-indigo-500 mb-3">スマホを顔の正面に置き、頭は動かさず目だけで追ってください。</p>
              <button onClick={startFixationTest} className="btn-primary w-full">測定を開始する</button>
            </div>
          )}

          {cameraPhase === 'convergence_base' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-indigo-600 mb-1">STEP 2/4 輻輳テスト ①</p>
              <p className="font-bold text-indigo-800 mb-2">画面中央の小さい点を両目で見てください</p>
              <p className="text-sm text-indigo-700 mb-3">
                スマホを<strong>腕を伸ばした距離</strong>で持ち、点を見つめてください。
              </p>
              <button onClick={captureBase} disabled={!liveFrame}
                className="btn-primary w-full disabled:opacity-40">
                この距離で撮影
              </button>
            </div>
          )}

          {cameraPhase === 'convergence_near' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-indigo-600 mb-1">STEP 2/4 輻輳テスト ②</p>
              <p className="font-bold text-indigo-800 mb-2">スマホを顔に近づけて点を見てください</p>
              <p className="text-sm text-indigo-700 mb-3">
                画面の点を両目で見ながら、スマホを<strong>顔から15〜20cm</strong>の位置に近づけてください。
              </p>
              <button onClick={captureNear} disabled={!liveFrame}
                className="btn-primary w-full disabled:opacity-40">
                この距離で撮影 → 次へ
              </button>
            </div>
          )}

          {/* テスト完了 → 結果表示 */}
          {cameraPhase === 'done' && cameraEval && (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-lg font-bold">✓</div>
                  <div>
                    <p className="font-bold text-green-800">カメラ評価完了</p>
                    <p className="text-sm text-green-700">
                      総合スコア: <strong>{cameraEval.totalScore}/100</strong>（{levelLabel(cameraEval.totalLevel)}）
                    </p>
                  </div>
                </div>
              </div>

              {/* 7項目の結果 */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([
                  ['convergence', '輻輳'],
                  ['divergence', '開散'],
                  ['fixation', '注視'],
                  ['pursuit', '追従'],
                  ['saccade', 'サッカード'],
                  ['blink', '瞬目'],
                  ['headCompensation', '頭部代償'],
                ] as [keyof CameraEvaluation, string][]).map(([key, label]) => {
                  const item = cameraEval[key] as CameraEvalItem
                  return (
                    <div key={key} className={`rounded-xl border p-3 ${levelColor(item.level)}`}>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="font-black text-xl">{item.score}<span className="text-xs font-normal">/100</span></p>
                      <p className="text-xs mt-0.5">{levelLabel(item.level)}</p>
                    </div>
                  )
                })}
              </div>

              {/* 治療家メモ */}
              <div className="card mb-4">
                <label className="label">治療家メモ（任意）</label>
                <textarea rows={2}
                  placeholder="例: 左目の追従がぎこちない、集中力が続かない様子"
                  value={therapistNote}
                  onChange={e => setTherapistNote(e.target.value)}
                  className="input resize-none" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => {
                  setCameraPhase('ready')
                  setCameraEval(null)
                  setBaseFrame(null)
                  setNearFrame(null)
                  allFramesRef.current = []
                  testStartTimeRef.current = performance.now()
                }} className="btn-secondary">再測定</button>
                <button onClick={analyze} className="btn-accent flex-1 text-base py-4">
                  AIでビジョンメニューを作る
                </button>
              </div>
            </div>
          )}

          {/* 戻るボタン（テスト中でない場合のみ） */}
          {cameraPhase === 'ready' && (
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep('checklist')} className="btn-secondary flex-1">← チェックリストに戻る</button>
            </div>
          )}
        </div>
      )}

      {/* ======== 分析中 ======== */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-8" />
          <h2 className="text-2xl font-black mb-3 text-gray-900">AIが分析しています...</h2>
          <p className="text-gray-500">視機能の弱点と伸びしろを特定し、<br />最適なビジョントレーニングを処方しています</p>
        </div>
      )}

      {/* ======== 結果 ======== */}
      {step === 'result' && result && (
        <div>
          <div className="no-print">
            {/* 完了ヘッダー */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl flex-shrink-0">✓</div>
              <div>
                <h1 className="text-xl font-black text-gray-900">ビジョンメニュー生成完了！</h1>
                <p className="text-sm text-gray-600">{patient?.name} さん専用のトレーニングプランができました</p>
              </div>
            </div>

            {/* 機能レベル判定 */}
            <div className={`rounded-2xl border-2 p-5 mb-5 ${levelColor(result.aiAnalysis.function_level)}`}>
              <p className="text-xs font-bold mb-1">機能レベル判定</p>
              <p className="text-2xl font-black">{levelLabel(result.aiAnalysis.function_level)}</p>
              <div className="flex gap-4 mt-2 text-xs">
                <span>チェックリスト: {result.aiAnalysis.checklist_score.total}/60</span>
                {cameraEval && <span>カメラ: {cameraEval.totalScore}/100</span>}
              </div>
            </div>

            {/* 推奨モード */}
            <div className="card-blue mb-5">
              <p className="text-xs font-bold text-indigo-600 mb-1">推奨トレーニングモード</p>
              <p className="text-lg font-black text-indigo-800">
                {result.aiAnalysis.recommended_mode === 'athlete' ? 'アスリートモード'
                  : result.aiAnalysis.recommended_mode === 'deskwork' ? 'デスクワークモード'
                  : 'ビジョントレーニングモード'}
              </p>
            </div>

            {/* 総合所見 */}
            <div className="card mb-5">
              <h2 className="font-bold mb-2 text-gray-900">AIの総合所見</h2>
              <p className="text-gray-800 leading-relaxed text-sm">{result.aiAnalysis.summary}</p>
            </div>

            {/* カメラ7項目の結果 */}
            {cameraEval && (
              <div className="card mb-5">
                <h2 className="font-bold mb-3 text-gray-900">カメラ評価結果（7項目）</h2>
                <div className="space-y-2">
                  {([
                    ['convergence', '輻輳'],
                    ['divergence', '開散'],
                    ['fixation', '注視'],
                    ['pursuit', '追従'],
                    ['saccade', 'サッカード'],
                    ['blink', '瞬目'],
                    ['headCompensation', '頭部代償'],
                  ] as [keyof CameraEvaluation, string][]).map(([key, label]) => {
                    const item = cameraEval[key] as CameraEvalItem
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-20 flex-shrink-0">{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            item.score >= 75 ? 'bg-green-500' : item.score >= 50 ? 'bg-yellow-500' : item.score >= 25 ? 'bg-orange-500' : 'bg-red-500'
                          }`} style={{ width: `${item.score}%` }} />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{item.score}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${levelColor(item.level)}`}>
                          {levelLabel(item.level)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* チェックリスト結果 */}
            <div className="card mb-5">
              <h2 className="font-bold mb-3 text-gray-900">チェックリスト結果（30項目）</h2>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-indigo-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">A 視覚疲労</p>
                  <p className="font-bold">{result.aiAnalysis.checklist_score.a}/20</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">B 両眼協調</p>
                  <p className="font-bold">{result.aiAnalysis.checklist_score.b}/20</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">C 姿勢連動</p>
                  <p className="font-bold">{result.aiAnalysis.checklist_score.c}/20</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">合計</p>
                  <p className="font-black text-indigo-600">{result.aiAnalysis.checklist_score.total}/60</p>
                </div>
              </div>
            </div>

            {/* 伸びしろポイント */}
            {result.aiAnalysis.weak_areas.length > 0 && (
              <div className="card mb-5">
                <h2 className="font-bold mb-4 text-gray-900">伸びしろポイント（機能向上の余地）</h2>
                <div className="space-y-3">
                  {result.aiAnalysis.weak_areas.map((w, i) => (
                    <div key={i} className={`rounded-xl p-4 border ${
                      w.severity === 'severe' ? 'bg-red-50 border-red-200'
                      : w.severity === 'moderate' ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-orange-50 border-orange-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${w.severity === 'severe' ? 'badge-red' : 'badge-yellow'}`}>
                          {w.severity === 'severe' ? '要注意' : w.severity === 'moderate' ? '中程度' : '軽度'}
                        </span>
                        <span className="font-bold text-sm">{w.area}</span>
                      </div>
                      <p className="text-sm text-gray-600">{w.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* トレーニングメニュー */}
            <div className="mb-5">
              <h2 className="font-bold text-lg mb-1 text-gray-900">今日からやるビジョントレーニング</h2>
              <p className="text-sm text-gray-500 mb-4">メトロノームに合わせて、眼球運動の質を高めましょう</p>
              <div className="space-y-4">
                {result.exercises.map((ex, i) => (
                  <div key={ex.id} className="card">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-lg">{ex.name}</h3>
                          <span className={`badge ${ex.difficulty === 'beginner' ? 'badge-green' : ex.difficulty === 'intermediate' ? 'badge-yellow' : 'badge-red'}`}>
                            {ex.difficulty === 'beginner' ? '初級' : ex.difficulty === 'intermediate' ? '中級' : '上級'}
                          </span>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
                          <p className="text-xs font-bold text-indigo-700 mb-1">なぜこのトレーニングが有効か</p>
                          <p className="text-xs text-indigo-800">{ex.description}</p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-black text-orange-500">{ex.duration_sec}秒</span>
                          {ex.default_bpm && <span className="font-black text-orange-500">{ex.default_bpm} BPM</span>}
                        </div>
                        {ex.instruction && <p className="text-xs text-gray-500 mt-2">{ex.instruction}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 施術提案（プロモード） */}
            {result.aiAnalysis.treatment_suggestions.length > 0 && (
              <div className="card mb-5 border-2 border-purple-200 bg-purple-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded">PRO</span>
                  <h2 className="font-bold text-gray-900">施術提案（治療家向け）</h2>
                </div>
                <div className="space-y-3">
                  {result.aiAnalysis.treatment_suggestions.map((t, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 border border-purple-100">
                      <p className="text-sm font-bold text-purple-800 mb-1">{t.trigger}</p>
                      <div className="flex flex-wrap gap-1">
                        {t.treatments.map((tr, j) => (
                          <span key={j} className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{tr}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 安全基準 */}
            {result.aiAnalysis.safety && (
              <div className="card mb-5 border-2 border-red-200 bg-red-50/50">
                <h2 className="font-bold mb-3 text-red-800">安全基準</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white rounded-lg p-2 border border-red-100">
                    <p className="text-xs text-gray-500">1日最大</p>
                    <p className="font-bold">{result.aiAnalysis.safety.max_daily_minutes}分</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-red-100">
                    <p className="text-xs text-gray-500">連続使用</p>
                    <p className="font-bold">{result.aiAnalysis.safety.max_continuous_minutes}分</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-red-100">
                    <p className="text-xs text-gray-500">リカバリー</p>
                    <p className="font-bold">{result.aiAnalysis.safety.recovery_seconds}秒</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-red-100">
                    <p className="text-xs text-gray-500">週最大</p>
                    <p className="font-bold">{result.aiAnalysis.safety.max_weekly_days}日</p>
                  </div>
                </div>
                <p className="text-xs text-red-700 mt-2 font-medium">
                  中止基準: 強い頭痛・吐き気・めまい・目の痛み・強い疲労
                </p>
              </div>
            )}

            {/* アドバイス */}
            {result.aiAnalysis.recommendations.length > 0 && (
              <div className="card-green mb-5">
                <h2 className="font-bold mb-3 text-green-800">日常でのアドバイス</h2>
                <ul className="space-y-2">
                  {result.aiAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.aiAnalysis.daily_life_advice?.length > 0 && (
              <div className="card mb-8">
                <h2 className="font-bold mb-3 text-gray-900">日常生活で気をつけること</h2>
                <ul className="space-y-2">
                  {result.aiAnalysis.daily_life_advice.map((a, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                      <span className="text-indigo-500 mt-0.5 flex-shrink-0">*</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>{/* end no-print */}

          <div className="flex gap-3 no-print flex-wrap">
            <button onClick={() => window.print()} className="btn-secondary flex-1">印刷する</button>
            <button onClick={() => {
              setStep('select_patient')
              setChecklist({ ...INIT_CHECKLIST })
              setChecklistCategory('a')
              setBaseFrame(null); setNearFrame(null)
              setCameraEval(null); setCameraPhase('ready')
              setTherapistNote('')
              setResult(null); setError('')
            }} className="btn-secondary flex-1">新しい患者へ</button>
            <Link href={`/patients/${patient?.id}`} className="btn-primary flex-1 text-center">履歴を見る</Link>
          </div>

          {/* 印刷用レイアウト */}
          <div className="print-only">
            <div className="print-page">
              <div className="print-header">
                <h1>視機能評価レポート</h1>
                <p className="print-patient">
                  {patient?.name} 様 ／ {patient?.age ? `${patient.age}歳` : ''} ／ {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <div className="print-summary-box">
                <p><strong>機能レベル: {levelLabel(result.aiAnalysis.function_level)}</strong></p>
                <p>{result.aiAnalysis.summary}</p>
              </div>

              <div className="print-report-body">
                <div className="print-left">
                  <h2>カメラ7項目評価</h2>
                  <table className="print-test-table">
                    <tbody>
                      {cameraEval && ([
                        ['輻輳', 'convergence'],
                        ['開散', 'divergence'],
                        ['注視', 'fixation'],
                        ['追従', 'pursuit'],
                        ['サッカード', 'saccade'],
                        ['瞬目', 'blink'],
                        ['頭部代償', 'headCompensation'],
                      ] as [string, keyof CameraEvaluation][]).map(([label, key]) => {
                        const item = cameraEval[key] as CameraEvalItem
                        return <tr key={key}><td>{label}</td><td>{item.score}/100 ({levelLabel(item.level)})</td></tr>
                      })}
                      {cameraEval && <tr><td><strong>総合</strong></td><td><strong>{cameraEval.totalScore}/100</strong></td></tr>}
                      <tr className="print-posture-row"><td colSpan={2}>チェックリスト ({result.aiAnalysis.checklist_score.total}/60)</td></tr>
                      <tr><td>A 視覚疲労</td><td>{result.aiAnalysis.checklist_score.a}/20</td></tr>
                      <tr><td>B 両眼協調</td><td>{result.aiAnalysis.checklist_score.b}/20</td></tr>
                      <tr><td>C 姿勢連動</td><td>{result.aiAnalysis.checklist_score.c}/20</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="print-right">
                  <h2>あなたの伸びしろ</h2>
                  {result.aiAnalysis.weak_areas.map((w, i) => (
                    <div key={i} className="print-weak-card">
                      <div className="print-weak-top">
                        <span className={`print-badge-${w.severity}`}>{w.severity === 'severe' ? '要注意' : w.severity === 'moderate' ? '注意' : '軽度'}</span>
                        <strong>{w.area}</strong>
                      </div>
                      <p>{w.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {result.aiAnalysis.daily_life_advice?.length > 0 && (
                <div className="print-daily-life">
                  <h2>日常生活で気をつけること</h2>
                  <div className="print-daily-life-items">
                    {result.aiAnalysis.daily_life_advice.map((a, i) => (
                      <div key={i} className="print-daily-life-item">
                        <p>{a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="print-page">
              <div className="print-header">
                <h1>今日からやるビジョントレーニング</h1>
                <p className="print-patient">{patient?.name} 様専用メニュー</p>
              </div>
              <div className="print-ex-list">
                {result.exercises.map((ex, i) => (
                  <div key={ex.id} className="print-ex-card">
                    <div className="print-ex-info">
                      <div className="print-ex-name">
                        <span className="print-ex-num">{i + 1}</span>
                        <h3>{ex.name}</h3>
                        <span className="print-ex-reps">
                          {ex.duration_sec}秒{ex.default_bpm ? ` / ${ex.default_bpm}BPM` : ''}
                        </span>
                      </div>
                      <p className="print-ex-why">{ex.description}</p>
                      <p className="print-ex-muscle">{ex.instruction}</p>
                    </div>
                    {ex.video_url && (
                      <div className="print-ex-qr">
                        <QRCodeSVG value={ex.video_url} size={60} level="M" />
                        <span>動画</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="print-advice-bar">
                {result.aiAnalysis.recommendations.map((r, i) => (
                  <p key={i}>{r}</p>
                ))}
              </div>
              <div className="print-bottom-note">
                <p>安全基準: 1日{result.aiAnalysis.safety.max_daily_minutes}分まで / 連続{result.aiAnalysis.safety.max_continuous_minutes}分まで / {result.aiAnalysis.safety.recovery_seconds}秒リカバリー / 週{result.aiAnalysis.safety.max_weekly_days}日まで</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="mobile-header no-print">
        <div className="mobile-header-inner">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium min-h-[44px] flex items-center">← 戻る</Link>
          <span className="font-bold text-gray-900 text-sm">視機能評価</span>
          <div className="w-10" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6 pb-8">
        <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <AnalyzeContent />
        </Suspense>
      </main>
    </div>
  )
}
