import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function calculateAge(dateOfBirth: string, referenceDate = new Date()) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function formatPatientBirthDateLabel(patient: {
  dateOfBirth: string;
  birthDateSource?: string;
  ageYearsAtRegistration?: number;
}) {
  if (patient.birthDateSource === 'AgeEstimate') {
    const age = patient.ageYearsAtRegistration ?? calculateAge(patient.dateOfBirth);
    return typeof age === 'number' ? `Age ${age} (est.)` : 'Age estimated';
  }
  return formatDate(patient.dateOfBirth);
}

export function formatDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}

export function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function nextPatientCode(existing: string[]) {
  const nums = existing
    .map((c) => parseInt(c.split('-')[2] || '0', 10))
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `EC-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
}
