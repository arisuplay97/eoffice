"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifySearchClient() {
  const router = useRouter();
  const [kode, setKode] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kode.trim()) return;
    router.push(`/verify/${encodeURIComponent(kode.trim())}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
      <input
        className="input text-center sm:text-left font-mono text-sm uppercase"
        placeholder="TIARA-YYYYMMDD-ABCDEF"
        value={kode}
        onChange={(e) => setKode(e.target.value.toUpperCase())}
      />
      <button type="submit" className="btn-primary">
        Verifikasi
      </button>
    </form>
  );
}
