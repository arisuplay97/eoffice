"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

export default function SettingsAccountClient() {
  const toast = useToast();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) return toast.error("Password baru minimal 6 karakter");
    if (newPwd !== confirm) return toast.error("Konfirmasi password tidak cocok");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal mengganti password");
        return;
      }
      toast.success("Password berhasil diganti");
      setOldPwd("");
      setNewPwd("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3">
      <div>
        <label className="label">Password Lama</label>
        <input
          type="password"
          className="input"
          required
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Password Baru</label>
        <input
          type="password"
          className="input"
          required
          minLength={6}
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Konfirmasi Password</label>
        <input
          type="password"
          className="input"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div className="sm:col-span-3">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Menyimpan..." : "Ubah Password"}
        </button>
      </div>
    </form>
  );
}
