import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'

const ALLOWED_FIELDS = ['name', 'description', 'instruction', 'category', 'difficulty', 'default_bpm', 'duration_sec', 'image_url', 'video_url']
const VALID_CATEGORIES = ['pursuit', 'saccade', 'convergence', 'peripheral', 'eye_stretch', 'balance', 'coordination', 'warmup']
const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'IDが不正です' }, { status: 400 })
    }

    const body = await req.json()

    // ホワイトリストフィルタ
    const updateData: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updateData[key] = body[key]
    }

    // バリデーション
    if (updateData.category && !VALID_CATEGORIES.includes(updateData.category as string)) {
      return NextResponse.json({ error: 'カテゴリが不正です' }, { status: 400 })
    }
    if (updateData.difficulty && !VALID_DIFFICULTIES.includes(updateData.difficulty as string)) {
      return NextResponse.json({ error: '難易度が不正です' }, { status: 400 })
    }
    if (updateData.duration_sec != null) {
      const sec = Number(updateData.duration_sec)
      if (isNaN(sec) || sec < 1 || sec > 3600) {
        return NextResponse.json({ error: '実施秒数は1〜3600の範囲で入力してください' }, { status: 400 })
      }
      updateData.duration_sec = sec
    }
    if (updateData.default_bpm != null) {
      if (updateData.default_bpm === null || updateData.default_bpm === '') {
        updateData.default_bpm = null
      } else {
        const bpm = Number(updateData.default_bpm)
        if (isNaN(bpm) || bpm < 1 || bpm > 300) {
          return NextResponse.json({ error: 'BPMは1〜300の範囲で入力してください' }, { status: 400 })
        }
        updateData.default_bpm = bpm
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '更新するデータがありません' }, { status: 400 })
    }

    const sb = createServerClient()
    const { data, error } = await sb.from('vision_exercises').update(updateData).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[exercises PATCH]', err)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
