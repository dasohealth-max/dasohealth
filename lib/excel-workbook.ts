import type { Workbook as ExcelWorkbook } from 'exceljs';

type ExportRow = Record<string, unknown>;

export function safeSpreadsheetValue(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function createSafeWorkbook() {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();

  return {
    utils: {
      book_new: () => workbook,
      json_to_sheet: <T extends ExportRow>(rows: T[]) => rows,
      book_append_sheet: (_book: ExcelWorkbook, rows: ExportRow[], name: string) => {
        const worksheet = workbook.addWorksheet(name);
        const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
        worksheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: Math.min(40, Math.max(12, header.length + 2)),
        }));
        worksheet.addRows(rows.map((row) => Object.fromEntries(
          headers.map((header) => [header, safeSpreadsheetValue(row[header])]),
        )));
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        worksheet.getRow(1).font = { bold: true };
        worksheet.autoFilter = headers.length > 0 ? {
          from: { row: 1, column: 1 },
          to: { row: Math.max(1, rows.length + 1), column: headers.length },
        } : undefined;
      },
    },
    writeFile: async (_book: ExcelWorkbook, filename: string) => {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
  };
}
