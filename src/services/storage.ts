// ============================================================
// Storage — Upload PDF para Supabase Storage
// ============================================================

import { getSupabaseClient } from './supabase';

const BUCKET = 'pdfs';
const SIGNED_URL_EXPIRY = 3600; // 1 hora

/**
 * Faz upload do PDF para o Supabase Storage e retorna uma signed URL.
 */
export async function uploadPdf(
  pdfBuffer: Buffer,
  planoId: string
): Promise<string> {
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const filePath = `planos/${planoId}/${timestamp}.pdf`;

  // Upload (upsert para sobrescrever se existir)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Erro no upload: ${uploadError.message}`);
  }

  // Gerar signed URL
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (urlError || !data?.signedUrl) {
    throw new Error(`Erro ao gerar URL: ${urlError?.message || 'URL vazia'}`);
  }

  console.log(`📦 PDF uploaded: ${filePath} (${(pdfBuffer.length / 1024).toFixed(1)}KB)`);
  return data.signedUrl;
}
