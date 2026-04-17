import Anthropic from '@anthropic-ai/sdk'
import type {
  EyeTrackingData,
  VisionChecklist30,
  VisionAIAnalysis,
  FunctionLevel,
  TrainingMode,
  CameraEvaluation,
  SafetyLimits,
} from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ========================================
// 安全基準（二葉先生設計）
// ========================================
const SAFETY: Record<string, SafetyLimits> = {
  child: {
    age_group: 'child',
    max_daily_minutes: 7,
    max_continuous_minutes: 3,
    recovery_seconds: 30,
    max_weekly_days: 4,
    stop_criteria: ['強い頭痛', '吐き気', 'めまい', '目の痛み', '強い疲労'],
  },
  adult: {
    age_group: 'adult',
    max_daily_minutes: 10,
    max_continuous_minutes: 3,
    recovery_seconds: 30,
    max_weekly_days: 4,
    stop_criteria: ['強い頭痛', '吐き気', 'めまい', '目の痛み', '強い疲労'],
  },
  elderly: {
    age_group: 'elderly',
    max_daily_minutes: 5,
    max_continuous_minutes: 3,
    recovery_seconds: 30,
    max_weekly_days: 4,
    stop_criteria: ['強い頭痛', '吐き気', 'めまい', '目の痛み', '強い疲労'],
  },
}

export function getSafetyLimits(ageGroup?: string): SafetyLimits {
  return SAFETY[ageGroup || 'adult'] || SAFETY.adult
}

// ========================================
// チェックリストスコア計算
// ========================================
export function calcChecklistScore(cl: VisionChecklist30) {
  const sumA = cl.a.reduce<number>((s, v) => s + v, 0)
  const sumB = cl.b.reduce<number>((s, v) => s + v, 0)
  const sumC = cl.c.reduce<number>((s, v) => s + v, 0)
  const total = sumA + sumB + sumC
  let level: FunctionLevel = 'normal'
  if (total >= 30) level = 'impaired'
  else if (total >= 20) level = 'moderate'
  else if (total >= 10) level = 'mild'
  return { a: sumA, b: sumB, c: sumC, total, level }
}

// ========================================
// モード別トレーニングプリセット（二葉先生設計）
// ========================================
const PRESETS: Record<TrainingMode, Record<string, { exercises: string[]; minutes: number }>> = {
  vision: {
    beginner: { exercises: ['遠近切替（輻輳・開散）', '注視トレーニング', 'ゆっくり追従'], minutes: 5 },
    intermediate: { exercises: ['デジタルストリング', '円追従', 'ジャンプコンバージェンス'], minutes: 6 },
    advanced: { exercises: ['ランダムサッカード', '周辺視野トレーニング', '視覚＋バランス連動'], minutes: 7 },
  },
  athlete: {
    beginner: { exercises: ['水平サッカード', 'ゆっくり追従', '注視トレーニング'], minutes: 5 },
    intermediate: { exercises: ['ジャンプコンバージェンス', '円追従', '周辺視野トレーニング'], minutes: 6 },
    advanced: { exercises: ['ランダムサッカード', '周辺視野トレーニング', '視覚＋バランス連動'], minutes: 8 },
  },
  deskwork: {
    beginner: { exercises: ['遠近切替（輻輳・開散）', '円追従', '注視トレーニング'], minutes: 3 },
    intermediate: { exercises: ['遠近切替（輻輳・開散）', '円追従', '注視トレーニング'], minutes: 3 },
    advanced: { exercises: ['遠近切替（輻輳・開散）', '円追従', '注視トレーニング'], minutes: 3 },
  },
}

function selectPreset(mode: TrainingMode, level: FunctionLevel) {
  const difficulty = level === 'impaired' || level === 'moderate' ? 'beginner'
    : level === 'mild' ? 'intermediate' : 'advanced'
  return PRESETS[mode][difficulty]
}

