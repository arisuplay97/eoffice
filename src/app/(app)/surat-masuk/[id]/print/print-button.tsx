"use client";

import { IconPrinter } from "@/components/ui/Icons";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary text-sm">
      <IconPrinter className="h-4 w-4" /> Cetak
    </button>
  );
}
