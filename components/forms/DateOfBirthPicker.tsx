'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CUR_YEAR - 1919 }, (_, i) => CUR_YEAR - i);

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function parse(value: string): [number, number, number] {
  if (!value) return [0, 0, 0];
  const parts = value.split('-').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export default function DateOfBirthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(() => {
    const [y, m, d] = parse(value);
    return { source: value, year: y, month: m, day: d };
  });

  const parsed = draft.source === value ? draft : (() => {
    const [y, m, d] = parse(value);
    return { source: value, year: y, month: m, day: d };
  })();

  const { year, month, day } = parsed;

  function emit(y: number, m: number, d: number) {
    if (y && m && d) {
      onChange(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }

  const maxDay = daysInMonth(year, month);
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1);
  const safeDay = day > maxDay ? 1 : day;

  const SL = 'rounded-md text-sm';

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Day */}
      <Select
        value={day ? String(day) : ''}
        onValueChange={(v) => {
          const d = parseInt(v ?? '0');
          setDraft({ source: value, year, month, day: d });
          emit(year, month, d);
        }}
      >
        <SelectTrigger className={SL}><SelectValue placeholder="Day" /></SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d} value={String(d)}>{String(d).padStart(2, '0')}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Month */}
      <Select
        value={month ? String(month) : ''}
        onValueChange={(v) => {
          const m = parseInt(v ?? '0');
          setDraft({ source: value, year, month: m, day: safeDay });
          emit(year, m, safeDay);
        }}
      >
        <SelectTrigger className={SL}><SelectValue placeholder="Month" /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year */}
      <Select
        value={year ? String(year) : ''}
        onValueChange={(v) => {
          const y = parseInt(v ?? '0');
          setDraft({ source: value, year: y, month, day: safeDay });
          emit(y, month, safeDay);
        }}
      >
        <SelectTrigger className={SL}><SelectValue placeholder="Year" /></SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
