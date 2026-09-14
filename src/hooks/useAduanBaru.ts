"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AduanBaru {
  id: string;
  namaPelanggan: string;
  jenisGangguan: string;
  prioritas: string;
  cabangNama: string;
  wilayah: string;
  waktuMasuk: string;
  sumberAduan: string;
  keterangan: string;
}

const POLL_INTERVAL = 5_000; // 5 seconds
const CHANNEL_NAME = "siaga-aduan-baru";

const ELIGIBLE_ROLES = ["ADMIN_PUSAT", "SUPER_ADMIN", "ADMIN_CABANG"];

export function useAduanBaru(userRole?: string) {
  const [pendingAduan, setPendingAduan] = useState<AduanBaru[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isEligible = userRole && ELIGIBLE_ROLES.includes(userRole);

  // Filter out already dismissed items
  const filterDismissed = useCallback((items: AduanBaru[]): AduanBaru[] => {
    return items.filter((item) => !dismissedRef.current.has(item.id));
  }, []);

  // Merge new items into pending list, avoiding duplicates
  const mergeItems = useCallback(
    (incoming: AduanBaru[]) => {
      setPendingAduan((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newItems = incoming.filter(
          (a) => !existingIds.has(a.id) && !dismissedRef.current.has(a.id)
        );
        if (newItems.length === 0) return prev;
        return [...newItems, ...prev];
      });
    },
    []
  );

  // Polling
  useEffect(() => {
    if (!isEligible) return;

    let active = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/aduan/terbaru");
        if (!res.ok) return;
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.items)) return;

        if (!active) return;

        const filtered = filterDismissed(json.items);
        if (filtered.length > 0) {
          mergeItems(filtered);
        }

        // Also clean up pending items that are no longer in the API response
        // (e.g., status changed from BARU)
        setPendingAduan((prev) => {
          const apiIds = new Set(json.items.map((a: AduanBaru) => a.id));
          return prev.filter(
            (a) => apiIds.has(a.id) && !dismissedRef.current.has(a.id)
          );
        });
      } catch {
        // Silently ignore network errors
      }
    };

    // Initial poll
    poll();

    const timer = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isEligible, filterDismissed, mergeItems]);

  // BroadcastChannel for instant cross-tab notification
  useEffect(() => {
    if (!isEligible) return;
    if (typeof BroadcastChannel === "undefined") return;

    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === "ADUAN_BARU" && event.data?.aduan) {
          const aduan = event.data.aduan as AduanBaru;
          if (!dismissedRef.current.has(aduan.id)) {
            mergeItems([aduan]);
          }
        }
      };

      return () => {
        channel.close();
        channelRef.current = null;
      };
    } catch {
      // BroadcastChannel not supported
    }
  }, [isEligible, mergeItems]);

  const dismiss = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setPendingAduan((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setPendingAduan((prev) => {
      prev.forEach((a) => dismissedRef.current.add(a.id));
      return [];
    });
  }, []);

  return { pendingAduan, dismiss, dismissAll };
}

/**
 * Broadcast a new aduan to other tabs via BroadcastChannel.
 * Call this after successfully creating an aduan in ModalInputAduan.
 */
export function broadcastAduanBaru(aduan: AduanBaru) {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "ADUAN_BARU", aduan });
    channel.close();
  } catch {
    // Silently ignore
  }
}
