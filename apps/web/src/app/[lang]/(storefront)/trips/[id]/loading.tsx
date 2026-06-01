import { PlaneLoading } from "@/components/storefront/plane-loading";

export default function TripDetailLoading() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center">
      <PlaneLoading label="Loading trip" />
    </div>
  );
}
