"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import {
  IconDashboard,
  IconInbox,
  IconOutbox,
  IconDisposisi,
  IconTracking,
  IconArsip,
  IconUsers,
  IconBuilding,
  IconSettings,
  IconDroplet,
} from "@/components/ui/Icons";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
};

export const MENU: { section: string; items: NavItem[] }[] = [
  {
    section: "Utama",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: IconDashboard },
      { label: "Surat Masuk", href: "/surat-masuk", icon: IconInbox },
      { label: "Surat Keluar", href: "/surat-keluar", icon: IconOutbox },
      { label: "Disposisi", href: "/disposisi", icon: IconDisposisi },
      { label: "Tracking Dokumen", href: "/tracking", icon: IconTracking },
      { label: "Arsip Digital", href: "/arsip", icon: IconArsip },
    ],
  },
  {
    section: "Administrasi",
    items: [
      {
        label: "Manajemen User",
        href: "/users",
        icon: IconUsers,
        roles: ["SUPER_ADMIN"],
      },
      {
        label: "Unit / Bidang",
        href: "/units",
        icon: IconBuilding,
        roles: ["SUPER_ADMIN"],
      },
      {
        label: "Pengaturan",
        href: "/settings",
        icon: IconSettings,
      },
    ],
  },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 bg-brand-900 text-white">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
        <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
          <IconDroplet className="h-5 w-5 text-brand-100" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-wide">E-Office TIARA</p>
          <p className="text-[11px] text-brand-200">PERUMDAM Tirta Ardhia Rinjani</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {MENU.map((section) => {
          const visibleItems = section.items.filter(
            (i) => !i.roles || i.roles.includes(role)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.section}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300 mb-2">
                {section.section}
              </p>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                          active
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-brand-100/90 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active ? "text-white" : "text-brand-200"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 text-[11px] text-brand-200 leading-relaxed">
        <p className="font-semibold text-white">TIARA</p>
        <p>Sistem Administrasi Persuratan</p>
        <p>Lombok Tengah &copy; {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
