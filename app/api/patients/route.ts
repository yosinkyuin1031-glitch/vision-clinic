import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, getCurrentClinicId } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const sb = await createServerSupabase()
  const { data, error } = await sb.from('vc_patients').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabase()
  const clinicId = await getCurrentClinicId()
  const { name, age, gender, phone, occupation, wears_glasses } = await req.json()
  if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
  const insertData: Record<string, unknown> = { name, age, gender, phone, occupation, wears_glasses }
  if (clinicId) insertData.clinic_id = clinicId
  const { data, error } = await sb.from('vc_patients').insert(insertData).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
