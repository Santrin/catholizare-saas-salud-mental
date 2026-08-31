"use client";

import { useEffect } from "react";

import { markProfessionalResourcesSeenAction } from "@/app/professional/resources/actions";

export function ResourceSeenMarker({ contentKeys }: { contentKeys: string[] }) {
  useEffect(() => {
    if (contentKeys.length > 0) {
      void markProfessionalResourcesSeenAction(contentKeys);
    }
  }, [contentKeys]);

  return null;
}
