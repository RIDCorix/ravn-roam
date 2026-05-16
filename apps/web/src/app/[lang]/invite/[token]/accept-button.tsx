"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInviteButton({
  lang,
  token,
  labels,
}: {
  lang: string;
  token: string;
  labels: {
    join: string;
    joining: string;
    already_joined: string;
    invalid: string;
    joined_done: string;
    go_to_trip: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { tripId: string }>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 409) setError(labels.already_joined);
        else if (res.status === 404) setError(labels.invalid);
        else setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { companion: { trip_id: string } };
      setDone({ tripId: data.companion.trip_id });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-accent-soft px-3 py-2 text-center text-[13px] font-semibold text-accent">
          {labels.joined_done}
        </div>
        <button
          type="button"
          onClick={() => {
            router.push(`/${lang}/trips/${done.tripId}`);
            router.refresh();
          }}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-fg text-[13px] font-semibold text-white"
        >
          {labels.go_to_trip}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void accept()}
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-fg text-[13px] font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {busy ? labels.joining : labels.join}
      </button>
      {error && (
        <div className="rounded-lg bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12px] text-[#b91c1c]">
          {error}
        </div>
      )}
    </div>
  );
}
