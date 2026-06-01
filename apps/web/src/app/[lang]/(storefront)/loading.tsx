import { PlaneLoading } from "@/components/storefront/plane-loading";

export default function StorefrontLoading() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center">
      <PlaneLoading label="Loading" />
    </div>
  );
}
