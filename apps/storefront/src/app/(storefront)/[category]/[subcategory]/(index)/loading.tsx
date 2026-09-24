import { ListingSkeleton } from "@/components/ui/RouteSkeletons";

// In the (index) group for the same reason as [category]/(index)/loading.tsx.
export default function Loading() {
  return <ListingSkeleton />;
}
