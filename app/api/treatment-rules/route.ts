import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser, getCurrentClinicId } from '@/lib/supabase-server'

const VALID_EVALS = ['convergence', 'divergence', 'fixation', 'pursuit', 'saccade', 'blink', 'headCompensation']
const VALID_LEVELS = ['mild', 'moderate', 'impaired']

// 施術提案ルール一覧取得
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const clinicId = await getCurrentClinicId()
    const sb = createServerClient()

    const { data, error } = await sb
      .from('vc_treatment_rules')
      .select('*')
      .or(`clinic_id.is.null${clinicId ? `,clinic_id.eq.${clinicId}` : ''}`)
      .order('display_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[treatment-rules] GET error:', err)
    return NextResponse.json({ error: 'ルールの取得に失敗しました' }, { status: 500 })
  }
}

// 施術提案ルール新規作成
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const clinicId = await getCurrentClinicId()
    if (!clinicId) return NextResponse.json({ error: '院情報が見つかりません' }, { status: 403 })

    const body = await req.json()
    const { trigger_eval, trigger_level, treatments, display_order } = body

    if (!trigger_eval || !VALID_EVALS.includes(trigger_eval)) {
      return NextResponse.json({ error: '評価項目が不正です' }, { status: 400 })
    }
    if (!trigger_level || !VALID_LEVELS.includes(trigger_level)) {
      return NextResponse.json({ error: '発動レベルが不正です' }, { status: 400 })
    }
    if (!Array.isArray(treatments) || treatments.length === 0 || treatments.some((t: unknown) => typeof t !== 'string' || !t)) {
      return NextResponse.json({ error: '施術内容を正しく入力してください' }, { status: 400 })
    }

    const sb = createServerClient()
    const { data, error } = await sb
      .from('vc_treatment_rules')
      .insert({
        clinic_id: clinicId,
        trigger_eval,
        trigger_level,
        treatments,
        display_order: display_order ?? 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[treatment-rules] POST error:', err)
    return NextResponse.json({ error: 'ルールの作成に失敗しました' }, { status: 500 })
  }
}

// 施術提案ルール更新
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const clinicId = await getCurrentClinicId()
    if (!clinicId) return NextResponse.json({ error: '院情報が見つかりません' }, { status: 403 })

    const body = await req.json()
    const { id, trigger_eval, trigger_level, treatments, display_order, is_active } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'IDが不正です' }, { status: 400 })
    }

    const sb = createServerClient()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (trigger_eval !== undefined) {
      if (!VALID_EVALS.includes(trigger_eval)) return NextResponse.json({ error: '評価項目が不正です' }, { status: 400 })
      updateData.trigger_eval = trigger_eval
    }
    if (trigger_level !== undefined) {
      if (!VALID_LEVELS.includes(trigger_level)) return NextResponse.json({ error: '発動レベルが不正です' }, { status: 400 })
      updateData.trigger_level = trigger_level
    }
    if (treatments !== undefined) {
      if (!Array.isArray(treatments)) return NextResponse.json({ error: '施術内容が不正です' }, { status: 400 })
      updateData.treatments = treatments.filter((t: unknown) => typeof t === 'string' && t)
    }
    if (display_order !== undefined) updateData.display_order = Number(display_order) || 0
    if (is_active !== undefined) updateData.is_active = is_active === true

    const { data, error } = await sb
      .from('vc_treatment_rules')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[treatment-rules] PUT error:', err)
    return NextResponse.json({ error: 'ルールの更新に失敗しました' }, { status: 500 })
  }
}

// 施術提案ルール削除
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const clinicId = await getCurrentClinicId()
    if (!clinicId) return NextResponse.json({ error: '院情報が見つかりません' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const sb = createServerClient()
    const { error } = await sb
      .from('vc_treatment_rules')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[treatment-rules] DELETE error:', err)
    return NextResponse.json({ error: 'ルールの削除に失敗しました' }, { status: 500 })
  }
}
