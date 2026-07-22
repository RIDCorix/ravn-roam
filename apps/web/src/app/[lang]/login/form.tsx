"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  lang,
  labels,
  next,
  initialError,
}: {
  lang: string;
  labels: {
    email: string;
    password: string;
    sign_in: string;
    sign_up: string;
    signing_in: string;
    signing_up: string;
    auth_unreachable: string;
  };
  next?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function go(mode: "in" | "up") {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, mode }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: unknown;
      } | null;

      if (!response.ok || payload?.ok === false || payload?.error) {
        setError(authErrorMessage(payload?.error, labels.auth_unreachable));
        return;
      }
      router.replace(next ?? `/${lang}/trips`);
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err, labels.auth_unreachable));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void go("in");
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-fg-secondary">{labels.email}</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-xl border border-divider-strong bg-white px-3.5 text-[14px] outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-fg-secondary">{labels.password}</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl border border-divider-strong bg-white px-3.5 text-[14px] outline-none focus:border-accent"
        />
      </label>

      {error && (
        <div className="rounded-lg bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12.5px] text-[#b91c1c]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-fg text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {busy ? labels.signing_in : labels.sign_in}
      </button>
      <button
        type="button"
        onClick={() => void go("up")}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center rounded-xl border border-divider-strong bg-white text-[14px] font-semibold text-fg transition-opacity disabled:opacity-60"
      >
        {busy ? labels.signing_up : labels.sign_up}
      </button>
    </form>
  );
}

function authErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") {
    return err === "Failed to fetch" || err === "fetch failed" ? fallback : err;
  }
  if (!(err instanceof Error)) return fallback;
  if (err.message === "Failed to fetch" || err.message === "fetch failed") return fallback;
  return err.message || fallback;
}
