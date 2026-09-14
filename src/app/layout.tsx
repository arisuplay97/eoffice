import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIAGA TIARA — PERUMDAM Tirta Ardhia Rinjani",
  description:
    "Sistem Informasi Gangguan Air Terpadu Kabupaten Lombok Tengah — PERUMDAM Tirta Ardhia Rinjani",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`dark ${inter.className}`} suppressHydrationWarning>
      <body className={`min-h-screen bg-[#090b0e] text-slate-100 dark:bg-dark-bg dark:text-dark-text antialiased transition-colors duration-200 ${inter.className} font-sans`}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <Script src="/vendor/lottie.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
