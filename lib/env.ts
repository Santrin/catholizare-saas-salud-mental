import { z } from "zod";

const optionalUrlEnv = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);
const optionalStringEnv = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SENTRY_DSN: optionalUrlEnv,
  OPENAI_API_KEY: optionalStringEnv,
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  GOOGLE_CALENDAR_CLIENT_ID: optionalStringEnv,
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalStringEnv,
  GOOGLE_CALENDAR_REDIRECT_URI: optionalUrlEnv,
  ZOOM_CLIENT_ID: optionalStringEnv,
  ZOOM_CLIENT_SECRET: optionalStringEnv,
  ZOOM_REDIRECT_URI: optionalUrlEnv,
  INTEGRATION_TOKEN_ENCRYPTION_KEY: optionalStringEnv,
  RESEND_API_KEY: optionalStringEnv,
  RESEND_FROM_EMAIL: optionalStringEnv,
  CONSENT_REMINDER_CRON_SECRET: optionalStringEnv,
  CATHOLIZARE_LEGAL_EMAIL: z.string().email().default("catholizare@gmail.com")
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
    ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
    ZOOM_REDIRECT_URI: process.env.ZOOM_REDIRECT_URI,
    INTEGRATION_TOKEN_ENCRYPTION_KEY: process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    CONSENT_REMINDER_CRON_SECRET: process.env.CONSENT_REMINDER_CRON_SECRET,
    CATHOLIZARE_LEGAL_EMAIL: process.env.CATHOLIZARE_LEGAL_EMAIL
  });
}
