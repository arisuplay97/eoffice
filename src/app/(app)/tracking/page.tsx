import { PageHeader } from "@/components/shell/PageHeader";
import TrackingSearchClient from "./search-client";

export default function TrackingPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  return (
    <>
      <PageHeader
        title="Tracking Dokumen"
        subtitle="Telusuri perjalanan surat atau dokumen berdasarkan kode verifikasi, nomor agenda, atau nomor surat."
      />
      <TrackingSearchClient defaultQuery={searchParams?.q || ""} />
    </>
  );
}
