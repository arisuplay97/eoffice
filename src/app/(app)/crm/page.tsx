"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Clock,
  ArrowLeft,
  Send,
  CheckCheck,
  User,
  Phone,
  Building2,
  ExternalLink,
  Paperclip,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Pin,
  ChevronDown,
  Sun,
  Moon,
  Copy,
  PlusCircle,
  FileText,
  MapPin,
  Filter,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function CrmPage() {
  const { theme, toggleTheme } = useTheme();
  const [queues, setQueues] = useState<any[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [copiedNotification, setCopiedNotification] = useState(false);

  const fetchQueues = async () => {
    try {
      const res = await fetch("/api/crm");
      const json = await res.json();
      if (res.ok && json.ok) {
        setQueues(json.queues || []);
        if (selectedQueue) {
          const updated = (json.queues || []).find((q: any) => q.id === selectedQueue.id);
          if (updated) setSelectedQueue(updated);
        } else if ((json.queues || []).length > 0) {
          // auto select first queue if none selected
          setSelectedQueue(json.queues[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (queueId: string) => {
    try {
      const res = await fetch(`/api/crm?queueId=${queueId}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        setMessages(json.messages || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQueues();
    const interval = setInterval(fetchQueues, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedQueue) {
      fetchMessages(selectedQueue.id);
    } else {
      setMessages([]);
    }
  }, [selectedQueue]);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedQueue || !replyText.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueId: selectedQueue.id,
          message: replyText.trim(),
          status: "IN_PROGRESS",
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setReplyText("");
        await fetchMessages(selectedQueue.id);
        await fetchQueues();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedQueue) return;
    try {
      await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueId: selectedQueue.id,
          status: newStatus,
        }),
      });
      await fetchQueues();
      setSelectedQueue((prev: any) => ({ ...prev, status: newStatus }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickTemplate = (text: string) => {
    setReplyText((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const filteredQueues = queues.filter((q) => {
    if (folderFilter !== "ALL" && q.status !== folderFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      q.nama.toLowerCase().includes(s) ||
      q.phone.includes(s) ||
      (q.aduanId && q.aduanId.toLowerCase().includes(s))
    );
  });

  const openCount = queues.filter((q) => q.status === "OPEN").length;
  const inProgressCount = queues.filter((q) => q.status === "IN_PROGRESS").length;
  const resolvedCount = queues.filter((q) => q.status === "RESOLVED").length;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-dark-bg dark:text-slate-100 transition-colors">
      {/* Top SaaS Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 shadow-sm dark:border-dark-border dark:bg-dark-card lg:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:text-slate-400 dark:hover:bg-dark-hover transition"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80 dark:ring-dark-border">
            <img
              src="/logo.png"
              alt="Logo PERUMDAM Tirta Ardhia Rinjani"
              className="h-full w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Siaga CRM &mdash; WhatsApp Layanan Pelanggan
              </h1>
              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Live Gateway
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-dark-muted">
              PERUMDAM Tirta Ardhia Rinjani · Saluran Resmi Pengaduan WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {copiedNotification && (
            <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Data Tersalin
            </span>
          )}

          <button
            type="button"
            onClick={fetchQueues}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated dark:text-slate-300 dark:hover:bg-dark-hover transition"
          >
            Muat Ulang
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:text-slate-300 dark:hover:bg-dark-hover transition"
            title={theme === "light" ? "Beralih ke Dark Mode" : "Beralih ke Light Mode"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* 3-Column SaaS CRM Inbox Layout (Reference Image 1) */}
      <div className="flex flex-1 overflow-hidden">
        {/* ================= COLUMN 1: THREAD LIST & FOLDERS ================= */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200/80 bg-white dark:border-dark-border dark:bg-dark-card">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 dark:border-dark-border">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari pesan, pelanggan, no WA..."
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-elevated/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-dark-card"
              />
            </div>
          </div>

          {/* Folder Categories (Reference Image 1: Assigned, Unassigned, All Open) */}
          <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 dark:border-dark-border space-y-1 text-xs">
            <button
              type="button"
              onClick={() => setFolderFilter("ALL")}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 font-medium transition ${
                folderFilter === "ALL"
                  ? "bg-slate-100 font-semibold text-slate-900 dark:bg-dark-elevated dark:text-white"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-hover"
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                <span>Semua Percakapan</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">{queues.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setFolderFilter("OPEN")}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 font-medium transition ${
                folderFilter === "OPEN"
                  ? "bg-rose-500/10 font-semibold text-rose-600 dark:text-rose-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-hover"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                <span>Perlu Respons (Baru)</span>
              </div>
              <span className="rounded-full bg-rose-500/10 px-1.5 py-0.2 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">
                {openCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFolderFilter("IN_PROGRESS")}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 font-medium transition ${
                folderFilter === "IN_PROGRESS"
                  ? "bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-hover"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Sedang Ditangani</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">{inProgressCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFolderFilter("RESOLVED")}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 font-medium transition ${
                folderFilter === "RESOLVED"
                  ? "bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-hover"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Terselesaikan</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">{resolvedCount}</span>
            </button>
          </div>

          {/* List of Chat Threads (Reference Image 1) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-dark-border">
            {filteredQueues.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-dark-muted">
                Tidak ada percakapan ditemukan.
              </div>
            ) : (
              filteredQueues.map((item) => {
                const isSelected = selectedQueue?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedQueue(item)}
                    className={`cursor-pointer p-3 transition ${
                      isSelected
                        ? "bg-slate-100/90 dark:bg-dark-elevated"
                        : "hover:bg-slate-50 dark:hover:bg-dark-hover"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar Initials with Online Dot */}
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-border font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {item.nama.slice(0, 2).toUpperCase()}
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-dark-card" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {item.nama}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.messages && item.messages.length > 0
                              ? new Date(item.messages[item.messages.length - 1].createdAt).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Baru"}
                          </span>
                        </div>

                        <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-dark-muted">
                          {item.messages && item.messages.length > 0
                            ? item.messages[item.messages.length - 1].message
                            : "Percakapan baru dari WhatsApp..."}
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5">
                          {item.status === "OPEN" && (
                            <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                              Belum Dibalas
                            </span>
                          )}
                          {item.aduanId && (
                            <span className="rounded-full bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                              Tiket #{item.aduanId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ================= COLUMN 2: ACTIVE CHAT CONVERSATION ================= */}
        <main className="flex flex-1 flex-col border-r border-slate-200/80 bg-slate-50/50 dark:border-dark-border dark:bg-[#0b0e12]">
          {selectedQueue ? (
            <>
              {/* Conversation Top Header (Reference Image 1) */}
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-5 dark:border-dark-border dark:bg-dark-card">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 font-mono text-sm font-bold text-white shadow-sm">
                    {selectedQueue.nama.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedQueue.nama}
                      </h2>
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        WhatsApp Verified
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {selectedQueue.phone}
                    </div>
                  </div>
                </div>

                {/* Status Switcher & Actions */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedQueue.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-dark-border dark:bg-dark-elevated dark:text-slate-300 focus:outline-none"
                  >
                    <option value="OPEN">Status: Baru / Open</option>
                    <option value="IN_PROGRESS">Status: Dalam Penanganan</option>
                    <option value="RESOLVED">Status: Selesai (Resolved)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleCopy(selectedQueue.phone)}
                    title="Salin Nomor WhatsApp"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:text-slate-400 dark:hover:bg-dark-hover transition"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Feed Area */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
                {/* Date Separator Pill (Reference Image 1) */}
                <div className="flex items-center justify-center my-2">
                  <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm dark:border-dark-border dark:bg-dark-card dark:text-dark-muted">
                    Hari Ini · Layanan Real-Time
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 dark:text-dark-muted">
                    Belum ada riwayat pesan dalam sesi ini. Kirim balasan pertama melalui formulir di bawah.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutgoing = msg.direction === "OUTBOUND" || msg.direction === "OUT";
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2.5 ${isOutgoing ? "justify-end" : "justify-start"}`}
                      >
                        {!isOutgoing && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 font-mono text-[10px] font-bold text-slate-700 dark:bg-dark-elevated dark:text-slate-200">
                            {selectedQueue.nama.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div
                          className={`max-w-md rounded-2xl p-3.5 text-xs shadow-sm transition ${
                            isOutgoing
                              ? "rounded-br-none bg-sky-600 text-white font-medium shadow-sky-600/10"
                              : "rounded-bl-none border border-slate-200/80 bg-white text-slate-800 dark:border-dark-border dark:bg-dark-card dark:text-slate-200"
                          }`}
                        >
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                          <div
                            className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                              isOutgoing ? "text-sky-200" : "text-slate-400"
                            }`}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isOutgoing && <CheckCheck className="h-3 w-3" />}
                          </div>
                        </div>

                        {isOutgoing && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm ring-1 ring-slate-200 dark:ring-dark-border">
                            <img
                              src="/logo.png"
                              alt="Admin"
                              className="h-full w-auto object-contain"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Rich Message Composer (Reference Image 1) */}
              <div className="border-t border-slate-200/80 bg-white p-3.5 dark:border-dark-border dark:bg-dark-card">
                {/* Quick Response Template Pills */}
                <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
                  <span className="text-slate-400 dark:text-slate-500 font-medium shrink-0">
                    Template:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTemplate(
                        "Halo, terima kasih telah menghubungi PERUMDAM Tirta Ardhia Rinjani. Laporan Anda sedang kami proses."
                      )
                    }
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated dark:text-slate-300"
                  >
                    Konfirmasi Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTemplate(
                        "Petugas teknisi lapangan cabang sedang menuju ke lokasi Anda untuk pemeriksaan pipa."
                      )
                    }
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated dark:text-slate-300"
                  >
                    Teknisi Menuju Lokasi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTemplate(
                        "Penanganan gangguan telah selesai diperbaiki dan air telah mengalir normal. Terima kasih."
                      )
                    }
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated dark:text-slate-300"
                  >
                    Tiket Selesai
                  </button>
                </div>

                <form onSubmit={handleSendReply} className="relative">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Tulis balasan pesan resmi untuk pelanggan..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 pb-10 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-elevated/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-dark-card"
                  />

                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <button
                        type="button"
                        className="rounded-lg p-1 hover:bg-slate-200 dark:hover:bg-dark-hover"
                        title="Lampirkan File / Foto"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !replyText.trim()}
                      className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-[0.98] disabled:opacity-50 transition"
                    >
                      <span>{loading ? "Mengirim..." : "Kirim Pesan"}</span>
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-slate-400 dark:text-dark-muted">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Pilih Percakapan WhatsApp
              </div>
              <p className="mt-1 max-w-xs">
                Pilih salah satu kontak di kolom sebelah kiri untuk membuka pesan dan membalas aduan pelanggan.
              </p>
            </div>
          )}
        </main>

        {/* ================= COLUMN 3: CUSTOMER DOSSIER & DETAILS (Reference Image 1) ================= */}
        {selectedQueue && (
          <aside className="hidden xl:flex w-80 shrink-0 flex-col overflow-y-auto bg-white p-5 dark:bg-dark-card space-y-5">
            {/* Top Profile Card */}
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 font-mono text-xl font-bold text-white shadow-lg shadow-sky-500/10">
                {selectedQueue.nama.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {selectedQueue.nama}
              </h3>
              <p className="text-xs text-slate-400">
                Pelanggan Tirta Ardhia Rinjani
              </p>

              {/* Action Buttons (Reference Image 1: Note, Email, Task, More) */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleCopy(selectedQueue.phone)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 text-slate-700 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated/60 dark:text-slate-300 dark:hover:bg-dark-hover transition"
                >
                  <Copy className="h-4 w-4 text-sky-500" />
                  <span>Salin WA</span>
                </button>

                <a
                  href={`tel:${selectedQueue.phone}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 text-slate-700 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated/60 dark:text-slate-300 dark:hover:bg-dark-hover transition"
                >
                  <Phone className="h-4 w-4 text-emerald-500" />
                  <span>Telepon</span>
                </a>

                <Link
                  href="/dashboard"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 text-slate-700 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-elevated/60 dark:text-slate-300 dark:hover:bg-dark-hover transition"
                >
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span>Tiket</span>
                </Link>
              </div>
            </div>

            {/* Contact Details Section */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-dark-border dark:bg-dark-elevated/40 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Detail Pelanggan
              </div>

              <div>
                <div className="text-[11px] text-slate-400">Nomor WhatsApp</div>
                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedQueue.phone}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400">Status Sesi Chat</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>24-Hour Service Window Aktif</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400">Wilayah Pelayanan</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span>Lombok Tengah</span>
                </div>
              </div>
            </div>

            {/* Linked Ticket Dossier */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-dark-border dark:bg-dark-elevated/40 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Aduan Terkait
              </div>

              {selectedQueue.aduanId ? (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                  <div className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300">
                    #{selectedQueue.aduanId}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Tiket aduan gangguan aktif di sistem SIAGA TIARA.
                  </div>
                  <Link
                    href="/dashboard"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Buka Detail di Dashboard</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Belum ada tiket aduan yang dikaitkan dengan percakapan ini.
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