// ========================================
// 施術提案ルール（二葉先生の知見ベース・フォールバック用）
// ========================================
const TREATMENT_RULES: Record<string, Record<string, string[]>> = {
  convergence: {
    moderate: ['後頭下筋調整', '上部頸椎調整', '眼周囲筋アプローチ'],
    impaired: ['後頭下筋調整', '上部頸椎調整', '眼周囲筋アプローチ', '前頭筋・眼輪筋リリース'],
  },
  divergence: {
    moderate: ['後頭下筋調整', '上部頸椎モビライゼーション'],
    impaired: ['後頭下筋調整', '上部頸椎モビライゼーション', '毛様体筋リラクゼーション（温熱）'],
  },
  fixation: {
    moderate: ['頸椎深層屈筋活性化', '姿勢調整（頭位正中化）'],
    impaired: ['頸椎深層屈筋活性化', '姿勢調整（頭位正中化）', '前庭系アプローチ'],
  },
  pursuit: {
    moderate: ['胸鎖乳突筋リリース', '僧帽筋上部リリース', '頸椎可動域改善'],
    impaired: ['胸鎖乳突筋リリース', '僧帽筋上部リリース', '頸椎可動域改善', '後頭下筋群アプローチ'],
  },
  saccade: {
    moderate: ['頸椎回旋可動域改善', '眼球運動の神経促通'],
    impaired: ['頸椎回旋可動域改善', '眼球運動の神経促通', '前庭眼反射トレーニング'],
  },
  blink: {
    moderate: ['眼輪筋リラクゼーション', 'ドライアイ対策指導'],
    impaired: ['眼輪筋リラクゼーション', 'ドライアイ対策指導', '自律神経調整（副交感優位化）'],
  },
  headCompensation: {
    moderate: ['姿勢調整', '頸椎アライメント改善', '体幹安定化'],
    impaired: ['姿勢調整', '頸椎アライメント改善', '体幹安定化', '頸椎深層筋トレーニング'],
  },
}

function buildTreatmentSuggestions(cameraEval?: CameraEvaluation) {
  const suggestions: { trigger: string; treatments: string[] }[] = []
  if (!cameraEval) return suggestions

  const evalNames: Record<string, string> = {
    convergence: '輻輳',
    divergence: '開散',
    fixation: '注視',
    pursuit: '追従',
    saccade: 'サッカード',
    blink: '瞬目',
    headCompensation: '頭部代償',
  }

  for (const [key, name] of Object.entries(evalNames)) {
    const item = cameraEval[key as keyof CameraEvaluation]
    if (typeof item === 'object' && 'level' in item) {
      const level = item.level as string
      if (level === 'moderate' || level === 'impaired') {
        const rules = TREATMENT_RULES[key]?.[level]
        if (rules) {
          suggestions.push({ trigger: `${name}低下`, treatments: rules })
        }
      }
    }
  }
  return suggestions
}

// ========================================
// モード推奨ロジック
// ========================================
function recommendMode(occupation?: string, checklistScore?: { a: number; b: number; c: number }): TrainingMode {
  // スポーツ選手系の職業ならアスリート
  const athleteKeywords = ['選手', 'アスリート', '野球', 'サッカー', 'テニス', 'バスケ', 'ゴルフ', 'スポーツ']
  if (occupation && athleteKeywords.some(k => occupation.includes(k))) return 'athlete'

  // デスクワーク系ならデスクワーク
  const deskKeywords = ['デスクワーク', 'IT', 'プログラマ', 'SE', '事務', 'PC', '経理', '設計']
  if (occupation && deskKeywords.some(k => occupation.includes(k))) return 'deskwork'

  // チェックリストのAカテゴリ（視覚疲労）が高ければデスクワーク
  if (checklistScore && checklistScore.a >= 12) return 'deskwork'

  return 'vision'
}

