import type { DashboardData } from './types';
import type { HistoryItem } from './historyDb';

export async function getUploadHistory(): Promise<HistoryItem[]> {
  try {
    const stored = localStorage.getItem('awakening_upload_history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
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
  const history = await getUploadHistory();
  history.forEach((item) => (item.isActive = false));
  history.unshift(newItem);
  localStorage.setItem('awakening_upload_history', JSON.stringify(history.slice(0, 10)));
  return newItem;
}

export async function deleteHistoryItem(id: string): Promise<HistoryItem[]> {
  const history = await getUploadHistory();
  const filtered = history.filter((item) => item.id !== id);
  localStorage.setItem('awakening_upload_history', JSON.stringify(filtered));
  return filtered;
}

export async function setActiveHistoryId(id: string): Promise<void> {
  const history = await getUploadHistory();
  history.forEach((item) => (item.isActive = item.id === id));
  localStorage.setItem('awakening_upload_history', JSON.stringify(history));
}