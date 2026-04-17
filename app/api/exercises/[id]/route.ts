import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const sb = createServerClient()
    const { data, error } = await sb.from('vision_exercises').update(body).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
