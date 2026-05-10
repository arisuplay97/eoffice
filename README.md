# E-Office TIARA

**Sistem Administrasi Persuratan, Disposisi, Tracking Dokumen, dan Arsip Digital**
untuk PERUMDAM Tirta Ardhia Rinjani, Kabupaten Lombok Tengah.

Dibangun dengan **Next.js 14 App Router**, **TypeScript**, **Tailwind CSS**, **Prisma**, **PostgreSQL**, **Vercel Blob**.

---

## Fitur Utama

- **Login aman** — JWT HS256, cookie `httpOnly`, rate limit & lockout, audit trail.
- **Dashboard** — statistik, tren bulanan, distribusi per unit.
- **Surat Masuk** — CRUD, nomor agenda otomatis `AGD/YYYY/MM/0001`, QR, cetak lembar disposisi.
- **Surat Keluar** — CRUD, nomor otomatis `TAR/UNIT/YYYY/MM/0001`, status progression.
- **Disposisi berjenjang** — timeline, teruskan, selesaikan, upload bukti tindak lanjut.
- **Tracking Dokumen** — timeline vertikal/horizontal, pulse animation, indikator terlambat.
- **QR Verifikasi Publik** — `/verify/[kode]`, signature HMAC-SHA256, hanya metadata aman.
- **Arsip Digital** — filter + export Excel.
- **Manajemen User & Unit** — RBAC ketat.
- **Audit Log** — seluruh aktivitas penting dicatat.

---

## Keamanan

E-Office TIARA diperkuat dengan kontrol berlapis terhadap ancaman OWASP umum:

| Ancaman | Mitigasi |
|---|---|
| **SQL Injection** | 100% Prisma parameterized queries. Tidak ada raw SQL dari input user. |
| **XSS** | React auto-escape + sanitasi input `cleanText()` + CSP `script-src 'self'`. Tidak ada `dangerouslySetInnerHTML`. |
| **CSRF** | Cookie `httpOnly` + `SameSite=Lax` + `Secure` (prod) + `assertSameOrigin()` pada semua mutation API. |
| **Brute Force Login** | Rate limit 5 attempt/15 menit per (IP+username), lockout 15 menit, pesan error generik, timing-safe bcrypt compare (dummy hash untuk username tidak ada). |
| **IDOR / BOLA** | Ownership check di backend untuk setiap entity: `canViewSuratMasuk`, `canViewSuratKeluar`, `canViewDisposisi`, `canMutateDisposisi`. Frontend tidak pernah menjadi otoritas. |
| **Privilege Escalation** | Role dibaca dari JWT (server-signed), bukan body request. Tidak bisa edit role diri sendiri. Halaman admin dibungkus server-side guard + middleware. |
| **File Upload Attack** | Whitelist MIME (PDF, JPG, PNG), whitelist ekstensi, magic-byte sniff, ukuran ≤ 10 MB, filename random (crypto), stored di Vercel Blob (prod). Akses file lewat `/api/files/[id]` dengan RBAC, tidak pernah expose storage URL langsung. |
| **Path Traversal** | Middleware menolak `..` & `%2e%2e`. Download API tidak terima path dari user — hanya attachment `id`, lalu baca dari Blob/filesystem. |
| **Open Redirect** | Parameter `?next=` pada login divalidasi: hanya path internal (mulai `/`, bukan `//`, bukan scheme, tidak mengandung `..`). |
| **Data Leakage** | `/verify/[kode]` hanya menampilkan metadata minimal; surat rahasia menampilkan `[Dirahasiakan]`; surat keluar draft tidak dianggap valid. API list scope per role/unit. Stack trace tidak ditampilkan di production. |
| **Clickjacking** | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. |
| **MIME sniffing** | `X-Content-Type-Options: nosniff`. |
| **Cookie theft** | Secret cookies `httpOnly` + `Secure` (prod) + `SameSite=Lax`. |
| **Transport downgrade** | `Strict-Transport-Security` preload di production. |

### Audit Log

Setiap aktivitas penting dicatat di tabel `AuditLog` (userId, action, entityType, entityId, ipAddress, userAgent, description, createdAt). Lihat `src/lib/audit.ts` untuk daftar action yang dilacak — antara lain: LOGIN_SUCCESS, LOGIN_FAIL, LOGIN_LOCKED, PASSWORD_CHANGED, ROLE_CHANGED, SURAT_MASUK_CREATED, DISPOSISI_FORWARDED, FILE_DOWNLOADED, QR_VERIFY_OPENED, ACCESS_DENIED, RATE_LIMITED.

### Password Policy

- Minimal **8 karakter**, wajib mengandung huruf dan angka.
- Hashing **bcrypt cost 12**.
- Admin yang baru dibuat otomatis `mustChangePassword = true`.

---

## Role & Akses

| Role | Hak Akses |
|---|---|
| `SUPER_ADMIN` | Semua fitur, manajemen user & unit, melihat semua data. |
| `DIREKSI` | Dashboard, menerima & membuat disposisi, lihat semua disposisi. |
| `SEKRETARIAT` | Input surat masuk/keluar, upload dokumen, disposisi awal, mengarsipkan. |
| `KEPALA_BAGIAN` | Menerima & meneruskan disposisi, akses surat di unitnya. |
| `STAF` | Menerima tugas, upload bukti tindak lanjut, menyelesaikan disposisi. |
| `VIEWER` | Read-only sesuai izin. |