// ========================================
// フォールバック処方（APIキー未設定・エラー時）
// ========================================
function buildFallbackAnalysis(
  eye: EyeTrackingData,
  checklist: VisionChecklist30 | null,
  ageGroup?: string,
  occupation?: string,
): VisionAIAnalysis {
  const clScore = checklist ? calcChecklistScore(checklist) : { a: 0, b: 0, c: 0, total: 0, level: 'normal' as FunctionLevel }
  const cameraEval = eye.cameraEval

  // 機能レベル判定（チェックリスト + カメラの総合）
  let functionLevel: FunctionLevel = clScore.level
  if (cameraEval) {
    const cameraLevel = cameraEval.totalLevel
    // より低い方を採用
    const levels: FunctionLevel[] = ['normal', 'mild', 'moderate', 'impaired']
    const clIdx = levels.indexOf(clScore.level)
    const camIdx = levels.indexOf(cameraLevel)
    functionLevel = levels[Math.max(clIdx, camIdx)]
  }

  const mode = recommendMode(occupation, clScore)
  const preset = selectPreset(mode, functionLevel)
  const safety = getSafetyLimits(ageGroup)

  const weakAreas: VisionAIAnalysis['weak_areas'] = []
  const treatments = buildTreatmentSuggestions(cameraEval)

  // カメラ評価から弱点抽出
  if (cameraEval) {
    const evalLabels: Record<string, string> = {
      convergence: '輻輳機能',
      divergence: '開散機能',
      fixation: '注視安定性',
      pursuit: '追従運動',
      saccade: 'サッカード',
      blink: '瞬目パターン',
      headCompensation: '頭部代償',
    }
    for (const [key, label] of Object.entries(evalLabels)) {
      const item = cameraEval[key as keyof CameraEvaluation]
      if (typeof item === 'object' && 'level' in item) {
        if (item.level === 'moderate' || item.level === 'impaired') {
          weakAreas.push({
            area: label,
            severity: item.level === 'impaired' ? 'severe' : 'moderate',
            description: item.details,
          })
        }
      }
    }
  }

  // チェックリストから弱点抽出
  if (clScore.a >= 12) weakAreas.push({ area: '視覚疲労・集中', severity: clScore.a >= 16 ? 'severe' : 'moderate', description: `Aカテゴリ ${clScore.a}/20点。視覚疲労が強く、画面作業や読書で症状が出やすい状態です。` })
  if (clScore.b >= 12) weakAreas.push({ area: '両眼協調・距離感', severity: clScore.b >= 16 ? 'severe' : 'moderate', description: `Bカテゴリ ${clScore.b}/20点。両眼の協調に改善余地があり、距離感や立体視に影響が出ています。` })
  if (clScore.c >= 12) weakAreas.push({ area: '姿勢・身体連動', severity: clScore.c >= 16 ? 'severe' : 'moderate', description: `Cカテゴリ ${clScore.c}/20点。視機能と姿勢制御の連動に改善余地があります。` })

  if (weakAreas.length === 0) {
    weakAreas.push({ area: '視機能全般', severity: 'mild', description: '大きな弱点はなく、機能維持・パフォーマンス向上を目指せる段階です。' })
  }

  const modeLabel = mode === 'athlete' ? 'アスリートモード' : mode === 'deskwork' ? 'デスクワークモード' : 'ビジョントレーニングモード'

  return {
    weak_areas: weakAreas,
    summary: `検査の結果、${modeLabel}（${preset.minutes}分）でのトレーニングを推奨します。${weakAreas[0].area}を重点的に改善していきましょう。`,
    function_level: functionLevel,
    checklist_score: { a: clScore.a, b: clScore.b, c: clScore.c, total: clScore.total },
    recommended_mode: mode,
    priority_exercises: preset.exercises,
    treatment_suggestions: treatments,
    recommendations: [
      '1日3〜5分でも毎日続けることで眼球運動の質が安定します。',
      '画面作業では20-20-20ルール（20分毎に20フィート先を20秒見る）を取り入れましょう。',
      '眼鏡の度数が合っていないと視機能負荷が増えます。定期的な検眼を推奨します。',
    ],
    daily_life_advice: [
      '窓の外や遠景を意識的に見て、毛様体筋をリセットする時間を作る。',
      '読書時は本を斜めに立てて、目線を下に落としすぎない。',
      'ボール運動（キャッチボール等）は眼球運動の総合トレーニングとして有効。',
      '照明は手元と背景のコントラスト差を小さくして目の負担を減らす。',
    ],
    safety: {
      max_daily_minutes: safety.max_daily_minutes,
      max_continuous_minutes: safety.max_continuous_minutes,
      recovery_seconds: safety.recovery_seconds,
      max_weekly_days: safety.max_weekly_days,
    },
  }
}

