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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
  } catch (e) {
    console.warn('Gagal menyimpan riwayat ke localStorage:', e);
  }
}

export async function getUploadHistory(): Promise<HistoryItem[]> {
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('upload_history')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) {
        // Retry without specific column ordering in case uploaded_at isn't indexed
        const retry = await supabase.from('upload_history').select('*');
        data = retry.data;
        error = retry.error;
      }

      if (!error && data && data.length > 0) {
        const items: HistoryItem[] = data.map((row: any) => ({
          id: String(row.id),
          fileName: row.file_name || row.fileName || 'file.xlsx',
          uploadedAt: row.uploaded_at || row.uploadedAt || new Date().toISOString(),
          data: row.data,
          isActive: Boolean(row.is_active ?? row.isActive ?? false),
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
      await supabase.from('upload_history').update({ is_active: false }).neq('id', '0');

      const { error } = await supabase.from('upload_history').insert({
        id: newItem.id,
        file_name: newItem.fileName,
        uploaded_at: newItem.uploadedAt,
        data: newItem.data,
        is_active: true,
      });

      if (error) {
        console.warn('Supabase insert error (menggunakan data lokal):', error.message);
      }
    } catch (err) {
      console.warn('Supabase insert exception (menggunakan data lokal):', err);
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