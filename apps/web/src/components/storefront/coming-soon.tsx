// Tab placeholder. Used by trips / tasks / shop / me until their
// Phase C ports land. Keep this calm — design-system tone is "quiet,
// declarative, second-person" so no spinners, no marketing copy.

export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-accent"
        style={{ background: "var(--accent-soft)" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-[1.6] text-fg-secondary">
        {body}
      </p>
    </main>
  );
}
