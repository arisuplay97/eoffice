# Dokumentasi Integrasi API Aduan (Mobile App & Gateway)
**Sistem:** SIAGA TIARA (Perumda Air Minum Tirta Ardhia Rinjani)  
**Versi API:** 2.1.0  
**Update Terakhir:** September 2026  

Dokumen ini ditujukan untuk tim developer aplikasi mobile (Flutter / React Native / Kotlin / Swift) dan tim integrasi channel external (WhatsApp Bot / Call Center) yang akan mengirimkan laporan aduan ke dashboard SIAGA TIARA.

---

## 1. Ringkasan Endpoint

| Endpoint | Method | Fungsi | Auth |
|---|---|---|---|
| `/api/webhook/aduan` | `POST` | Kirim aduan baru dari mobile / bot | Public |
| `/api/webhook/aduan` | `GET` | Cek status aduan (tracking) / health check | Public |

**Base URL:**
- Development: `http://localhost:3000`
- Production: `https://siagatiara.lomboktengahkab.go.id` *(sesuaikan dengan domain live)*

---

## 2. Kirim Aduan Baru

Menerima input laporan keluhan dari aplikasi mobile atau gateway eksternal. Begitu request berhasil diterima:
- Sistem membuat tiket aduan baru dengan status `BARU`.
- Real-time alarm (sirene audio) dan popup warning Lottie langsung aktif di layar operator web SIAGA.
- Notifikasi masuk ke antrean pemantauan SLA (24 jam).

### Request Headers
```http
Content-Type: application/json
Accept: application/json
```

### Request Body Parameter
| Parameter | Tipe | Wajib? | Contoh | Keterangan |
|---|---|---|---|---|
| `namaPelanggan` | String | **Ya** | `"Lalu Rian"` | Nama lengkap pelapor / pelanggan |
| `noHp` | String | **Ya** | `"081234567890"` | Nomor kontak aktif (bisa WhatsApp) |
| `noPelanggan` | String | Opsional | `"10045231"` | Nomor ID / Sambungan / Meter air |
| `keterangan` | String | **Ya** | `"Pipa bocor di jalan raya"` | Uraian lengkap keluhan |
| `jenisGangguan` | String | Opsional | `"PIPA_BOCOR"` | Kategori gangguan *(lihat daftar enum di bawah)* |
| `prioritas` | String | Opsional | `"DARURAT"` | Default: `SEDANG`. Terdeteksi otomatis dari teks jika ada kata darurat |
| `cabang` | String | Opsional | `"Praya"` | Kode atau nama cabang: `Praya`, `Jonggat`, `Kopang`, `PRY`, dll. |
| `wilayah` | String | Opsional | `"Praya Barat"` | Dusun / desa / kecamatan |
| `lokasiDetail` | String | Opsional | `"Dekat kantor desa, RT 02"` | Patokan lokasi fisik |
| `latitude` | Float | Opsional | `-8.704215` | Koordinat lintang dari GPS perangkat |
| `longitude` | Float | Opsional | `116.273102` | Koordinat bujur dari GPS perangkat |
| `linkMaps` | String | Opsional | `"https://maps.google.com/..."` | Link titik lokasi (otomatis digenerate jika lat/long dikirim) |
| `fotoUrl` | String | Opsional | `"https://cdn.domain.com/img.jpg"` | URL foto bukti keluhan dari kamera perangkat |
| `sumber` | String | Opsional | `"APLIKASI"` | Label sumber: `APLIKASI`, `WHATSAPP`, `TELEPON` |

> **Catatan Pengisian Cabang & GPS:**
> - Jika `latitude` dan `longitude` dikirim tanpa `linkMaps`, server otomatis mengonversinya menjadi URL Google Maps agar teknisi bisa langsung klik rute.
> - Jika `cabang` dikosongkan, server akan mencocokkan teks `wilayah` ke wilayah operasional cabang terdekat. Jika tidak ada yang cocok, tiket dialokasikan ke Cabang Pusat (Praya) agar diverifikasi oleh admin pusat.

### Referensi Enum `jenisGangguan`
- `AIR_MATI` : Air tidak mengalir / mati total
- `PIPA_BOCOR` : Kebocoran pipa transmisi / distribusi / persil
- `AIR_KERUH` : Air keruh, berbau, atau berwarna
- `TEKANAN_RENDAH` : Tekanan air kecil / tidak naik ke toren
- `METER_BERMASALAH` : Meter air buram, macet, retak, atau loncat angka
- `TAGIHAN` : Kendala pencatatan meter atau ketidaksesuaian rekening
- `SAMBUNGAN_BARU` : Permohonan atau kendala pasang baru
- `LAINNYA` : Keluhan di luar kategori di atas

