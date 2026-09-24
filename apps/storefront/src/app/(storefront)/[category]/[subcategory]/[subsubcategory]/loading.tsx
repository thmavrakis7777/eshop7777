import { ListingSkeleton } from "@/components/ui/RouteSkeletons";

// Wraps page.tsx only; the layout.tsx beside it (the 404 check) stays outside.
export default function Loading() {
  return <ListingSkeleton />;
}
