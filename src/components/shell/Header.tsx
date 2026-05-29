"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { cn, formatRelative } from "@/lib/utils";
import { IconBell, IconLogout, IconSearch, IconMenu } from "@/components/ui/Icons";
import { MENU } from "./Sidebar";
import { useToast } from "@/components/ui/Toast";

type Notif = {
  id: string;
  judul: string;
  pesan: string;
  link: string | null;
  dibaca: boolean;
  createdAt: string;
};

export function Header({ user, title }: { user: SessionUser; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [openNotif, setOpenNotif] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [openMobileNav, setOpenMobileNav] = useState(false);
  const [q, setQ] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setNotifs(data.data.items);
        setUnread(data.data.unreadCount);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setOpenNotif(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpenMenu(false);
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node))
        setOpenMobileNav(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const logout = async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      toast.success("Berhasil logout");
      router.push("/login");
      router.refresh();
    } else toast.error("Gagal logout");
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/tracking?q=${encodeURIComponent(q.trim())}`);
  };

  const initials = user.nama
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-ink-200 flex items-center px-4 sm:px-6 gap-3 sticky top-0 z-30">
      <div className="lg:hidden flex items-center gap-3">
        <div ref={mobileNavRef} className="relative">
          <button
            onClick={() => setOpenMobileNav((v) => !v)}
            className="p-1.5 -ml-1.5 rounded-lg text-ink-600 hover:bg-ink-100"
            aria-label="Menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          {openMobileNav && (
            <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-premium ring-1 ring-ink-200 overflow-hidden animate-fadeIn py-2 max-h-[80vh] overflow-y-auto">
              <div className="px-4 py-2 border-b border-ink-100 mb-2">
                <p className="font-semibold text-brand-800 text-sm">TIARA E-Office</p>
              </div>
              {MENU.map((section) => {
                const visibleItems = section.items.filter((i) => !i.roles || i.roles.includes(user.role));
                if (visibleItems.length === 0) return null;
                return (
                  <div key={section.section} className="mb-2">
                    <p className="px-4 text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
                      {section.section}
                    </p>
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMobileNav(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 hover:text-brand-700 transition"
                        >
                          <Icon className="h-4 w-4 text-ink-400" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Link
          href="/dashboard"
          className="font-semibold text-brand-800"
          title="E-Office TIARA"
        >
          TIARA
        </Link>
      </div>
      <h1 className="text-base font-semibold text-ink-900 hidden sm:block">
        {title}
      </h1>

      <form
        onSubmit={onSubmitSearch}
        className="ml-auto flex-1 max-w-md hidden md:block"
      >
        <div className="relative">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor agenda / kode verifikasi / tracking..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-ink-50 ring-1 ring-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </form>

      <div className="ml-auto md:ml-0 flex items-center gap-2">
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setOpenNotif((v) => !v)}
            className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-ink-100 text-ink-600"
            aria-label="Notifikasi"
          >
            <IconBell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {openNotif && (
            <div className="absolute right-0 mt-2 w-[360px] bg-white rounded-xl shadow-premium ring-1 ring-ink-200 overflow-hidden animate-fadeIn">
              <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200">
                <p className="text-sm font-semibold text-ink-800">Notifikasi</p>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-brand-700 hover:underline"
                  >
                    Tandai semua dibaca
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-ink-500">
                    Tidak ada notifikasi.
                  </div>
                ) : (
                  notifs.map((n) => (
                    <Link
                      key={n.id}
                      href={n.link || "#"}
                      onClick={() => setOpenNotif(false)}
                      className={cn(
                        "block px-4 py-3 hover:bg-ink-50 border-b border-ink-100 last:border-0",
                        !n.dibaca && "bg-brand-50/40"
                      )}
                    >
                      <p className="text-sm font-medium text-ink-800">{n.judul}</p>
                      <p className="text-xs text-ink-600 mt-0.5 line-clamp-2">
                        {n.pesan}
                      </p>
                      <p className="text-[11px] text-ink-400 mt-1">
                        {formatRelative(n.createdAt)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpenMenu((v) => !v)}
            className="flex items-center gap-2.5 py-1 pl-1 pr-2.5 rounded-lg hover:bg-ink-100"
          >
            <div className="h-8 w-8 rounded-full bg-brand-700 text-white flex items-center justify-center text-xs font-semibold">
              {initials || "U"}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium text-ink-800 leading-tight">
                {user.nama}
              </p>
              <p className="text-[11px] text-ink-500 leading-tight">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </button>
          {openMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-premium ring-1 ring-ink-200 overflow-hidden animate-fadeIn">
              <div className="px-4 py-3 border-b border-ink-200">
                <p className="text-sm font-semibold text-ink-800">{user.nama}</p>
                <p className="text-xs text-ink-500">@{user.username}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setOpenMenu(false)}
                className="block px-4 py-2.5 text-sm hover:bg-ink-50 text-ink-700"
              >
                Pengaturan Akun
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-ink-50 text-red-600 border-t border-ink-200"
              >
                <IconLogout className="h-4 w-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
