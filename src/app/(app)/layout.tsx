import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "surat-masuk": "Surat Masuk",
  "surat-keluar": "Surat Keluar",
  disposisi: "Disposisi",
  tracking: "Tracking Dokumen",
  arsip: "Arsip Digital",
  users: "Manajemen User",
  units: "Unit / Bidang",
  settings: "Pengaturan",
};

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: any;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  // Title: we derive via client (route segment). Simpler: pass a default.
  return (
    <div className="flex min-h-screen">
      <div className="no-print contents">
        <Sidebar role={user.role} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="no-print">
          <Header user={user} title="E-Office TIARA" />
        </div>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
