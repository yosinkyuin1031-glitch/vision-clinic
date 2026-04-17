import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentClinicId } from '@/lib/supabase-server'

// 施術提案ルール一覧取得
export async function GET() {
  try {
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
    const clinicId = await getCurrentClinicId()
    if (!clinicId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { trigger_eval, trigger_level, treatments, display_order } = body

    if (!trigger_eval || !trigger_level || !treatments?.length) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
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
    const clinicId = await getCurrentClinicId()
    if (!clinicId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { id, trigger_eval, trigger_level, treatments, display_order, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const sb = createServerClient()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (trigger_eval !== undefined) updateData.trigger_eval = trigger_eval
    if (trigger_level !== undefined) updateData.trigger_level = trigger_level
    if (treatments !== undefined) updateData.treatments = treatments
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_active !== undefined) updateData.is_active = is_active

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
    const clinicId = await getCurrentClinicId()
    if (!clinicId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

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
