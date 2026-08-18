import { createClient } from '@supabase/supabase-js';
import type { DashboardData } from './types';
import type { HistoryItem } from './historyDb';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_BUCKET = 'excel-files';

/**
 * Construct public Storage URL for a given upload ID.
 */
function getStorageUrl(id: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/history/${id}.json`;
}

/**
 * Upload DashboardData JSON to Supabase Storage bucket.
 * Path: history/{id}.json
 */
async function uploadDataToStorage(id: string, data: DashboardData): Promise<boolean> {
  if (!supabase) return false;
  try {
    const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const filePath = `history/${id}.json`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, jsonBlob, { upsert: true, contentType: 'application/json' });
    if (error) {
      console.warn('[Supabase Storage] Upload error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Storage] Upload exception:', err);
    return false;
  }
}

/**
 * Fetch DashboardData JSON from Supabase Storage by id.
 */
async function fetchDataFromStorage(id: string): Promise<DashboardData | null> {
  try {
    const url = getStorageUrl(id) + '?t=' + Date.now(); // cache-bust
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Supabase Storage] Fetch exception:', err);
    return null;
  }
}

// ─── Public Supabase-Only API ───────────────────────────────────────────────

/**
 * Get upload history list directly from Supabase DB `upload_history`.
 * Completely pure cloud: no localStorage fallback.
 */
export async function getUploadHistory(): Promise<HistoryItem[]> {
  if (!supabase) {
    console.warn('[Supabase] Client tidak terkonfigurasi.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('upload_history')
      .select('id, file_name, uploaded_at, is_active')
      .order('uploaded_at', { ascending: false });

    if (error) {
      // Retry without is_active if that column is missing
      const retry = await supabase
        .from('upload_history')
        .select('id, file_name, uploaded_at')
        .order('uploaded_at', { ascending: false });

      if (retry.error) {
        console.warn('[Supabase DB] Error querying upload_history:', retry.error.message);
        return [];
      }
      return (retry.data || []).map((row: any) => ({
        id: String(row.id),
        fileName: row.file_name || 'file.xlsx',
        uploadedAt: row.uploaded_at || new Date().toISOString(),
        isActive: false,
        data: null as any,
      }));
    }

    return (data || []).map((row: any) => ({
      id: String(row.id),
      fileName: row.file_name || 'file.xlsx',
      uploadedAt: row.uploaded_at || new Date().toISOString(),
      isActive: Boolean(row.is_active ?? false),
      data: null as any,
    }));
  } catch (err) {
    console.warn('[Supabase DB] Query exception:', err);
    return [];
  }
}

/**
 * Load full DashboardData for a history item directly from Supabase Storage.
 */
export async function loadHistoryItemData(item: HistoryItem): Promise<DashboardData | null> {
  if (item.data) return item.data;
  return await fetchDataFromStorage(item.id);
}

/**
 * Save new Excel upload to Supabase Storage and Supabase DB `upload_history`.
 */
export async function saveUploadToHistory(file: File, data: DashboardData): Promise<HistoryItem> {
  if (!supabase) {
    throw new Error('Supabase client tidak terkonfigurasi.');
  }

  const id = 'upload_' + Date.now();
  const newItem: HistoryItem = {
    id,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    data,
    isActive: true,
  };

  // 1. Upload JSON data to Supabase Storage
  const uploaded = await uploadDataToStorage(id, data);
  if (!uploaded) {
    throw new Error(
      `Gagal mengunggah data ke Supabase Storage (bucket: "${STORAGE_BUCKET}"). Pastikan bucket public dan izinkan INSERT.`
    );
  }

  // 2. Insert metadata row into Supabase DB
  const basePayload: any = {
    id: newItem.id,
    file_name: newItem.fileName,
    uploaded_at: newItem.uploadedAt,
    is_active: true,
    data: { _storageRef: true, id: newItem.id },
  };

  try {
    const { error: insertError } = await supabase
      .from('upload_history')
      .insert(basePayload);

    if (insertError) {
      if (insertError.message.toLowerCase().includes('is_active')) {
        const { is_active: _a, ...withoutActive } = basePayload;
        const { error: retryError } = await supabase
          .from('upload_history')
          .insert(withoutActive);
        if (retryError) throw retryError;
      } else {
        throw insertError;
      }
    }
  } catch (err: any) {
    throw new Error(`Gagal menyimpan metadata ke database: ${err.message}`);
  }

  // 3. Set all other rows to is_active = false in Supabase DB
  try {
    await supabase
      .from('upload_history')
      .update({ is_active: false })
      .neq('id', id);
  } catch {
    // ignore if is_active column does not exist
  }

  console.log('[Supabase] ✓ File berhasil diunggah ke cloud:', id);
  return newItem;
}

/**
 * Delete history item from Supabase DB and Supabase Storage.
 */
export async function deleteHistoryItem(id: string): Promise<HistoryItem[]> {
  if (supabase) {
    try {
      await supabase.from('upload_history').delete().eq('id', id);
      await supabase.storage.from(STORAGE_BUCKET).remove([`history/${id}.json`]);
    } catch (err) {
      console.warn('[Supabase DB] Delete error:', err);
    }
  }
  return await getUploadHistory();
}

/**
 * Set target history item as active in Supabase DB.
 */
export async function setActiveHistoryId(id: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('upload_history').update({ is_active: false }).neq('id', id);
      await supabase.from('upload_history').update({ is_active: true }).eq('id', id);
    } catch (err) {
      console.warn('[Supabase DB] Set active error:', err);
    }
  }
}