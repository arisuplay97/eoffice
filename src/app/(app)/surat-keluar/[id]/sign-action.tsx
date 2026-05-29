"use client";

import { useState } from "react";
import { BsreSignModal } from "./sign-modal";
import { IconShield } from "@/components/ui/Icons";

export function BsreSignAction({ attachmentId }: { attachmentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary w-full justify-center bg-green-600 hover:bg-green-700 focus:ring-green-500 mt-3"
      >
        <IconShield className="h-4 w-4 mr-2" />
        Tanda Tangani BSrE
      </button>

      {open && (
        <BsreSignModal
          open={open}
          onClose={() => setOpen(false)}
          attachmentId={attachmentId}
        />
      )}
    </>
  );
}
