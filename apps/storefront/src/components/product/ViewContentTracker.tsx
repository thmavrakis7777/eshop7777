"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/lib/analytics/track";

export function ViewContentTracker({ id, title, priceAmount }: { id: string; title: string; priceAmount: number }) {
  useEffect(() => {
    trackViewContent({ id, title, price: { amount: priceAmount } });
  }, [id, title, priceAmount]);

  return null;
}
