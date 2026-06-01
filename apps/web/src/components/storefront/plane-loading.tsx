import { Plane } from "lucide-react";
import type { CSSProperties } from "react";

export function PlaneLoading({
  className = "",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={`plane-loading ${className}`} role="status" aria-label={label}>
      <div className="plane-loading-particles" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>
      <div className="plane-loading-icon" aria-hidden="true">
        <Plane className="h-7 w-7 fill-white text-white" />
      </div>
    </div>
  );
}
