export function SignOutButton({ lang }: { lang: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-divider-strong bg-white text-[13px] font-semibold text-fg transition-colors hover:bg-[rgba(0,0,0,0.03)]"
      >
        {lang === "zh-TW" ? "登出" : "Sign out"}
      </button>
    </form>
  );
}