RBAC ditegakkan di dua level:
1. **UI layer** — menyembunyikan tombol/menu.
2. **Backend layer** — setiap API route memvalidasi session + role + ownership. UI hanya kosmetik.

---

## Prasyarat

- **Node.js** ≥ 18.17
- **PostgreSQL** ≥ 13
- Akun Vercel + Vercel Blob untuk production (opsional di dev).

---

## 1. Instalasi

```bash
git clone <repo-url> eoffice-tiara
cd eoffice-tiara
npm install
```

## 2. Konfigurasi Environment

Salin `.env.example` → `.env.local` dan isi:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eoffice_tiara?schema=public"
JWT_SECRET="ganti-dengan-random-48-karakter"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Opsional di dev; WAJIB di Vercel:
BLOB_READ_WRITE_TOKEN=
```

Generate JWT secret yang aman:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **PENTING:** `JWT_SECRET` dipakai untuk JWT session **dan** HMAC signature QR verifikasi. Sekali deploy, **jangan diubah** — perubahan akan menginvalidasi signature seluruh dokumen yang sudah terbit.

## 3. Siapkan Database

```bash
createdb eoffice_tiara
npx prisma migrate dev --name init
```

## 4. Seed Data

```bash
npm run db:seed
```

Membuat:
- 21 unit/bidang, 6 akun default, 2 contoh surat masuk + disposisi, 1 surat keluar, counter & settings.

### ⚠️ Akun Default — HANYA untuk Development

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | SUPER_ADMIN |
| `direktur` | `password123` | DIREKSI |
| `sekretariat` | `password123` | SEKRETARIAT |
| `kabag.teknik` | `password123` | KEPALA_BAGIAN |
| `kabag.keuangan` | `password123` | KEPALA_BAGIAN |
| `staf.teknik` | `password123` | STAF |

Semua akun seed di-flag `mustChangePassword`. **WAJIB diganti setelah login pertama.** Seed terblokir di production kecuali `ALLOW_PROD_SEED=1` diset secara eksplisit.

## 5. Jalankan Development

```bash
npm run dev
```

Buka http://localhost:3000

---

## Deploy Production (Vercel)

### Langkah

1. **Push** repo ke GitHub.
2. **Import** project di Vercel. Set Framework Preset: Next.js.
3. **Build command** sudah otomatis: `prisma generate && next build`.
4. **Postinstall**: `prisma generate` (sudah diset di `package.json`).

### Environment Variables (Vercel)

Tambahkan di **Settings → Environment Variables**:

| Key | Value | Scope |
|---|---|---|
| `DATABASE_URL` | Connection string Postgres (gunakan **pooled** untuk serverless, mis. Neon/Supabase pooler atau Vercel Postgres) | Production, Preview, Development |
| `JWT_SECRET` | String random ≥ 48 karakter | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://eoffice.tiara.co.id` (URL publik Anda) | Production, Preview |
| `BLOB_READ_WRITE_TOKEN` | Auto-generated saat Anda create Vercel Blob Store | Production, Preview |
| `ALLOWED_ORIGINS` | (opsional) csv domain tambahan yang diizinkan CSRF | Production |

### Vercel Blob (Wajib Production)

Filesystem Vercel bersifat read-only/ephemeral. File upload **tidak boleh** disimpan ke local disk di production.

1. Vercel Dashboard → **Storage → Create → Blob**.
2. Token `BLOB_READ_WRITE_TOKEN` otomatis ditambahkan ke env project.
3. Kode sudah mendeteksi token ini dan beralih ke Blob secara otomatis.

### Migrasi Database Production

```bash
# Lakukan dari mesin CI atau lokal dengan DATABASE_URL production.
npm run db:deploy   # = prisma migrate deploy
```

### Seed Admin Production

**Jangan** jalankan seed default di production. Buat admin pertama lewat script yang Anda jaga ketat:

```bash
# Opsi 1 - Skrip interaktif (direkomendasikan)
# Buat file script sendiri berdasarkan prisma/seed.ts
# yang hanya membuat 1 admin dengan password dari env.

# Opsi 2 - Force (tidak disarankan)
NODE_ENV=production ALLOW_PROD_SEED=1 npm run db:seed
# Setelah itu LANGSUNG login & ganti semua password.
```

### Checklist Sebelum Go-Live

- [ ] `JWT_SECRET` ≥ 48 karakter, berbeda antara env.
- [ ] `NEXT_PUBLIC_APP_URL` sesuai domain production.
- [ ] `BLOB_READ_WRITE_TOKEN` terpasang.
- [ ] Password semua seed account sudah diganti.
- [ ] Custom domain dikonfigurasi & HTTPS aktif (HSTS headers aktif otomatis).
- [ ] `ALLOW_PROD_SEED` **tidak diset** permanen.
- [ ] Database production punya backup rutin.
- [ ] `DATABASE_URL` menggunakan SSL (`?sslmode=require`).

