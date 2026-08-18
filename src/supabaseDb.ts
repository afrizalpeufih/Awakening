import { createClient } from '@supabase/supabase-js';
import type { DashboardData } from './types';
import type { HistoryItem } from './historyDb';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'awakening_upload_history';

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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history.slice(0, 15)));
  } catch (e) {
    console.warn('Gagal menyimpan riwayat ke localStorage:', e);
  }
}

export async function getUploadHistory(): Promise<HistoryItem[]> {
  const localItems = getLocalHistory();

  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('upload_history')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) {
        // Retry select all without explicit ordering in case uploaded_at index isn't present
        const retry = await supabase.from('upload_history').select('*');
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        const dbItems: HistoryItem[] = data.map((row: any) => ({
          id: String(row.id),
          fileName: row.file_name || row.fileName || 'file.xlsx',
          uploadedAt: row.uploaded_at || row.uploadedAt || new Date().toISOString(),
          data: row.data,
          isActive: Boolean(row.is_active ?? row.isActive ?? false),
        }));

        // Gabungkan data DB dan LocalStorage agar file baru lokal tidak tertimpa/hilang
        const itemMap = new Map<string, HistoryItem>();
        dbItems.forEach((item) => itemMap.set(item.id, item));
        localItems.forEach((item) => {
          if (!itemMap.has(item.id)) {
            itemMap.set(item.id, item);
          }
        });

        const merged = Array.from(itemMap.values()).sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        saveLocalHistory(merged);
        return merged;
      }
    } catch (err) {
      console.warn('Supabase query error, fallback ke localStorage:', err);
    }
  }

  return localItems;
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

  const localHistory = getLocalHistory();
  localHistory.forEach((item) => (item.isActive = false));
  localHistory.unshift(newItem);
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      // Set is_active = false pada entri sebelumnya
      await supabase.from('upload_history').update({ is_active: false }).neq('id', '0');

      const { error } = await supabase.from('upload_history').insert({
        id: newItem.id,
        file_name: newItem.fileName,
        uploaded_at: newItem.uploadedAt,
        data: newItem.data,
        is_active: true,
      });

      if (error) {
        console.warn('Supabase insert error (tetap menggunakan data lokal):', error.message);
      }
    } catch (err) {
      console.warn('Supabase insert exception (tetap menggunakan data lokal):', err);
    }
  }

  return newItem;
}

export async function deleteHistoryItem(id: string): Promise<HistoryItem[]> {
  const localHistory = getLocalHistory().filter((item) => item.id !== id);
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      await supabase.from('upload_history').delete().eq('id', id);
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
      await supabase.from('upload_history').update({ is_active: false }).neq('id', '0');
      await supabase.from('upload_history').update({ is_active: true }).eq('id', id);
    } catch (err) {
      console.warn('Supabase update active exception:', err);
    }
  }
}