// ========================================
// メイン分析関数
// ========================================
export async function analyzeVisionAssessment(
  eye: EyeTrackingData,
  checklist: VisionChecklist30 | null,
  patientAge?: number,
  patientGender?: string,
  occupation?: string,
  ageGroup?: string,
): Promise<VisionAIAnalysis> {
  const clScore = checklist ? calcChecklistScore(checklist) : null
  const mode = recommendMode(occupation, clScore || undefined)
  const safety = getSafetyLimits(ageGroup)

  const lines: string[] = []
  if (patientAge) lines.push(`患者年齢: ${patientAge}歳`)
  if (patientGender) lines.push(`性別: ${patientGender === 'male' ? '男性' : patientGender === 'female' ? '女性' : 'その他'}`)
  if (occupation) lines.push(`職業: ${occupation}`)
  lines.push(`推奨モード: ${mode === 'athlete' ? 'アスリート' : mode === 'deskwork' ? 'デスクワーク' : 'ビジョントレーニング'}`)

  // チェックリスト
  if (clScore) {
    lines.push(`\n【チェックリスト結果（30項目・60点満点）】`)
    lines.push(`A 視覚疲労・集中: ${clScore.a}/20点`)
    lines.push(`B 両眼協調・距離感: ${clScore.b}/20点`)
    lines.push(`C 姿勢・身体連動: ${clScore.c}/20点`)
    lines.push(`合計: ${clScore.total}/60点 → 判定: ${clScore.level}`)
  }

  // カメラ7項目
  if (eye.cameraEval) {
    lines.push(`\n【カメラ7項目全自動評価】`)
    const evalLabels: Record<string, string> = {
      convergence: '輻輳', divergence: '開散', fixation: '注視',
      pursuit: '追従', saccade: 'サッカード', blink: '瞬目', headCompensation: '頭部代償',
    }
    for (const [key, label] of Object.entries(evalLabels)) {
      const item = eye.cameraEval[key as keyof CameraEvaluation]
      if (typeof item === 'object' && 'score' in item) {
        lines.push(`${label}: スコア${item.score}/100（${item.level}）— ${item.details}`)
      }
    }
    lines.push(`総合スコア: ${eye.cameraEval.totalScore}/100（${eye.cameraEval.totalLevel}）`)
  }

  // 旧互換データ
  if (eye.leftIrisDisplacementMm > 0) {
    lines.push(`\n【輻輳データ（旧互換）】`)
    lines.push(`左目内転量: ${eye.leftIrisDisplacementMm}mm / 右目内転量: ${eye.rightIrisDisplacementMm}mm`)
    lines.push(`左右差: ${(eye.asymmetryRatio * 100).toFixed(0)}%`)
    if (eye.nearPointCm != null) lines.push(`近点: ${eye.nearPointCm}cm`)
    lines.push(`頂点ピント合わせ: ${eye.focusHoldAtApex ? 'OK' : '困難'}`)
  }

  if (eye.therapist_note) lines.push(`\n治療家メモ: ${eye.therapist_note}`)

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[vision-ai] ANTHROPIC_API_KEY未設定のためフォールバック処方')
    return buildFallbackAnalysis(eye, checklist, ageGroup, occupation)
  }

  const treatmentSuggestions = buildTreatmentSuggestions(eye.cameraEval)

  lines.push(`
【施術提案ルール（参考）】
${treatmentSuggestions.map(t => `${t.trigger} → ${t.treatments.join('、')}`).join('\n')}

【安全基準】
1日最大: ${safety.max_daily_minutes}分
連続使用: 最大${safety.max_continuous_minutes}分 → ${safety.recovery_seconds}秒リカバリー
週: 最大${safety.max_weekly_days}日（2日に1回推奨）
中止基準: ${safety.stop_criteria.join('、')}

以下のJSON形式のみで返答（他の文字は一切不要）:
{
  "weak_areas": [{"area":"機能名","severity":"mild|moderate|severe","description":"1〜2文で根拠と改善の視点"}],
  "summary": "総合所見を2文以内。前向きに伝わる表現で",
  "function_level": "normal|mild|moderate|impaired",
  "checklist_score": {"a":数値,"b":数値,"c":数値,"total":数値},
  "recommended_mode": "vision|athlete|deskwork",
  "priority_exercises": [必ず3個。以下から選択:
    "遠近切替（輻輳・開散）","ゆっくり追従","注視トレーニング",
    "ジャンプコンバージェンス","デジタルストリング",
    "水平サッカード","円追従","ランダムサッカード",
    "周辺視野トレーニング","視覚＋バランス連動"],
  "treatment_suggestions": [{"trigger":"機能低下名","treatments":["施術1","施術2"]}],
  "recommendations": ["機能向上のアドバイスを1文ずつ、3つ"],
  "daily_life_advice": ["日常で目の機能を伸ばすヒントを1文ずつ、3〜4つ"],
  "safety": {"max_daily_minutes":${safety.max_daily_minutes},"max_continuous_minutes":${safety.max_continuous_minutes},"recovery_seconds":${safety.recovery_seconds},"max_weekly_days":${safety.max_weekly_days}}
}`)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system:
        'ビジョントレーニング専門のAIコーチ。両眼視機能と姿勢制御学の統合評価モデルに基づき、カメラ7項目の全自動評価とチェックリスト30項目の結果から、個別のトレーニング＋施術提案を行う。必ずJSON形式のみで返答。前後に説明文や```は不要。',
      messages: [{ role: 'user', content: lines.join('\n') }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as VisionAIAnalysis
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    console.error('[vision-ai] Claude API失敗、フォールバック処方を使用:', e?.status, e?.message)
    return buildFallbackAnalysis(eye, checklist, ageGroup, occupation)
  }
}
