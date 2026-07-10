import { supabaseAdmin } from '../lib/supabase.js';

const BUCKET = 'user-documents';

export async function uploadReportPdf(
  userId: string,
  reportId: string,
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const storagePath = `${userId}/reports/${reportId}/mission_debrief.pdf`;

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  await supabaseAdmin.from('user_documents').upsert(
    {
      user_id: userId,
      report_id: reportId,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      file_name: fileName,
    },
    { onConflict: 'report_id' }
  );

  return storagePath;
}

export async function getSignedDownloadUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Failed to create signed URL');
  }

  return data.signedUrl;
}
