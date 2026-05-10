import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/shell/PageHeader";
import { formatDate, formatRelative } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import SettingsAccountClient from "./account-client";
import { IconShield, IconDroplet } from "@/components/ui/Icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = (await getSession())!;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { unit: true },
  });

  const company = await prisma.setting.findMany();
  const companyMap = Object.fromEntries(company.map((s) => [s.key, s.value]));

  return (
    <>
      <PageHeader
        title="Pengaturan"
        subtitle="Pengaturan akun dan informasi aplikasi."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-ink-800 mb-4">Profil Akun</h3>
            <div className="flex items-center gap-4 mb-5">
              <div className="h-16 w-16 rounded-2xl bg-brand-700 text-white flex items-center justify-center text-xl font-semibold">
                {user?.nama
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-base font-semibold text-ink-900">{user?.nama}</p>
                <p className="text-sm text-ink-500 font-mono">@{user?.username}</p>
                <p className="text-xs text-ink-500 mt-1">
                  {ROLE_LABEL[user!.role]} · {user?.unit?.nama || "Tanpa unit"}
                </p>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Jabatan" value={user?.jabatan || "-"} />
              <Row label="NIP" value={user?.nip || "-"} />
              <Row label="Email" value={user?.email || "-"} />
              <Row
                label="Unit / Bidang"
                value={user?.unit ? `${user.unit.nama} (${user.unit.kode})` : "-"}
              />
              <Row label="Bergabung Sejak" value={formatDate(user?.createdAt)} />
              <Row label="Terakhir Diperbarui" value={formatRelative(user?.updatedAt)} />
            </dl>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-ink-800 mb-4">Ganti Password</h3>
            <SettingsAccountClient />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                <IconDroplet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
                  Aplikasi
                </p>
                <p className="font-semibold text-ink-900">
                  {companyMap["app.name"] || "E-Office TIARA"}
                </p>
              </div>
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row
                inline
                label="Perusahaan"
                value={companyMap["company.name"] || "PERUMDAM Tirta Ardhia Rinjani"}
              />
              <Row
                inline
                label="Wilayah"
                value={companyMap["company.region"] || "Kabupaten Lombok Tengah"}
              />
              <Row inline label="Versi" value="1.0.0" />
            </dl>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <IconShield className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-ink-800">Keamanan</p>
            </div>
            <ul className="text-xs text-ink-600 space-y-1.5">
              <li>• Autentikasi JWT dengan signature HS256</li>
              <li>• Cookie session httpOnly + SameSite Lax</li>
              <li>• Password hashing dengan bcrypt</li>
              <li>• QR verifikasi dokumen HMAC-SHA256</li>
              <li>• Role-based access control</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  inline,
}: {
  label: string;
  value: React.ReactNode;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-baseline gap-3 justify-between">
        <dt className="text-xs text-ink-500">{label}</dt>
        <dd className="text-sm text-ink-800 font-medium text-right">{value}</dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-xs text-ink-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-ink-800 mt-0.5">{value}</dd>
    </div>
  );
}
