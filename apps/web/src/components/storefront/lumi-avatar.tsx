// Single source of truth for the Lumi avatar choices. /me renders the
// picker grid; the trip detail page reads the user's choice from
// Supabase user_metadata and hands it to LumiAssistant.

import Image from "next/image";

export const DEFAULT_LUMI_AVATAR_ID = "classic" as const;

export interface LumiAvatarOption {
  id: string;
  label: string;
  src: string;
  bg: string;
}

// The four Lumi looks. Source files live in
// apps/web/public/lumi-avatars/*.png — Next/Image serves optimized webp.
export const LUMI_AVATARS: LumiAvatarOption[] = [
  {
    id: "classic",
    label: "極簡幾何",
    src: "/lumi-avatars/classic.png",
    bg: "linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)",
  },
  {
    id: "cute",
    label: "極簡可愛",
    src: "/lumi-avatars/cute.png",
    bg: "linear-gradient(135deg, #E0F7F4 0%, #C9F1D9 100%)",
  },
  {
    id: "explorer",
    label: "冒險飛行",
    src: "/lumi-avatars/explorer.png",
    bg: "linear-gradient(135deg, #FFE9C7 0%, #C9F1D9 100%)",
  },
  {
    id: "photographer",
    label: "探險攝影",
    src: "/lumi-avatars/photographer.png",
    bg: "linear-gradient(135deg, #F5E8D0 0%, #D2F3F0 100%)",
  },
];

export function getLumiAvatar(id: string | null | undefined): LumiAvatarOption {
  return (
    LUMI_AVATARS.find((a) => a.id === id) ??
    LUMI_AVATARS.find((a) => a.id === DEFAULT_LUMI_AVATAR_ID)!
  );
}

export function LumiAvatarChip({
  avatar,
  size = 32,
  active,
}: {
  avatar: LumiAvatarOption;
  size?: number;
  active?: boolean;
}) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: avatar.bg,
        boxShadow: active
          ? "0 0 0 3px var(--accent-soft), 0 0 0 4.5px var(--accent)"
          : "0 1px 2px rgba(0,0,0,0.12)",
      }}
    >
      <Image
        src={avatar.src}
        alt={avatar.label}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-cover"
        priority={size >= 36}
      />
    </span>
  );
}
