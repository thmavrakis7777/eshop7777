import { ListingSkeleton } from "@/components/ui/RouteSkeletons";

// Search results render through CategoryPLPView, so they share its skeleton.
export default function Loading() {
  return <ListingSkeleton />;
}
