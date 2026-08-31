import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { AuthProfile } from "@/lib/auth/types";
import { getProfessionalProDashboard } from "@/lib/pro/queries";
import type { ProfessionalProDashboard } from "@/lib/pro/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function resourceKey(url: string) {
  return `resource:${url}`.slice(0, 1000);
}

function eventKey(url: string | null, id: string) {
  return `event:${url ?? id}`.slice(0, 1000);
}

export function getResourceContentEntries(feed: ProfessionalProDashboard) {
  return [
    ...feed.resources.map((resource) => ({
      key: resourceKey(resource.url),
      id: resource.id,
      kind: "resource" as const
    })),
    ...feed.events.map((event) => ({
      key: eventKey(event.info_url ?? event.registration_url, event.id),
      id: event.id,
      kind: "event" as const
    }))
  ];
}

export async function getResourceNovelty(
  profile: AuthProfile,
  feed: ProfessionalProDashboard
) {
  const entries = getResourceContentEntries(feed);
  if (entries.length === 0) {
    return { count: 0, keys: [], resourceIds: [], eventIds: [] };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("professional_resource_seen_items")
    .select("content_key")
    .eq("professional_id", profile.id)
    .in("content_key", entries.map((entry) => entry.key));

  if (error) {
    throw new Error(`Unable to load professional resource novelty: ${error.message}`);
  }

  const seenKeys = new Set((data ?? []).map((row) => row.content_key as string));
  const unseen = entries.filter((entry) => !seenKeys.has(entry.key));

  return {
    count: unseen.length,
    keys: entries.map((entry) => entry.key),
    resourceIds: unseen.filter((entry) => entry.kind === "resource").map((entry) => entry.id),
    eventIds: unseen.filter((entry) => entry.kind === "event").map((entry) => entry.id)
  };
}

export async function getProfessionalResourceNotificationCount(profile: AuthProfile) {
  try {
    const feed = await getProfessionalProDashboard(profile, "resources", false);
    const novelty = await getResourceNovelty(profile, feed);
    return novelty.count;
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: "professional_resource_notification_count" }
    });
    return 0;
  }
}
