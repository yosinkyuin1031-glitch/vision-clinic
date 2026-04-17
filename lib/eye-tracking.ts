/**
 * 虹彩トラッキング + 7項目全自動評価（MediaPipe Face Landmarker）
 * 478ランドマーク（顔468 + 虹彩10）のうち虹彩中心 468(右目) / 473(左目) を追跡
 *
 * ■ カメラ7項目（二葉先生設計・全自動）
 *  1. 輻輳（寄り目）— NPC距離 + 内転量
 *  2. 開散（遠近切替）— 近→遠の虹彩戻り量
 *  3. 注視 — 固定注視中の逸脱回数
 *  4. 追従運動 — ターゲット追従のズレ率
 *  5. サッカード — 2点ジャンプの到達精度・反応時間
 *  6. 瞬目 — まばたき頻度・パターン
 *  7. 頭部代償 — 眼球運動中の頭部移動量
 */
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { CameraEvalItem, CameraEvaluation, FunctionLevel } from '@/types'

// ========================================
// 基本型
// ========================================

export interface IrisPoint {
  x: number       // 画像上のピクセル座標
  y: number
  normalizedX: number  // 0-1
  normalizedY: number
}

export interface EyeFrame {
  timestampMs: number
  rightIris: IrisPoint        // 被験者の右目（画面左）
  leftIris: IrisPoint         // 被験者の左目（画面右）
  rightEyeInner: IrisPoint    // 右目内眼角 (133)
  leftEyeInner: IrisPoint     // 左目内眼角 (362)
  rightEyeOuter: IrisPoint    // 右目外眼角 (33)
  leftEyeOuter: IrisPoint     // 左目外眼角 (263)
  /** 目幅（外眼角距離）*/
  eyeWidthPx: number
  /** まぶた開度（上瞼-下瞼の距離）*/
  rightEyeOpenness: number
  leftEyeOpenness: number
  /** 鼻先のランドマーク（頭部代償検知用） */
  noseTip: IrisPoint
  /** 顎のランドマーク（頭部代償検知用） */
  chin: IrisPoint
}

// ========================================
// FaceLandmarker 初期化
// ========================================

let landmarker: FaceLandmarker | null = null

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  )
  try {
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    })
  } catch {
    const vision2 = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    )
    landmarker = await FaceLandmarker.createFromOptions(vision2, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    })
  }
  return landmarker
}

// ========================================
// フレーム抽出
// ========================================

/** videoフレームから虹彩+まぶた+頭部データを抽出 */
export function extractEyeFrame(
  lm: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): EyeFrame | null {
  if (video.videoWidth === 0) return null
  const result = lm.detectForVideo(video, timestampMs)
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null
  const lms = result.faceLandmarks[0]
  if (lms.length < 478) return null

  const w = video.videoWidth
  const h = video.videoHeight
  const toPoint = (i: number): IrisPoint => ({
    x: lms[i].x * w,
    y: lms[i].y * h,
    normalizedX: lms[i].x,
    normalizedY: lms[i].y,
  })

  const rightIris = toPoint(468)
  const leftIris = toPoint(473)
  const rightEyeInner = toPoint(133)
  const leftEyeInner = toPoint(362)
  const rightEyeOuter = toPoint(33)
  const leftEyeOuter = toPoint(263)
  const noseTip = toPoint(1)
  const chin = toPoint(152)

  // 外眼角どうしの距離
  const eyeWidthPx = Math.hypot(
    leftEyeOuter.x - rightEyeOuter.x,
    leftEyeOuter.y - rightEyeOuter.y,
  )

  // まぶた開度（上瞼-下瞼の距離）
  // 右目: 159(上)→145(下)、左目: 386(上)→374(下)
  const rightEyeOpenness = Math.abs(toPoint(159).y - toPoint(145).y)
  const leftEyeOpenness = Math.abs(toPoint(386).y - toPoint(374).y)

  return {
    timestampMs,
    rightIris,
    leftIris,
    rightEyeInner,
    leftEyeInner,
    rightEyeOuter,
    leftEyeOuter,
    eyeWidthPx,
    rightEyeOpenness,
    leftEyeOpenness,
    noseTip,
    chin,
  }
}

// ========================================
// 定数
// ========================================
const STANDARD_OUTER_CANTHI_DISTANCE_MM = 93

function mmPerPx(frame: EyeFrame): number {
  return STANDARD_OUTER_CANTHI_DISTANCE_MM / frame.eyeWidthPx
}

function scoreToLevel(score: number): FunctionLevel {
  if (score >= 75) return 'normal'
  if (score >= 50) return 'mild'
  if (score >= 25) return 'moderate'
  return 'impaired'
}

