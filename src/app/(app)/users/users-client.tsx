"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconSearch } from "@/components/ui/Icons";
import { ROLE_LABEL, ROLE_OPTIONS } from "@/lib/constants";
import type { Role } from "@prisma/client";

type User = {
  id: string;
  username: string;
  nama: string;
  email: string | null;
  jabatan: string | null;
  nip: string | null;
  role: Role;
  aktif: boolean;
  unit: { id: string; nama: string; kode: string } | null;
  createdAt: string;
};
type Unit = { id: string; nama: string; kode: string };

export default function UsersClient({
  currentUserId,
  users,
  units,
}: {
  currentUserId: string;
  users: User[];
  units: Unit[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [openForm, setOpenForm] = useState<null | { mode: "create" } | { mode: "edit"; user: User }>(null);
  const [openPwd, setOpenPwd] = useState<null | User>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (q) {
        const s = q.toLowerCase();
        if (
          !u.nama.toLowerCase().includes(s) &&
          !u.username.toLowerCase().includes(s) &&
          !(u.jabatan || "").toLowerCase().includes(s)
        )
          return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      if (unitFilter && u.unit?.id !== unitFilter) return false;
      return true;
    });
  }, [users, q, roleFilter, unitFilter]);

  const toggleActive = async (u: User) => {
    if (u.id === currentUserId) {
      toast.error("Tidak dapat menonaktifkan diri sendiri");
      return;
    }
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: !u.aktif }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(u.aktif ? "User dinonaktifkan" : "User diaktifkan");
      router.refresh();
    } else toast.error(data.error || "Gagal");
  };

  return (
    <>
      <PageHeader
        title="Manajemen User"
        subtitle="Kelola akun, role, unit/bidang, dan jabatan pegawai."
        action={
          <button className="btn-primary" onClick={() => setOpenForm({ mode: "create" })}>
            <IconPlus className="h-4 w-4" /> Tambah User
          </button>
        }
      />

      <div className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 relative">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Cari nama / username / jabatan..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Semua Role</option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="select" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
          <option value="">Semua Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nama}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty
          title="Tidak ada user"
          description="Tidak ditemukan user yang sesuai filter."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Nama / Username</TH>
              <TH>Jabatan</TH>
              <TH>Role</TH>
              <TH>Unit</TH>
              <TH>Status</TH>
              <TH className="text-right">Aksi</TH>
            </tr>
          </THead>
          <tbody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-xs font-semibold">
                      {u.nama
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-ink-900">{u.nama}</p>
                      <p className="text-xs text-ink-500 font-mono">@{u.username}</p>
                    </div>
                  </div>
                </TD>
                <TD className="text-xs">{u.jabatan || "-"}</TD>
                <TD>
                  <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                    {ROLE_LABEL[u.role]}
                  </span>
                </TD>
                <TD className="text-xs">{u.unit?.nama || "-"}</TD>
                <TD>
                  <span
                    className={`chip ${
                      u.aktif
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-red-50 text-red-700 ring-red-200"
                    }`}
                  >
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </TD>
                <TD className="text-right">
                  <div className="inline-flex items-center gap-1 text-xs">
                    <button
                      className="text-brand-700 hover:text-brand-800 font-medium px-2 py-1"
                      onClick={() => setOpenForm({ mode: "edit", user: u })}
                    >
                      Edit
                    </button>
                    <button
                      className="text-ink-600 hover:text-ink-900 font-medium px-2 py-1"
                      onClick={() => setOpenPwd(u)}
                    >
                      Reset Password
                    </button>
                    <button
                      className={`font-medium px-2 py-1 ${
                        u.aktif
                          ? "text-red-600 hover:text-red-700"
                          : "text-emerald-600 hover:text-emerald-700"
                      }`}
                      onClick={() => toggleActive(u)}
                      disabled={u.id === currentUserId}
                    >
                      {u.aktif ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {openForm && (
        <UserFormModal
          units={units}
          mode={openForm.mode}
          user={openForm.mode === "edit" ? openForm.user : undefined}
          onClose={() => setOpenForm(null)}
          onDone={() => {
            setOpenForm(null);
            toast.success(openForm.mode === "edit" ? "User diperbarui" : "User dibuat");
            router.refresh();
          }}
        />
      )}

      {openPwd && (
        <ResetPasswordModal
          user={openPwd}
          onClose={() => setOpenPwd(null)}
          onDone={() => {
            setOpenPwd(null);
            toast.success("Password direset");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function UserFormModal({
  mode,
  user,
  units,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  user?: User;
  units: Unit[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: user?.username || "",
    password: "",
    nama: user?.nama || "",
    email: user?.email || "",
    jabatan: user?.jabatan || "",
    nip: user?.nip || "",
    role: user?.role || ("STAF" as Role),
    unitId: user?.unit?.id || "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let res: Response;
      if (mode === "create") {
        if (!form.password || form.password.length < 6) {
          toast.error("Password minimal 6 karakter");
          setSaving(false);
          return;
        }
        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        const { password, username, ...rest } = form as any;
        res = await fetch(`/api/users/${user!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rest),
        });
      }
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal menyimpan");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Tambah User" : `Edit User - ${user!.nama}`}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button form="user-form" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            required
            disabled={mode === "edit"}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        {mode === "create" && (
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 6 karakter"
            />
          </div>
        )}
        <div className={mode === "create" ? "" : "sm:col-span-2"}>
          <label className="label">Nama Lengkap</label>
          <input
            className="input"
            required
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Jabatan</label>
          <input
            className="input"
            value={form.jabatan}
            onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
          />
        </div>
        <div>
          <label className="label">NIP (opsional)</label>
          <input
            className="input"
            value={form.nip}
            onChange={(e) => setForm({ ...form, nip: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="select"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Unit / Bidang</label>
          <select
            className="select"
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
          >
            <option value="">-- Tidak ada unit --</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Gagal");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset Password - ${user.nama}`}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Batal
          </button>
          <button form="pwd-form" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Reset"}
          </button>
        </>
      }
    >
      <form id="pwd-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-600">
          Reset password untuk <span className="font-semibold">@{user.username}</span>. User akan diminta masuk ulang dengan password baru.
        </p>
        <div>
          <label className="label">Password Baru</label>
          <input
            type="text"
            className="input font-mono"
            required
            minLength={6}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Min. 6 karakter"
          />
        </div>
      </form>
    </Modal>
  );
}