### Referensi Enum `prioritas`
- `DARURAT` : Membutuhkan respons < 1 jam (pipa induk pecah, genangan jalan protokol, RS)
- `TINGGI` : Urgen / mati total wilayah padat
- `SEDANG` : Penanganan reguler (default)
- `RENDAH` : Keluhan informasi atau non-gangguan fisik

---

### Contoh Request

#### JSON Payload
```json
{
  "namaPelanggan": "Ahmad Fauzi",
  "noHp": "081987654321",
  "noPelanggan": "10082341",
  "jenisGangguan": "PIPA_BOCOR",
  "prioritas": "DARURAT",
  "keterangan": "Pipa distribusi depan rumah pecah, air meluap ke badan jalan raya",
  "cabang": "Praya",
  "wilayah": "Praya",
  "lokasiDetail": "Jl. Gajah Mada No. 14, seberang masjid",
  "latitude": -8.704215,
  "longitude": 116.273102,
  "fotoUrl": "https://storage.domain.com/aduan/2026/09/foto-bukti-1.jpg",
  "sumber": "APLIKASI"
}
```

#### cURL
```bash
curl -X POST "https://siagatiara.lomboktengahkab.go.id/api/webhook/aduan" \
  -H "Content-Type: application/json" \
  -d '{
    "namaPelanggan": "Ahmad Fauzi",
    "noHp": "081987654321",
    "noPelanggan": "10082341",
    "jenisGangguan": "PIPA_BOCOR",
    "prioritas": "DARURAT",
    "keterangan": "Pipa distribusi depan rumah pecah, air meluap ke badan jalan",
    "cabang": "Praya",
    "latitude": -8.704215,
    "longitude": 116.273102,
    "sumber": "APLIKASI"
  }'
```

