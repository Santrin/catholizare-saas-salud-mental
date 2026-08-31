"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const seenKeysSchema = z.array(z.string().min(3).max(1000)).max(100);

export async function markProfessionalResourcesSeenAction(keys: string[]) {
  const profile = await getCurrentProfile();
  const parsed = seenKeysSchema.safeParse(keys);

  if (
    !profile ||
    profile.role !== "profesional" ||
    profile.account_status !== "activo" ||
    !parsed.success ||
    parsed.data.length === 0
  ) {
    return;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("professional_resource_seen_items").upsert(
    parsed.data.map((contentKey) => ({
      professional_id: profile.id,
      content_key: contentKey,
      seen_at: new Date().toISOString()
    })),
    { onConflict: "professional_id,content_key" }
  );

  if (error) {
    Sentry.captureException(error, {
      extra: { context: "professional_resources_mark_seen", resource_count: parsed.data.length }
    });
  }
}