---

## Perintah Umum

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Build produksi. |
| `npm run start` | Jalankan server produksi. |
| `npm run lint` | Lint. |
| `npm run db:migrate` | Buat migration baru (dev). |
| `npm run db:deploy` | Apply migration di produksi. |
| `npm run db:push` | Push schema tanpa migration (dev). |
| `npm run db:seed` | Seed (tertolak di prod tanpa flag). |
| `npm run db:reset` | **BAHAYA** — reset DB & seed ulang (dev only). |

---

## Struktur Proyek

```
eoffice/
├── prisma/
│   ├── schema.prisma         # User, Unit, SuratMasuk/Keluar, Disposisi,
│   │                         # TrackingLog, Attachment, Notification,
│   │                         # AuditLog, LoginAttempt, Counter, Setting
│   └── seed.ts
├── public/
│   └── uploads/              # Dev fallback (di middleware blocked dari HTTP)
├── src/
│   ├── app/
│   │   ├── (app)/            # Authenticated pages
│   │   ├── api/
│   │   │   ├── auth/         # login, logout, me, change-password
│   │   │   ├── files/[id]/   # Protected download (RBAC)
│   │   │   ├── verify/[kode] # Public QR verification
│   │   │   └── ...           # surat-masuk, surat-keluar, disposisi, users,
│   │   │                     # units, notifications, tracking, arsip/export, qr
│   │   ├── login/
│   │   └── verify/           # Public verify landing + detail
│   ├── components/
│   ├── lib/
│   │   ├── prisma.ts         # Prisma singleton
│   │   ├── auth.ts           # JWT signing, session cookie
│   │   ├── security.ts       # assertSameOrigin, cleanText,
│   │   │                     # RBAC helpers (canView*, canMutate*)
│   │   ├── rate-limit.ts     # Login throttling + lockout
│   │   ├── audit.ts          # AuditLog helper
│   │   ├── storage.ts        # Vercel Blob / local storage + validation
│   │   └── codes.ts          # Nomor agenda, kode verifikasi, HMAC
│   └── middleware.ts         # Auth + path traversal + uploads block
├── .env.example
├── next.config.js            # Security headers + CSP
└── README.md
```

---

## Penomoran & Signature

- **Nomor Agenda**: `AGD/YYYY/MM/0001` — counter per bulan (`Counter` table, atomic `increment`).
- **Nomor Surat Keluar**: `TAR/UNIT/YYYY/MM/0001` — counter per unit per bulan.
- **Kode Verifikasi**: `TIARA-YYYYMMDD-XXXXXX` (6 hex uppercase).
- **Signature**: HMAC-SHA256(`nomor|kode`, `JWT_SECRET`) dipotong 32 char. Diverifikasi saat QR dibuka.

---

## Testing Keamanan (Checklist Manual)

| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | Buka `/dashboard` tanpa login | Redirect ke `/login?next=/dashboard` |
| 2 | Role `VIEWER` akses POST `/api/surat-masuk` | 403 Forbidden |
| 3 | Role `STAF` akses `/users` | Redirect ke `/dashboard` |
| 4 | User unit A buka detail surat unit B (via IDOR URL) | 404/403, akses ditolak |
| 5 | Upload `.html`, `.exe`, `.svg` | Ditolak sebelum simpan |
| 6 | Upload PDF palsu (rename `.pdf` dari `.exe`) | Ditolak (magic-byte sniff) |
| 7 | Upload file > 10 MB | Ditolak |
| 8 | Buka `/verify/INVALID-CODE` | Halaman aman "Tidak valid / tidak ditemukan" |
| 9 | Cek DB: kolom `password` | Hash bcrypt (`$2a$12$...`) |
| 10 | 5× login gagal | Lockout 15 menit + audit `LOGIN_LOCKED` |
| 11 | Login dengan `?next=https://evil.com` | Redirect tetap ke `/dashboard` (open redirect diblok) |
| 12 | Akses `/uploads/anyfile.pdf` langsung | 404 (middleware blocks) |
| 13 | Akses `/api/files/[id]` tanpa login | 401 |
| 14 | Akses `/api/files/[id]` dengan user beda unit yang tidak berhak | 403 + audit `ACCESS_DENIED` |
| 15 | POST ke `/api/surat-masuk` dengan Origin asing | 403 (CSRF/same-origin block) |
| 16 | Edit role diri sendiri via `/api/users/[me]` | Ditolak |
| 17 | Query `/api/tracking/<nomor agenda orang lain>` | 403 jika tidak berhak |
| 18 | View `/verify` untuk surat keluar status DRAFT | Tampil "tidak valid" (belum sah) |
| 19 | View `/verify` untuk surat rahasia | Perihal disamarkan `[Dirahasiakan]` |
| 20 | Stack trace error | Tidak muncul di production |

---

## Lisensi & Kredit

Aplikasi internal untuk **PERUMDAM Tirta Ardhia Rinjani**, Kabupaten Lombok Tengah.

E-Office TIARA · PERUMDAM Tirta Ardhia Rinjani · Lombok Tengah
