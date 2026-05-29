"use client";

// Trigger + Dialog wrapper around <VendorForm mode="create">. Replaces
// the /admin/vendors/new page so creating a vendor doesn't pull the user
// off the list view.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { VendorForm } from "@/components/admin/vendor-form";
import type { AdminDict } from "@/components/admin/dict";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function VendorCreateDialog({
  lang,
  dict,
}: {
  lang: string;
  dict: AdminDict["admin"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          {dict.vendors.create}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dict.vendors.create}</DialogTitle>
          <DialogDescription>{dict.vendors.subtitle}</DialogDescription>
        </DialogHeader>
        <VendorForm
          lang={lang}
          mode="create"
          dict={dict}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
