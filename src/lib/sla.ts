import { StatusAduan } from "@prisma/client";

export interface SlaInfo {
  statusCode: "ACTIVE_OK" | "ACTIVE_NEAR" | "ACTIVE_LATE" | "RESPONDED_ONTIME" | "RESPONDED_LATE" | "DONE" | "BATAL";
  statusLabel: string;
  statusClass: "ok" | "warning" | "late" | "neutral";
  responded: boolean;
  slaJam: number;
  responseHours: number;
  durationHours: number;
  lateHours: number;
  remainingHours: number;
  durasiText: string;
  selisihText: string;
  lamaPengerjaanHours: number;
  lamaPengerjaanText: string;
  waktuMasukText: string;
  waktuResponsText: string;
  waktuSelesaiText: string;
}

export function formatDurasi(hours: number): string {
  hours = Number(hours || 0);
  if (!isFinite(hours) || hours <= 0) return "0 menit";
  if (hours < 1) {
    const menit = Math.max(1, Math.round(hours * 60));
    return `${menit} menit`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} jam${m > 0 ? ` ${m} menit` : ""}`;
  }
  const hari = Math.floor(hours / 24);
  const sisaJam = Math.round(hours - hari * 24);
  return `${hari} hari${sisaJam > 0 ? ` ${sisaJam} jam` : ""}`;
}

export function isStatusAktif(status: StatusAduan): boolean {
  return status !== StatusAduan.SELESAI && status !== StatusAduan.BATAL;
}

export function isStatusAktifDitangani(status: StatusAduan): boolean {
  return (
    status === StatusAduan.DIRESPONS ||
    status === StatusAduan.PROSES ||
    status === StatusAduan.DALAM_PENGERJAAN ||
    status === StatusAduan.KENDALA ||
    status === StatusAduan.DITUNDA
  );
}

export function isStatusResponded(status: StatusAduan): boolean {
  return (
    status === StatusAduan.DIRESPONS ||
    status === StatusAduan.PROSES ||
    status === StatusAduan.DALAM_PENGERJAAN ||
    status === StatusAduan.KENDALA ||
    status === StatusAduan.SELESAI
  );
}

export function calculateSlaInfo(
  aduan: {
    status: StatusAduan;
    waktuMasuk: Date | string;
    waktuRespons?: Date | string | null;
    waktuSelesai?: Date | string | null;
    slaJam?: number | null;
  },
  nowMs = Date.now()
): SlaInfo {
  const masukMs = new Date(aduan.waktuMasuk).getTime();
  const slaHours = aduan.slaJam && aduan.slaJam > 0 ? aduan.slaJam : 24;
  const status = aduan.status;

  if (!masukMs || isNaN(masukMs)) {
    return {
      statusCode: "BATAL",
      statusLabel: "Data tidak valid",
      statusClass: "neutral",
      responded: false,
      slaJam: slaHours,
      responseHours: 0,
      durationHours: 0,
      lateHours: 0,
      remainingHours: 0,
      durasiText: "-",
      selisihText: "-",
      lamaPengerjaanHours: 0,
      lamaPengerjaanText: "-",
      waktuMasukText: "-",
      waktuResponsText: "-",
      waktuSelesaiText: "-",
    };
  }

  if (status === StatusAduan.BATAL) {
    return {
      statusCode: "BATAL",
      statusLabel: "Aduan Dibatalkan",
      statusClass: "neutral",
      responded: false,
      slaJam: slaHours,
      responseHours: 0,
      durationHours: 0,
      lateHours: 0,
      remainingHours: 0,
      durasiText: "-",
      selisihText: "Aduan dibatalkan",
      lamaPengerjaanHours: 0,
      lamaPengerjaanText: "-",
      waktuMasukText: new Date(masukMs).toLocaleString("id-ID"),
      waktuResponsText: "-",
      waktuSelesaiText: "-",
    };
  }

  const dueMs = masukMs + slaHours * 3600000;
  const responseMs = aduan.waktuRespons ? new Date(aduan.waktuRespons).getTime() : 0;
  const responded = responseMs > 0;
  const endMs = responded ? responseMs : nowMs;

  const hours = Math.max(0, (endMs - masukMs) / 3600000);
  const lateHours = Math.max(0, (endMs - dueMs) / 3600000);
  const remainingHours = Math.max(0, (dueMs - endMs) / 3600000);
  const warningLimit = slaHours * 0.25; // 25% of SLA = 6 hours for 24h SLA

  let code: SlaInfo["statusCode"] = "ACTIVE_OK";
  let label = "Menunggu respons";
  let cls: SlaInfo["statusClass"] = "ok";
  let selisih = remainingHours > 0 ? `Sisa ${formatDurasi(remainingHours)}` : "Tepat batas respons";

  if (responded) {
    if (lateHours > 0) {
      code = "RESPONDED_LATE";
      label = "Respons terlambat";
      cls = "late";
      selisih = `Respons lewat ${formatDurasi(lateHours)}`;
    } else {
      code = "RESPONDED_ONTIME";
      label = "Respons tepat waktu";
      cls = "ok";
      selisih = `Direspons dalam ${formatDurasi(hours)}`;
    }
  } else if (lateHours > 0) {
    code = "ACTIVE_LATE";
    label = "Lewat respons";
    cls = "late";
    selisih = `Belum direspons, lewat ${formatDurasi(lateHours)}`;
  } else if (remainingHours <= warningLimit) {
    code = "ACTIVE_NEAR";
    label = "Hampir lewat respons";
    cls = "warning";
    selisih = `Sisa ${formatDurasi(remainingHours)}`;
  }

  // Lama pengerjaan: dari pertama kali direspons sampai sekarang
  // Hanya relevan jika tiket masih aktif (belum selesai)
  let lamaPengerjaanHours = 0;
  let lamaPengerjaanText = "-";
  if (responded && status !== StatusAduan.SELESAI) {
    lamaPengerjaanHours = Math.max(0, (nowMs - responseMs) / 3600000);
    lamaPengerjaanText = formatDurasi(lamaPengerjaanHours);
  }

  return {
    statusCode: code,
    statusLabel: label,
    statusClass: cls,
    responded,
    slaJam: slaHours,
    responseHours: Math.round(hours * 10) / 10,
    durationHours: Math.round(hours * 10) / 10,
    lateHours: Math.round(lateHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    durasiText: formatDurasi(hours),
    selisihText: selisih,
    lamaPengerjaanHours: Math.round(lamaPengerjaanHours * 10) / 10,
    lamaPengerjaanText,
    waktuMasukText: new Date(masukMs).toLocaleString("id-ID"),
    waktuResponsText: responseMs ? new Date(responseMs).toLocaleString("id-ID") : "-",
    waktuSelesaiText: aduan.waktuSelesai ? new Date(aduan.waktuSelesai).toLocaleString("id-ID") : "-",
  };
}
