import { CheckoutSkeleton } from "@/components/ui/RouteSkeletons";

// In the (index) group so it doesn't also cover checkout/epibebaiosi, the order
// confirmation, which would otherwise flash this page's heading. The empty-
// cart redirect in page.tsx now runs after this streams, so it lands as a
// client-side redirect instead of a 307 — fine for a noindex checkout page.
export default function Loading() {
  return <CheckoutSkeleton />;
}
