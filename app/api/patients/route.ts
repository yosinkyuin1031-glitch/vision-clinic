import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, getCurrentUser, getCurrentClinicId } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const clinicId = await getCurrentClinicId()
  const sb = await createServerSupabase()

  let query = sb.from('vc_patients').select('*').order('created_at', { ascending: false })
  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const clinicId = await getCurrentClinicId()
  if (!clinicId) return NextResponse.json({ error: '院情報が見つかりません' }, { status: 403 })

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 100) return NextResponse.json({ error: '名前は1〜100文字で入力してください' }, { status: 400 })

  const age = body.age != null ? Number(body.age) : null
  if (age != null && (isNaN(age) || age < 0 || age > 150)) {
    return NextResponse.json({ error: '年齢が不正です' }, { status: 400 })
  }

  const GENDERS = ['male', 'female', 'other', '', null]
  const gender = GENDERS.includes(body.gender) ? (body.gender || null) : null

  const sb = await createServerSupabase()
  const { data, error } = await sb.from('vc_patients').insert({
    name,
    age,
    gender,
    phone: typeof body.phone === 'string' ? body.phone.slice(0, 20) : null,
    occupation: typeof body.occupation === 'string' ? body.occupation.slice(0, 50) : null,
    wears_glasses: body.wears_glasses === true,
    clinic_id: clinicId,
  }).select().single()

  if (error) return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  return NextResponse.json({ data })
}
