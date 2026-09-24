import { CartSkeleton } from "@/components/ui/RouteSkeletons";

// Speed audit SPD-04: instant feedback on the tap into the cart page.
export default function Loading() {
  return <CartSkeleton />;
}
