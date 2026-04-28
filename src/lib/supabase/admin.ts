import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Cliente de Supabase con SERVICE ROLE — bypasea RLS.
 *
 * USO RESTRINGIDO: solo en Route Handlers y Server Actions protegidos,
 * cuando es estrictamente necesario (webhooks de terceros, jobs del sistema).
 *
 * NUNCA exponer al browser.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
