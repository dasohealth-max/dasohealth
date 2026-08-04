import { describe, expect, it } from 'vitest';
import { safeSpreadsheetValue } from '@/lib/excel-workbook';

describe('safeSpreadsheetValue', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)'])('neutralizes formula-like text: %s', (value) => {
    expect(safeSpreadsheetValue(value)).toBe(`'${value}`);
  });

  it('preserves ordinary text and numeric metrics', () => {
    expect(safeSpreadsheetValue('Galmudug')).toBe('Galmudug');
    expect(safeSpreadsheetValue(42)).toBe(42);
  });
});
