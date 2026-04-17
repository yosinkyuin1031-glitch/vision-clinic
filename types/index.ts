// VisionClinic V2 型定義

export type Gender = 'male' | 'female' | 'other'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type ExerciseCategory = 'pursuit' | 'saccade' | 'convergence' | 'peripheral' | 'eye_stretch' | 'balance'

/** トレーニングモード */
export type TrainingMode = 'vision' | 'athlete' | 'deskwork'

/** 機能レベル判定 */
export type FunctionLevel = 'normal' | 'mild' | 'moderate' | 'impaired'

export interface Patient {
  id: string
  clinic_id: string
  name: string
  age?: number
  gender?: Gender
  phone?: string
  occupation?: string
  wears_glasses?: boolean
  /** 年齢区分（安全基準に使用） */
  age_group?: 'child' | 'adult' | 'elderly'
  created_at: string
  updated_at?: string
}

// ========================================
// Step1: 30項目チェックリスト
// ========================================

/** チェックリスト回答（はい=2 / ときどき=1 / いいえ=0） */
export type CheckAnswer = 0 | 1 | 2

/** 30項目チェックリスト（3カテゴリ×10） */
export interface VisionChecklist30 {
  /** A: 視覚疲労・集中（10項目） */
  a: [CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer,
      CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer]
  /** B: 両眼協調・距離感（10項目） */
  b: [CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer,
      CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer]
  /** C: 姿勢・身体連動（10項目） */
  c: [CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer,
      CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer, CheckAnswer]
  note: string
}

/** 旧互換用（内部では VisionChecklist30 を使用） */
export interface VisionChecklist {
  double_vision: boolean
  eye_strain: boolean
  headache_on_reading: boolean
  loses_place_reading: boolean
  slow_reading: boolean
  skip_words: boolean
  far_to_near_slow: boolean
  blur_after_screen: boolean
  screen_hours: number
  sports_vision_concern: boolean
  driving_night_difficulty: boolean
  note: string
}

// ========================================
// Step2: カメラ7項目全自動評価
// ========================================

/** 各評価項目のスコア（0-100） */
export interface CameraEvalItem {
  score: number             // 0-100
  level: FunctionLevel      // 判定
  rawValue: number          // 生測定値
  unit: string              // 単位（mm, cm, 回, %, ms）
  details: string           // 表示用の説明文
}

/** カメラ7項目の全自動評価結果 */
export interface CameraEvaluation {
  /** 1. 輻輳（寄り目）— NPC距離 + 内転量 */
  convergence: CameraEvalItem
  /** 2. 開散（遠近切替）— 近→遠の虹彩戻り量 */
  divergence: CameraEvalItem
  /** 3. 注視 — 固定注視中の逸脱回数 */
  fixation: CameraEvalItem
  /** 4. 追従運動 — ターゲット追従のズレ率 */
  pursuit: CameraEvalItem
  /** 5. サッカード — 2点ジャンプの到達精度・反応時間 */
  saccade: CameraEvalItem
  /** 6. 瞬目 — まばたき頻度・パターン */
  blink: CameraEvalItem
  /** 7. 頭部代償 — 眼球運動中の頭部移動量 */
  headCompensation: CameraEvalItem

  /** 総合スコア（7項目の加重平均） */
  totalScore: number
  /** 総合レベル */
  totalLevel: FunctionLevel
}

/** 眼球トラッキング結果（API送信用） */
export interface EyeTrackingData {
  leftIrisDisplacementMm: number
  rightIrisDisplacementMm: number
  asymmetryRatio: number
  nearPointCm: number | null
  focusHoldAtApex: boolean
  pursuit_smoothness: 'good' | 'fair' | 'poor' | ''
  saccade_accuracy: 'good' | 'fair' | 'poor' | ''
  therapist_note: string
  /** V2: カメラ7項目の全自動評価結果 */
  cameraEval?: CameraEvaluation
}

// ========================================
// Step4: トレーニング
// ========================================

export interface VisionExercise {
  id: string
  name: string
  category: ExerciseCategory
  difficulty: Difficulty
  default_bpm: number | null
  duration_sec: number
  description: string
  instruction: string
  image_url: string | null
  video_url: string | null
  /** トレーニング優先順位（1が最優先） */
  priority_order: number | null
}

/** モード別トレーニングプリセット */
export interface TrainingPreset {
  mode: TrainingMode
  difficulty: Difficulty
  exercises: string[]       // 種目名リスト
  totalMinutes: number
}

// ========================================
// Step5: プロモード（施術提案）
// ========================================

/** AI施術提案ルール（二葉先生の知見ベース） */
export interface TreatmentRule {
  id: string
  /** どの評価項目が低下したとき */
  trigger_eval: 'convergence' | 'divergence' | 'fixation' | 'pursuit' | 'saccade' | 'blink' | 'headCompensation'
  /** どのレベルで発動 */
  trigger_level: FunctionLevel
  /** 施術提案の内容 */
  treatments: string[]
  /** 表示順 */
  display_order: number
  /** 編集可能フラグ */
  is_active: boolean
  created_at: string
}

/** 経過記録 */
export interface ProgressRecord {
  assessment_id: string
  assessed_at: string
  convergence_npc_cm: number | null
  fixation_deviations: number | null
  pursuit_accuracy: number | null
  total_score: number
  total_level: FunctionLevel
}

// ========================================
// AI処方結果
// ========================================

/** AI処方結果（V2） */
export interface VisionAIAnalysis {
  weak_areas: { area: string; severity: 'mild' | 'moderate' | 'severe'; description: string }[]
  summary: string
  /** 機能レベル判定 */
  function_level: FunctionLevel
  /** チェックリストスコア */
  checklist_score: { a: number; b: number; c: number; total: number }
  /** 推奨モード */
  recommended_mode: TrainingMode
  priority_exercises: string[]
  /** 施術提案（プロモード用） */
  treatment_suggestions: { trigger: string; treatments: string[] }[]
  recommendations: string[]
  daily_life_advice: string[]
  /** 安全基準 */
  safety: {
    max_daily_minutes: number
    max_continuous_minutes: number
    recovery_seconds: number
    max_weekly_days: number
  }
}

// ========================================
// 安全基準
// ========================================

export interface SafetyLimits {
  /** 年齢区分 */
  age_group: 'child' | 'adult' | 'elderly'
  /** 1日最大（分） */
  max_daily_minutes: number
  /** 連続使用最大（分） */
  max_continuous_minutes: number
  /** リカバリー休憩（秒） */
  recovery_seconds: number
  /** 週最大日数 */
  max_weekly_days: number
  /** 中止基準 */
  stop_criteria: string[]
}
