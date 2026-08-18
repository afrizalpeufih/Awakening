import { createClient } from '@supabase/supabase-js';
import type { DashboardData } from './types';
import type { HistoryItem } from './historyDb';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'awakening_upload_history';
const STORAGE_BUCKET = 'dashboarddata';

function getLocalHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(history: HistoryItem[]): void {
  try {
    // Save without full data to avoid localStorage size limits
    const slim = history.map(({ data: _data, ...rest }) => rest);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(slim.slice(0, 15)));
  } catch (e) {
    console.warn('Gagal menyimpan riwayat ke localStorage:', e);
  }
}

/** Upload JSON data to Supabase Storage and return its public URL */
async function uploadDataToStorage(id: string, data: DashboardData): Promise<string | null> {
  if (!supabase) return null;
  try {
    const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const filePath = `history/${id}.json`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, jsonBlob, { upsert: true, contentType: 'application/json' });
    if (error) {
      console.warn('Storage upload error:', error.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('Storage upload exception:', err);
    return null;
  }
}

/** Fetch DashboardData from Supabase Storage URL */
async function fetchDataFromStorage(dataUrl: string): Promise<DashboardData | null> {
  try {
    const res = await fetch(dataUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getUploadHistory(): Promise<HistoryItem[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('upload_history')
        .select('id, file_name, uploaded_at, is_active, data_url')
        .order('uploaded_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Build items — lazy load data only when needed
        const dbItems: Omit<HistoryItem, 'data'>[] = data.map((row: any) => ({
          id: String(row.id),
          fileName: row.file_name || row.fileName || 'file.xlsx',
          uploadedAt: row.uploaded_at || row.uploadedAt || new Date().toISOString(),
          isActive: Boolean(row.is_active ?? row.isActive ?? false),
          dataUrl: row.data_url || null,
          // Inline data from DB if present (backwards compat)
          _inlineData: row.data || null,
        }));

        // Convert to HistoryItem with data field populated lazily
        const items: HistoryItem[] = dbItems.map((item: any) => ({
          id: item.id,
          fileName: item.fileName,
          uploadedAt: item.uploadedAt,
          isActive: item.isActive,
          data: item._inlineData || null, // will be loaded on-demand if null
          dataUrl: item.dataUrl,
        }));

        saveLocalHistory(items);
        return items;
      }
    } catch (err) {
      console.warn('Supabase query error, fallback ke localStorage:', err);
    }
  }

  return getLocalHistory();
}

/** Load the actual DashboardData for a history item (from storage or inline data) */
export async function loadHistoryItemData(item: HistoryItem): Promise<DashboardData | null> {
  // Already have data in memory
  if (item.data) return item.data;

  // Try loading from Supabase Storage URL
  const dataUrl = (item as any).dataUrl;
  if (dataUrl) {
    const data = await fetchDataFromStorage(dataUrl);
    if (data) return data;
  }

  // Try loading inline from Supabase DB (backwards compat)
  if (supabase) {
    try {
      const { data: row } = await supabase
        .from('upload_history')
        .select('data')
        .eq('id', item.id)
        .single();
      if (row?.data) return row.data as DashboardData;
    } catch {}
  }

  return null;
}

export async function saveUploadToHistory(file: File, data: DashboardData): Promise<HistoryItem> {
  const id = 'upload_' + Date.now();
  const newItem: HistoryItem = {
    id,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    data,
    isActive: true,
  };

  // Try to upload data to Supabase Storage first
  let dataUrl: string | null = null;
  if (supabase) {
    dataUrl = await uploadDataToStorage(id, data);
  }

  if (supabase) {
    try {
      // Set is_active = false pada entri sebelumnya
      await supabase.from('upload_history').update({ is_active: false }).neq('id', '__none__');

      const insertPayload: any = {
        id: newItem.id,
        file_name: newItem.fileName,
        uploaded_at: newItem.uploadedAt,
        is_active: true,
      };

      if (dataUrl) {
        // Store reference URL to data in Storage — no heavy JSON in DB
        insertPayload.data_url = dataUrl;
      } else {
        // Fallback: store data inline (may fail if too large)
        insertPayload.data = newItem.data;
      }

      const { error } = await supabase.from('upload_history').insert(insertPayload);
      if (error) {
        console.warn('Supabase insert error (tetap menggunakan data lokal):', error.message);
      }
    } catch (err) {
      console.warn('Supabase insert exception (tetap menggunakan data lokal):', err);
    }
  }

  // Update local cache (without full data to save space)
  const localHistory = getLocalHistory();
  localHistory.forEach((item) => (item.isActive = false));
  localHistory.unshift({ ...newItem, data: null as any });
  saveLocalHistory(localHistory);

  return newItem;
}

export async function deleteHistoryItem(id: string): Promise<HistoryItem[]> {
  const localHistory = getLocalHistory().filter((item) => item.id !== id);
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      await supabase.from('upload_history').delete().eq('id', id);
      // Also remove from storage
      await supabase.storage.from(STORAGE_BUCKET).remove([`history/${id}.json`]);
    } catch (err) {
      console.warn('Supabase delete exception:', err);
    }
  }

  return localHistory;
}

export async function setActiveHistoryId(id: string): Promise<void> {
  const localHistory = getLocalHistory();
  localHistory.forEach((item) => (item.isActive = item.id === id));
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      await supabase.from('upload_history').update({ is_active: false }).neq('id', '__none__');
      await supabase.from('upload_history').update({ is_active: true }).eq('id', id);
    } catch (err) {
      console.warn('Supabase update active exception:', err);
    }
  }
}