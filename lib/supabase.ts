import { createClient } from '@supabase/supabase-js'

// Server-side admin client (RLSをバイパス、APIルート専用)
export const createServerClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Browser client (レガシー互換用 — 新規コードは supabase-browser.ts を使用)
export { createClient as createSupabaseClient } from '@supabase/supabase-js'
