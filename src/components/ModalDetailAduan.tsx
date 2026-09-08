"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  MapPin,
  Phone,
  User,
  ExternalLink,
  ShieldCheck,
  Camera,
  History,
  CheckCircle2,
} from "lucide-react";
import { STATUS_LABELS, PRIORITAS_LABELS, JENIS_GANGGUAN_LABELS, SUMBER_ADUAN_LABELS } from "@/lib/constants";

interface ModalDetailAduanProps {
  aduanId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalDetailAduan({
  aduanId,
  isOpen,
  onClose,
}: ModalDetailAduanProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !aduanId) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/aduan/${aduanId}`);
        const result = await res.json();
        if (!res.ok || !result.ok) {
          throw new Error(result.error || "Gagal memuat detail.");
        }
        setData(result.aduan);
      } catch (err: any) {
        setError(err.message || "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, aduanId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Detail & Riwayat Audit Aduan</h2>
              {data && (
                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {data.id}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Audit trail resmi penanganan laporan gangguan air
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Memuat data aduan...</div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {error}
          </div>
        ) : data ? (
          <div className="mt-4 space-y-5 text-xs">
            {/* Quick Profile Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">{data.namaPelanggan}</div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono">{data.noHp}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    No Pelanggan: <strong className="font-mono">{data.noPelanggan || "-"}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {data.cabang?.nama} · {data.wilayah}
                    {data.desa ? `, Desa ${data.desa}` : ""}
                  </span>
                </div>
                {data.linkMaps && (
                  <div className="pt-1">
                    <a
                      href={data.linkMaps}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Buka Peta Lokasi
                    </a>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Parameter Teknis
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jenis Gangguan</span>
                  <span className="font-semibold text-slate-900">
                    {(JENIS_GANGGUAN_LABELS as any)[data.jenisGangguan] || data.jenisGangguan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Prioritas</span>
                  <span className="font-semibold text-slate-900">
                    {(PRIORITAS_LABELS as any)[data.prioritas] || data.prioritas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Saat Ini</span>
                  <span className={`badge badge-${String(data.status).toLowerCase()}`}>
                    {(STATUS_LABELS as any)[data.status] || data.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sumber Aduan</span>
                  <span className="font-medium text-slate-700">
                    {(SUMBER_ADUAN_LABELS as any)[data.sumberAduan] || data.sumberAduan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unit Terkait</span>
                  <span className="font-medium text-slate-700">{data.unit}</span>
                </div>
              </div>
            </div>

            {/* SLA Engine Info */}
            <div className="rounded-xl border border-sky-200/90 bg-sky-50/40 p-3.5">
              <div className="flex items-center gap-1.5 font-bold text-sky-950 mb-2">
                <ShieldCheck className="h-4 w-4 text-sky-700" />
                <span>Pengukuran Waktu Respons &amp; SLA 24 Jam</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div>
                  <span className="text-slate-500 block">Waktu Masuk</span>
                  <strong className="text-slate-900">{data.sla?.waktuMasukText}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Respons Pertama (Terkunci)</span>
                  <strong className="text-slate-900">{data.sla?.waktuResponsText}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Status Penilaian</span>
                  <strong className="text-slate-900">{data.sla?.statusLabel}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Lama Pengerjaan</span>
                  <strong className="text-slate-900">{data.sla?.lamaPengerjaanText}</strong>
                </div>
              </div>
            </div>

            {/* Detail Keterangan & Catatan */}
            <div className="space-y-2">
              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Keterangan Gangguan</span>
                <p className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 leading-relaxed">
                  {data.keterangan || "Tidak ada keterangan."}
                </p>
              </div>
              {data.catatan && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Catatan Teknis</span>
                  <p className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 leading-relaxed font-mono text-[11px]">
                    {data.catatan}
                  </p>
                </div>
              )}
            </div>

            {/* Dokumentasi Foto Gallery */}
            {data.dokumentasi && data.dokumentasi.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-2">
                  <Camera className="h-4 w-4 text-slate-500" />
                  <span>Dokumentasi Foto Pengerjaan ({data.dokumentasi.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.dokumentasi.map((dok: any) => (
                    <div
                      key={dok.id}
                      className="rounded-lg border border-slate-200 bg-white p-2 space-y-1 shadow-sm"
                    >
                      <div className="aspect-video w-full overflow-hidden rounded bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={dok.fotoUrl}
                          alt={dok.caption || "Dokumentasi"}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as any).src =
                              "https://placehold.co/600x400/e2e8f0/475569?text=Bukti+Pengerjaan";
                          }}
                        />
                      </div>
                      <div className="font-semibold text-[11px] text-slate-900 truncate">
                        {dok.tipeFoto}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-2">
                        {dok.caption || "Dokumentasi pengerjaan"}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {new Date(dok.createdAt).toLocaleString("id-ID")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Trail Timeline */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-2">
                <History className="h-4 w-4 text-slate-500" />
                <span>Riwayat Perubahan Status (Audit Trail)</span>
              </div>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-1.5">
                {data.statusLogs && data.statusLogs.length > 0 ? (
                  data.statusLogs.map((log: any) => (
                    <div key={log.id} className="relative text-xs">
                      <div className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-sky-600 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {log.statusBaru}
                          {log.statusSebelumnya ? ` (dari ${log.statusSebelumnya})` : " (Pencatatan Masuk)"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.waktu).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Oleh: <strong>{log.actorNama}</strong>
                      </div>
                      {log.keterangan && (
                        <div className="mt-0.5 text-slate-700 text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100">
                          {log.keterangan}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs">Belum ada riwayat audit.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-4 mt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
