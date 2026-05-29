export interface BsreSignOptions {
  nik: string;
  passphrase: string;
  fileBuffer: Buffer;
  isVisual?: boolean;
  page?: number;
  xAxis?: number;
  yAxis?: number;
  width?: number;
  height?: number;
}

/**
 * Memeriksa status sertifikat elektronik pengguna berdasarkan NIK.
 */
export async function checkUserStatus(nik: string) {
  const BSRE_URL = process.env.BSRE_API_URL;
  const BSRE_USER = process.env.BSRE_USERNAME;
  const BSRE_PASS = process.env.BSRE_PASSWORD;

  if (!BSRE_URL || !BSRE_USER || !BSRE_PASS) {
    return { active: true, nik, mock: true };
  }

  const auth = Buffer.from(`${BSRE_USER}:${BSRE_PASS}`).toString("base64");
  const res = await fetch(`${BSRE_URL}/api/user/status/${nik}`, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!res.ok) {
    throw new Error("Gagal memeriksa status pengguna BSrE");
  }

  return res.json();
}

/**
 * Melakukan penandatanganan dokumen PDF.
 */
export async function signPdf({
  nik,
  passphrase,
  fileBuffer,
  isVisual = false,
  page = 1,
  xAxis = 10,
  yAxis = 10,
  width = 150,
  height = 50,
}: BsreSignOptions): Promise<Buffer> {
  const BSRE_URL = process.env.BSRE_API_URL;
  const BSRE_USER = process.env.BSRE_USERNAME;
  const BSRE_PASS = process.env.BSRE_PASSWORD;

  if (!BSRE_URL || !BSRE_USER || !BSRE_PASS) {
    // Sandbox / Mock mode jika kredensial belum ada
    console.warn("Kredensial BSrE tidak ditemukan. Menggunakan MOCK signing.");
    return Buffer.concat([fileBuffer, Buffer.from("\n%BSRE_MOCK_SIGNATURE")]);
  }

  const formData = new FormData();
  formData.append("nik", nik);
  formData.append("passphrase", passphrase);
  
  if (isVisual) {
    formData.append("tampilan", "VISIBLE");
    formData.append("page", String(page));
    formData.append("xAxis", String(xAxis));
    formData.append("yAxis", String(yAxis));
    formData.append("width", String(width));
    formData.append("height", String(height));
  } else {
    formData.append("tampilan", "INVISIBLE");
  }

  const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
  formData.append("file", fileBlob, "document.pdf");

  const auth = Buffer.from(`${BSRE_USER}:${BSRE_PASS}`).toString("base64");
  
  const res = await fetch(`${BSRE_URL}/api/sign/pdf`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errMsg = "Gagal memproses tanda tangan BSrE";
    try {
      const json = JSON.parse(errorText);
      errMsg = json.error || json.message || errMsg;
    } catch {}
    throw new Error(`BSrE Error: ${errMsg}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
