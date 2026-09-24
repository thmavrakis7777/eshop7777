import { ListingSkeleton } from "@/components/ui/RouteSkeletons";

// In the (index) group, not [category]/, so it wraps only this page and never
// the deeper category layouts' 404 checks — see [category]/layout.tsx.
export default function Loading() {
  return <ListingSkeleton />;
}
