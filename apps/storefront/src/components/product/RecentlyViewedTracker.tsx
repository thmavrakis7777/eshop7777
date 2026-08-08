"use client";

import { useEffect } from "react";
import { recordRecentlyViewed } from "@/lib/recently-viewed-storage";

export function RecentlyViewedTracker({ handle }: { handle: string }) {
  useEffect(() => {
    recordRecentlyViewed(handle);
  }, [handle]);

  return null;
}