#### Dart (Flutter)
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> submitAduan({
  required String nama,
  required String noHp,
  String? noPelanggan,
  required String keterangan,
  String jenisGangguan = 'LAINNYA',
  String prioritas = 'SEDANG',
  String? cabang,
  double? lat,
  double? lng,
  String? fotoUrl,
}) async {
  final url = Uri.parse('https://siagatiara.lomboktengahkab.go.id/api/webhook/aduan');
  
  final body = jsonEncode({
    'namaPelanggan': nama,
    'noHp': noHp,
    'noPelanggan': noPelanggan ?? '-',
    'keterangan': keterangan,
    'jenisGangguan': jenisGangguan,
    'prioritas': prioritas,
    'cabang': cabang,
    'latitude': lat,
    'longitude': lng,
    'fotoUrl': fotoUrl,
    'sumber': 'APLIKASI',
  });

  final response = await http.post(
    url,
    headers: {'Content-Type': 'application/json'},
    body: body,
  );

  return jsonDecode(response.body);
}
```

### Format Tiket Aduan
Format nomor tiket di SIAGA TIARA adalah **`[KODE_CABANG][4 DIGIT ACAK ALFANUMERIK]`** (Total 7 karakter).
Contoh: **`BKU123C`**, **`PRY7K2A`**, **`KPG4N8M`**.

Daftar 12 kode cabang resmi:
- `BKU` : Cabang Batukliang Utara
- `KPG` : Cabang Kopang
- `PRY` : Cabang Praya
- `PTE` : Cabang Praya Tengah
- `PBD` : Cabang Praya Barat Daya
- `BTK` : Cabang Batukliang
- `JNP` : Cabang Janapria
- `PJT` : Cabang Pujut
- `PRB` : Cabang Praya Barat
- `PRT` : Cabang Praya Timur
- `PGR` : Cabang Pringgarata
- `JGT` : Cabang Jonggat

---

### Contoh Response

#### Success (200 OK)
```json
{
  "ok": true,
  "message": "Aduan berhasil diterima dan dicatat ke SIAGA TIARA.",
  "id": "BKU123C",
  "aduan": {
    "id": "BKU123C",
    "namaPelanggan": "Ahmad Fauzi",
    "noHp": "081987654321",
    "cabangNama": "Cabang Batukliang Utara",
    "jenisGangguan": "PIPA_BOCOR",
    "prioritas": "DARURAT",
    "status": "BARU",
    "latitude": -8.704215,
    "longitude": 116.273102,
    "linkMaps": "https://www.google.com/maps?q=-8.704215,116.273102",
    "waktuMasuk": "2026-09-15T02:15:30.000Z"
  }
}
```

Simpan field `id` (cth: `BKU123C`) di local storage aplikasi mobile untuk keperluan tracking status aduan oleh pengguna.

#### Error (500 Internal Server Error)
```json
{
  "ok": false,
  "error": "Tidak ada cabang operasional aktif di sistem."
}
```

---

## 3. Cek Status Aduan (Tracking dari Mobile)

Digunakan di aplikasi mobile pada menu riwayat / pelacakan aduan tanpa memerlukan token login admin.

### Request
```http
GET /api/webhook/aduan?id=BKU123C
```
Atau lacak berdasarkan nomor HP:
```http
GET /api/webhook/aduan?noHp=081987654321
```

### Parameter Query String
| Parameter | Tipe | Contoh | Keterangan |
|---|---|---|---|
| `id` | String | `BKU123C` | Mencari 1 tiket spesifik berdasarkan nomor aduan |
| `noHp` | String | `081987654321` | Menampilkan riwayat aduan yang pernah dikirim dari nomor tsb (maks. 10 tiket) |
| `noPelanggan` | String | `10082341` | Menampilkan aduan berdasarkan ID meteran pelanggan |

### Contoh Response Tracking (200 OK)
```json
{
  "ok": true,
  "count": 1,
  "items": [
    {
      "id": "BKU123C",
      "status": "DALAM_PENGERJAAN",
      "waktuMasuk": "2026-09-15T02:15:30.000Z",
      "waktuRespons": "2026-09-15T02:30:12.000Z",
      "waktuSelesai": null,
      "cabang": {
        "nama": "Cabang Batukliang Utara",
        "kode": "BKU",
        "kontak": "08123456789"
      },
      "penugasan": [
        {
          "petugas": {
            "nama": "Supardi",
            "role": "Teknisi Lapangan",
            "noHp": "085333444555"
          }
        }
      ],
      "statusLogs": [
        {
          "statusBaru": "DALAM_PENGERJAAN",
          "waktu": "2026-09-15T02:45:00.000Z",
          "actorNama": "Supardi",
          "keterangan": "Teknisi sedang melakukan penggantian pipa PVC 2 inch di lokasi"
        },
        {
          "statusBaru": "BARU",
          "waktu": "2026-09-15T02:15:30.000Z",
          "actorNama": "Aplikasi Mobile",
          "keterangan": "Aduan otomatis diterima dari Aplikasi Mobile Pelanggan"
        }
      ],
      "dokumentasi": [
        {
          "id": "cm81abcde...",
          "fotoUrl": "https://storage.domain.com/bukti-selesai.jpg",
          "tipeFoto": "FOTO_SEBELUM",
          "caption": "Foto keluhan dari Aplikasi Mobile",
          "createdAt": "2026-09-15T02:15:31.000Z"
        }
      ]
    }
  ]
}
```

### Status Lifecycle Aduan
Gunakan field `status` untuk menentukan badge tampilan di aplikasi mobile:
1. `BARU`: Laporan telah diterima sistem, menunggu validasi admin cabang.
2. `DIRESPONS`: Laporan sudah dibaca admin dan diteruskan ke supervisor/teknisi.
3. `PROSES` / `DALAM_PENGERJAAN`: Petugas teknisi sudah ditugaskan dan sedang bekerja di lokasi.
4. `KENDALA`: Terdapat hambatan di lapangan (alat khusus, koordinasi pihak ketiga, dsb).
5. `SELESAI`: Pekerjaan tuntas dan air sudah mengalir normal.
6. `BATAL`: Laporan ditolak / data fiktif / duplikat.

---

## 4. Health Check

Untuk mengecek apakah gateway server SIAGA aktif dan dapat menerima koneksi.

### Request
```http
GET /api/webhook/aduan
```

### Response
```json
{
  "ok": true,
  "service": "SIAGA TIARA Webhook & Mobile Gateway",
  "name": "SIAGA_TIARA_GATEWAY",
  "status": "active",
  "endpoint": "/api/webhook/aduan",
  "version": "2.1.0"
}
```

---

## 5. Rekomendasi Alur di Aplikasi Mobile

```
[Pengguna Isi Form] 
       │
       ▼
[Ambil Lokasi GPS (lat, lng)]
       │
       ▼
[Upload Foto ke Storage (Cloudinary/S3/Firebase)] ──> dapatkan `fotoUrl`
       │
       ▼
[POST /api/webhook/aduan]
       │
       ├── Berhasil (200) ──> Simpan `id` ke SQLite/SharedPreferences
       │                      Arahkan pengguna ke layar Sukses & Pelacakan
       │
       └── Gagal (non-200) ──> Tampilkan pesan error & simpan draft di offline storage
```