// ========================================
// 1. 輻輳（寄り目）
// ========================================

export interface ConvergenceResult {
  leftIrisDisplacementMm: number
  rightIrisDisplacementMm: number
  asymmetryRatio: number
  verdict: 'good' | 'fair' | 'poor'
}

export function evaluateConvergence(
  baseFrame: EyeFrame,
  nearFrame: EyeFrame,
): ConvergenceResult {
  const scale = mmPerPx(baseFrame)

  const rightBaseOffset = baseFrame.rightIris.x - baseFrame.rightEyeInner.x
  const rightNearOffset = nearFrame.rightIris.x - nearFrame.rightEyeInner.x
  const rightDisplacementPx = rightBaseOffset - rightNearOffset
  const rightIrisDisplacementMm = Math.abs(rightDisplacementPx) * scale

  const leftBaseOffset = baseFrame.leftEyeInner.x - baseFrame.leftIris.x
  const leftNearOffset = nearFrame.leftEyeInner.x - nearFrame.leftIris.x
  const leftDisplacementPx = leftBaseOffset - leftNearOffset
  const leftIrisDisplacementMm = Math.abs(leftDisplacementPx) * scale

  const smaller = Math.min(leftIrisDisplacementMm, rightIrisDisplacementMm)
  const larger = Math.max(leftIrisDisplacementMm, rightIrisDisplacementMm)
  const asymmetryRatio = larger > 0 ? 1 - smaller / larger : 0

  const avgDisplacement = (leftIrisDisplacementMm + rightIrisDisplacementMm) / 2
  let verdict: 'good' | 'fair' | 'poor' = 'good'
  if (avgDisplacement < 2 || asymmetryRatio > 0.4) verdict = 'poor'
  else if (avgDisplacement < 4 || asymmetryRatio > 0.2) verdict = 'fair'

  return {
    leftIrisDisplacementMm: Number(leftIrisDisplacementMm.toFixed(2)),
    rightIrisDisplacementMm: Number(rightIrisDisplacementMm.toFixed(2)),
    asymmetryRatio: Number(asymmetryRatio.toFixed(3)),
    verdict,
  }
}

export function evaluateConvergenceItem(baseFrame: EyeFrame, nearFrame: EyeFrame): CameraEvalItem {
  const c = evaluateConvergence(baseFrame, nearFrame)
  const avg = (c.leftIrisDisplacementMm + c.rightIrisDisplacementMm) / 2
  // スコア: avg >= 6mm → 100, avg <= 1mm → 0（線形）
  const score = Math.min(100, Math.max(0, Math.round((avg - 1) * 20)))
  return {
    score,
    level: scoreToLevel(score),
    rawValue: Number(avg.toFixed(2)),
    unit: 'mm',
    details: `内転量 L${c.leftIrisDisplacementMm}mm / R${c.rightIrisDisplacementMm}mm（左右差${(c.asymmetryRatio * 100).toFixed(0)}%）`,
  }
}

// ========================================
// 2. 開散（遠近切替）
// ========================================
export function evaluateDivergenceItem(nearFrame: EyeFrame, farFrame: EyeFrame): CameraEvalItem {
  // 近→遠のとき虹彩が外側に戻る量
  const scale = mmPerPx(nearFrame)

  const rightNearOffset = nearFrame.rightIris.x - nearFrame.rightEyeInner.x
  const rightFarOffset = farFrame.rightIris.x - farFrame.rightEyeInner.x
  const rightReturnPx = rightFarOffset - rightNearOffset
  const rightReturnMm = Math.abs(rightReturnPx) * scale

  const leftNearOffset = nearFrame.leftEyeInner.x - nearFrame.leftIris.x
  const leftFarOffset = farFrame.leftEyeInner.x - farFrame.leftIris.x
  const leftReturnPx = leftFarOffset - leftNearOffset
  const leftReturnMm = Math.abs(leftReturnPx) * scale

  const avg = (rightReturnMm + leftReturnMm) / 2
  const score = Math.min(100, Math.max(0, Math.round((avg - 0.5) * 25)))
  return {
    score,
    level: scoreToLevel(score),
    rawValue: Number(avg.toFixed(2)),
    unit: 'mm',
    details: `開散戻り量 L${leftReturnMm.toFixed(2)}mm / R${rightReturnMm.toFixed(2)}mm`,
  }
}

