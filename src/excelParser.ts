import type { DashboardData } from './types';

/**
 * Parse Excel workbook buffer into DashboardData
 * This is a stub implementation for build purposes
 */
export function parseExcelWorkbook(_buffer: ArrayBuffer, _fileName: string): DashboardData {
    // This is a placeholder implementation
    // In a real implementation, you would use a library like xlsx to parse the Excel file
    throw new Error('Excel parsing not implemented yet. Please use the static data.json for now.');
}