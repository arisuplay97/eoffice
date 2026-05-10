import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "E-Office TIARA",
  description:
    "Sistem Administrasi Persuratan, Disposisi, Tracking Dokumen, dan Arsip Digital - PERUMDAM Tirta Ardhia Rinjani",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-ink-50">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