// ========================================
// 3. 注視（固定注視の安定性）
// ========================================
export function evaluateFixationItem(frames: EyeFrame[], durationMs: number): CameraEvalItem {
  if (frames.length < 10) {
    return { score: 0, level: 'impaired', rawValue: 0, unit: '回', details: 'フレーム不足' }
  }
  // 虹彩座標の安定性 → 逸脱回数をカウント
  const threshold = 3 // ピクセル（微小な揺れは無視）
  let deviations = 0
  const avgX = frames.reduce((s, f) => s + (f.rightIris.x + f.leftIris.x) / 2, 0) / frames.length
  const avgY = frames.reduce((s, f) => s + (f.rightIris.y + f.leftIris.y) / 2, 0) / frames.length

  for (const f of frames) {
    const midX = (f.rightIris.x + f.leftIris.x) / 2
    const midY = (f.rightIris.y + f.leftIris.y) / 2
    const dist = Math.hypot(midX - avgX, midY - avgY)
    if (dist > threshold) deviations++
  }

  // 逸脱率でスコア算出
  const deviationRate = deviations / frames.length
  const score = Math.min(100, Math.max(0, Math.round((1 - deviationRate) * 100)))
  const seconds = (durationMs / 1000).toFixed(1)
  return {
    score,
    level: scoreToLevel(score),
    rawValue: deviations,
    unit: '回',
    details: `${seconds}秒間で逸脱${deviations}回（逸脱率${(deviationRate * 100).toFixed(0)}%）`,
  }
}

// ========================================
// 4. 追従運動（ターゲット追従のズレ率）
// ========================================
export interface PursuitFrame {
  eyeFrame: EyeFrame
  targetX: number  // ターゲットのピクセル座標
  targetY: number
}

export function evaluatePursuitItem(frames: PursuitFrame[]): CameraEvalItem {
  if (frames.length < 10) {
    return { score: 0, level: 'impaired', rawValue: 0, unit: '%', details: 'フレーム不足' }
  }
  // 虹彩中央とターゲット位置のズレを計算
  let totalError = 0
  for (const f of frames) {
    const irisMidX = (f.eyeFrame.rightIris.x + f.eyeFrame.leftIris.x) / 2
    const irisMidY = (f.eyeFrame.rightIris.y + f.eyeFrame.leftIris.y) / 2
    const error = Math.hypot(irisMidX - f.targetX, irisMidY - f.targetY)
    totalError += error
  }
  const avgError = totalError / frames.length
  // 目幅の何%のズレか
  const refWidth = frames[0].eyeFrame.eyeWidthPx || 200
  const errorRate = avgError / refWidth
  const accuracy = Math.max(0, 1 - errorRate * 5) * 100
  const score = Math.min(100, Math.max(0, Math.round(accuracy)))

  return {
    score,
    level: scoreToLevel(score),
    rawValue: Number((accuracy).toFixed(1)),
    unit: '%',
    details: `追従成功率${accuracy.toFixed(0)}%（平均ズレ${avgError.toFixed(1)}px）`,
  }
}

// ========================================
// 5. サッカード（到達精度・反応時間）
// ========================================
export interface SaccadeTrialResult {
  reactionMs: number      // ターゲット出現→虹彩到達の時間
  overshootPx: number     // オーバーシュート量
  targetReached: boolean   // ターゲットに到達したか
}

export function evaluateSaccadeItem(trials: SaccadeTrialResult[]): CameraEvalItem {
  if (trials.length < 3) {
    return { score: 0, level: 'impaired', rawValue: 0, unit: 'ms', details: '試行不足' }
  }
  const reached = trials.filter(t => t.targetReached).length
  const avgReaction = trials.reduce((s, t) => s + t.reactionMs, 0) / trials.length
  const accuracyRate = reached / trials.length

  // スコア: 到達率80%+反応時間250ms以下=100点
  const reactionScore = Math.max(0, 1 - (avgReaction - 150) / 400)
  const score = Math.min(100, Math.max(0, Math.round((accuracyRate * 0.6 + reactionScore * 0.4) * 100)))

  return {
    score,
    level: scoreToLevel(score),
    rawValue: Number(avgReaction.toFixed(0)),
    unit: 'ms',
    details: `到達率${(accuracyRate * 100).toFixed(0)}%・平均反応${avgReaction.toFixed(0)}ms（${trials.length}試行）`,
  }
}

