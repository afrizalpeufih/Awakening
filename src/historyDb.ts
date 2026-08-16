import type { DashboardData } from './types';

export interface HistoryItem {
    id: string;
    fileName: string;
    uploadedAt: string;
    data: DashboardData;
    isActive: boolean;
}

// This is a stub file for build purposes
// The actual implementation should use a proper database or storage solution