// The dictionary type is a deep object — client components can't import the
// JSON directly (server-only), so we share the inferred type here and pass
// the resolved dict down as a prop.

import type en from "@/i18n/dictionaries/en.json";

export type AdminDict = typeof en;
