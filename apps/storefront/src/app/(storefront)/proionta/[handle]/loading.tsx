import { ProductPageSkeleton } from "@/components/ui/RouteSkeletons";

// Below layout.tsx on purpose — see the note there on keeping real 404s.
export default function Loading() {
  return <ProductPageSkeleton />;
}
