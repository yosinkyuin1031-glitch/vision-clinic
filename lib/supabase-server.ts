import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies — safely ignored when handled by proxy
          }
        },
      },
    }
  )
}

export async function getCurrentUser() {
  const sb = await createServerSupabase()
  const { data } = await sb.auth.getUser()
  return data.user
}

export async function getCurrentClinicId(): Promise<string | null> {
  try {
    const user = await getCurrentUser()
    if (!user) return null // 未ログイン時はデフォルト
    const claim = (user.app_metadata as any)?.clinic_id
    if (claim) return claim as string
    // Fallback: lookup by owner_user_id
    const sb = await createServerSupabase()
    const { data } = await sb.from('vc_clinics').select('id').eq('owner_user_id', user.id).maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
}