// ========================================
// 6. 瞬目（まばたき頻度・パターン）
// ========================================
export function evaluateBlinkItem(frames: EyeFrame[], durationMs: number): CameraEvalItem {
  if (frames.length < 30) {
    return { score: 0, level: 'impaired', rawValue: 0, unit: '回/分', details: 'フレーム不足' }
  }
  // まぶた開度が閾値以下 → 瞬目
  const avgOpenness = frames.reduce((s, f) => s + (f.rightEyeOpenness + f.leftEyeOpenness) / 2, 0) / frames.length
  const blinkThreshold = avgOpenness * 0.3  // 開度が平均の30%以下で瞬目と判定

  let blinks = 0
  let inBlink = false
  for (const f of frames) {
    const openness = (f.rightEyeOpenness + f.leftEyeOpenness) / 2
    if (openness < blinkThreshold && !inBlink) {
      blinks++
      inBlink = true
    }
    if (openness > blinkThreshold * 2) {
      inBlink = false
    }
  }

  const durationMin = durationMs / 60000
  const blinksPerMin = durationMin > 0 ? blinks / durationMin : 0

  // 正常: 15-20回/分、少なすぎ(<10)も多すぎ(>30)もNG
  let score: number
  if (blinksPerMin >= 12 && blinksPerMin <= 25) {
    score = 100
  } else if (blinksPerMin >= 8 && blinksPerMin <= 30) {
    score = 70
  } else if (blinksPerMin >= 5 && blinksPerMin <= 40) {
    score = 40
  } else {
    score = 15
  }

  return {
    score,
    level: scoreToLevel(score),
    rawValue: Number(blinksPerMin.toFixed(1)),
    unit: '回/分',
    details: `瞬目${blinks}回（${blinksPerMin.toFixed(1)}回/分）`,
  }
}

// ========================================
// 7. 頭部代償（眼球運動中の頭部移動量）
// ========================================
export function evaluateHeadCompensationItem(frames: EyeFrame[]): CameraEvalItem {
  if (frames.length < 10) {
    return { score: 0, level: 'impaired', rawValue: 0, unit: 'px', details: 'フレーム不足' }
  }
  // 鼻先と顎の座標変動量で頭部の動きを判定
  const firstNose = frames[0].noseTip
  let totalMovement = 0
  let maxMovement = 0

  for (const f of frames) {
    const dx = f.noseTip.x - firstNose.x
    const dy = f.noseTip.y - firstNose.y
    const move = Math.hypot(dx, dy)
    totalMovement += move
    if (move > maxMovement) maxMovement = move
  }

  const avgMovement = totalMovement / frames.length
  // 目幅を基準にして相対値に
  const refWidth = frames[0].eyeWidthPx || 200
  const relativeMove = avgMovement / refWidth

  // 頭が全く動かない(relativeMove≈0) → 100、大きく動く(>0.15) → 0
  const score = Math.min(100, Math.max(0, Math.round((1 - relativeMove / 0.15) * 100)))
  const hasCompensation = relativeMove > 0.05

  return {
    score,
    level: scoreToLevel(score),
    rawValue: Number(avgMovement.toFixed(1)),
    unit: 'px',
    details: `頭部代償${hasCompensation ? 'あり' : 'なし'}（平均移動${avgMovement.toFixed(1)}px・最大${maxMovement.toFixed(1)}px）`,
  }
}

// ========================================
// 総合評価
// ========================================
export function buildCameraEvaluation(items: {
  convergence: CameraEvalItem
  divergence: CameraEvalItem
  fixation: CameraEvalItem
  pursuit: CameraEvalItem
  saccade: CameraEvalItem
  blink: CameraEvalItem
  headCompensation: CameraEvalItem
}): CameraEvaluation {
  // 加重平均（輻輳・追従・サッカードを重視）
  const weights = {
    convergence: 1.5,
    divergence: 1.2,
    fixation: 1.0,
    pursuit: 1.5,
    saccade: 1.5,
    blink: 0.8,
    headCompensation: 1.0,
  }
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  let weightedSum = 0
  for (const [key, weight] of Object.entries(weights)) {
    weightedSum += items[key as keyof typeof items].score * weight
  }
  const totalScore = Math.round(weightedSum / totalWeight)

  return {
    ...items,
    totalScore,
    totalLevel: scoreToLevel(totalScore),
  }
}

// ========================================
// ユーティリティ
// ========================================

/** 日本語ラベル */
export function verdictLabel(v: 'good' | 'fair' | 'poor'): string {
  return v === 'good' ? '良好' : v === 'fair' ? '要トレーニング' : '要改善'
}

export function levelLabel(level: FunctionLevel): string {
  switch (level) {
    case 'normal': return '正常'
    case 'mild': return '軽度低下'
    case 'moderate': return '中等度低下'
    case 'impaired': return '機能低下'
  }
}

export function levelColor(level: FunctionLevel): string {
  switch (level) {
    case 'normal': return 'text-green-700 bg-green-50 border-green-200'
    case 'mild': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    case 'moderate': return 'text-orange-700 bg-orange-50 border-orange-200'
    case 'impaired': return 'text-red-700 bg-red-50 border-red-200'
  }
}
