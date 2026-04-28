import { z } from "zod";

/**
 * Esquema de variables de entorno validadas con Zod.
 *
 * Toda variable debe estar declarada aquí y en `.env.example`.
 * Nunca leer `process.env` directamente fuera de este archivo.
 */
const envSchema = z.object({
  // Entorno
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase (público, seguro por RLS)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // Supabase (secreto — solo server)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Google OAuth (configurado en Supabase Auth, no se lee aquí directamente)
  // Se listan en .env.example para documentación

  // Resend (email transaccional)
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Catholizare Care (WordPress REST API)
  CATHOLIZARE_CARE_API_URL: z.string().url().optional(),

  // Webhook Amelia (firma compartida)
  AMELIA_WEBHOOK_SECRET: z.string().min(1).optional(),

  // URL pública del sitio
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
