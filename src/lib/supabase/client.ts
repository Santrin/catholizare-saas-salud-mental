import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Cliente de Supabase para uso en Client Components (browser).
 * Usa la ANON KEY pública — la seguridad depende de RLS.
 */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
