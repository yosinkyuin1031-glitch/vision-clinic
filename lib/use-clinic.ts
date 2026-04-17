'use client'
import { useEffect, useState } from 'react'
import { createClient } from './supabase-browser'

/**
 * 現在ログイン中のユーザーの clinic_id を返すフック
 * app_metadata.clinic_id を優先、なければ vc_clinics テーブルから解決
 * 未ログイン時はデフォルト値を返す（マルチテナント未有効化対応）
 */
export function useClinicId() {
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    let cancelled = false

    async function load() {
      try {
        const { data: { user } } = await sb.auth.getUser()
        if (!user) {
          // 未ログイン → デフォルトclinic_idを使用
          if (!cancelled) { setClinicId(null); setLoading(false) }
          return
        }
        const meta = (user.app_metadata as any)?.clinic_id
        if (meta) {
          if (!cancelled) { setClinicId(meta); setLoading(false) }
          return
        }
        const { data } = await sb.from('vc_clinics').select('id').eq('owner_user_id', user.id).maybeSingle()
        if (!cancelled) { setClinicId(data?.id ?? null); setLoading(false) }
      } catch {
        // エラー時もデフォルトで動作
        if (!cancelled) { setClinicId(null); setLoading(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { clinicId, loading }
}
