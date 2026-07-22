"use client";

import type * as React from "react";

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function StorefrontTabs({
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return <Tabs className={cn("gap-0", className)} {...props} />;
}

function StorefrontTabsList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsList>, "variant">) {
  return (
    <TabsList
      variant="line"
      className={cn(
        "h-10 border-0 bg-transparent p-0 text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

function StorefrontTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "h-full flex-none rounded-none border-0 bg-transparent px-0 text-[14px] font-semibold text-fg-muted shadow-none hover:text-fg focus-visible:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-fg data-[state=active]:shadow-none after:bottom-0 after:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export { StorefrontTabs, StorefrontTabsList, StorefrontTabsTrigger };
