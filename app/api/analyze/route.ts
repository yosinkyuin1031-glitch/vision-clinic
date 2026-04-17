import { NextRequest, NextResponse } from 'next/server'
import { analyzeVisionAssessment } from '@/lib/ai-analysis'
import { createServerClient } from '@/lib/supabase'
import { getCurrentClinicId } from '@/lib/supabase-server'
import type { EyeTrackingData, VisionChecklist30 } from '@/types'

export const maxDuration = 60

interface RequestBody {
  patient_id: string
  clinic_id?: string | null
  eye_data: EyeTrackingData
  checklist?: VisionChecklist30 | null
  patient_age?: number
  patient_gender?: string
  occupation?: string
  age_group?: string
}

export async function POST(req: NextRequest) {
  try {
    const { patient_id, clinic_id, eye_data, checklist, patient_age, patient_gender, occupation, age_group } =
      (await req.json()) as RequestBody
    if (!patient_id || !eye_data) {
      return NextResponse.json({ error: '必須パラメータ不足' }, { status: 400 })
    }

    const sessionClinicId = await getCurrentClinicId()
    const effectiveClinicId = sessionClinicId ?? clinic_id ?? null

    const aiAnalysis = await analyzeVisionAssessment(
      eye_data,
      checklist ?? null,
      patient_age,
      patient_gender,
      occupation,
      age_group,
    )
    const sb = createServerClient()

    // vision_assessments に保存
    const assessmentData: Record<string, unknown> = {
      patient_id,
      convergence_left_displacement_mm: eye_data.leftIrisDisplacementMm ?? null,
      convergence_right_displacement_mm: eye_data.rightIrisDisplacementMm ?? null,
      convergence_asymmetry_ratio: eye_data.asymmetryRatio ?? null,
      convergence_near_point_cm: eye_data.nearPointCm ?? null,
      focus_hold_at_apex: eye_data.focusHoldAtApex ?? null,
      pursuit_smoothness: eye_data.pursuit_smoothness || null,
      saccade_accuracy: eye_data.saccade_accuracy || null,
      therapist_note: eye_data.therapist_note || null,
      ai_analysis: aiAnalysis,
      // V2: チェックリスト
      checklist_scores: checklist ?? null,
      checklist_total: aiAnalysis.checklist_score.total,
      checklist_level: aiAnalysis.function_level,
      // V2: 機能レベル・推奨モード
      function_level: aiAnalysis.function_level,
      recommended_mode: aiAnalysis.recommended_mode,
    }

    // V2: カメラ7項目
    if (eye_data.cameraEval) {
      const ce = eye_data.cameraEval
      assessmentData.eval_convergence = ce.convergence
      assessmentData.eval_divergence = ce.divergence
      assessmentData.eval_fixation = ce.fixation
      assessmentData.eval_pursuit = ce.pursuit
      assessmentData.eval_saccade = ce.saccade
      assessmentData.eval_blink = ce.blink
      assessmentData.eval_head_compensation = ce.headCompensation
      assessmentData.camera_total_score = ce.totalScore
      assessmentData.camera_total_level = ce.totalLevel
    }

    if (effectiveClinicId) assessmentData.clinic_id = effectiveClinicId

    const { data: assessment, error: ae } = await sb
      .from('vision_assessments')
      .insert(assessmentData)
      .select()
      .single()
    if (ae) throw ae

    // 種目取得
    const { data: exercises } = await sb
      .from('vision_exercises')
      .select('*')
      .in('name', aiAnalysis.priority_exercises)

    // プラン作成
    const planData: Record<string, unknown> = {
      patient_id,
      assessment_id: assessment.id,
      ai_generated_plan: aiAnalysis,
      training_mode: aiAnalysis.recommended_mode,
    }
    if (effectiveClinicId) planData.clinic_id = effectiveClinicId

    const { data: plan, error: pe } = await sb
      .from('vision_plans')
      .insert(planData)
      .select()
      .single()
    if (pe) throw pe

    if (exercises?.length) {
      const orderMap = new Map(aiAnalysis.priority_exercises.map((n, i) => [n, i + 1]))
      const rows = exercises.map((ex: { id: string; name: string; default_bpm: number | null; duration_sec: number }) => ({
        plan_id: plan.id,
        exercise_id: ex.id,
        display_order: orderMap.get(ex.name) ?? 99,
        target_bpm: ex.default_bpm,
        duration_sec: ex.duration_sec || 60,
      }))
      rows.sort((a, b) => a.display_order - b.display_order)
      await sb.from('vision_plan_exercises').insert(rows)
    }

    return NextResponse.json({
      data: { assessment, plan, ai_analysis: aiAnalysis, exercises: exercises || [] },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    console.error('[api/analyze] エラー:', message)
    return NextResponse.json(
      { error: '分析処理に失敗しました。もう一度お試しください。改善しない場合は管理者にお問い合わせください。' },
      { status: 500 },
    )
  }
}
