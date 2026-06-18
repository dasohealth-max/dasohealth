'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllPatients } from '@/app/actions/patients';
import { signOut, usePermissions } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Campaign, FollowUp, Patient } from '@/types';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();
  const { user, role } = usePermissions();
  const isSuperAdmin = role === 'Super Administrator';
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const [showResults, setShowResults] = useState(false);
  const [hoveredPatient, setHoveredPatient] = useState<Patient | null>(null);
  const hoverClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    Promise.all([getAllPatients(), getAllCampaigns(), getAllFollowUps()])
      .then(([p, c, f]) => {
        setPatients(p);
        setCampaigns(c);
        setFollowUps(f);
      });
  }, [isSuperAdmin]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('das-theme', next);
    setTheme(next);
  }

  const q = search.trim().toLowerCase();
  const patientResults = q.length >= 2
    ? patients
        .filter((p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.patientCode.toLowerCase().includes(q) ||
          p.phone.includes(q),
        )
        .slice(0, 4)
    : [];
  const campaignResults = q.length >= 2
    ? campaigns.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3)
    : [];
  const hasResults = patientResults.length > 0 || campaignResults.length > 0;
  const notifCount = followUps.filter((f) => f.status === 'Overdue').length;

  return (
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 shadow-[var(--shadow-xs)]">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)] lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {isSuperAdmin && (
        <div ref={searchRef} className="relative max-w-sm flex-1">
          <div className="flex h-10 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 shadow-[var(--shadow-xs)] transition-colors focus-within:border-[var(--border-focus)] focus-within:ring-3 focus-within:ring-[var(--ring-soft)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => search.length >= 2 && setShowResults(true)}
              placeholder="Search patients, campaigns..."
              className="w-full bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-subtle)]"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setShowResults(false);
                }}
                className="shrink-0 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>

          {showResults && hasResults && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)]">
              {patientResults.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Patients</p>
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setShowResults(false);
                        setSearch('');
                        setHoveredPatient(null);
                        router.push('/patients?highlight=' + p.patientCode);
                      }}
                      onMouseEnter={() => {
                        if (hoverClearRef.current) clearTimeout(hoverClearRef.current);
                        setHoveredPatient(p);
                      }}
                      onMouseLeave={() => {
                        hoverClearRef.current = setTimeout(() => setHoveredPatient(null), 150);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-brand-soft)] text-[10px] font-bold text-[var(--text-brand)]">
                        {p.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight text-[var(--text-strong)]">{p.fullName}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{p.patientCode} · {p.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {campaignResults.length > 0 && (
                <div className="border-t border-[var(--border-subtle)]">
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Campaigns</p>
                  {campaignResults.map((c) => (
                    <Link
                      key={c.id}
                      href="/campaigns"
                      onClick={() => {
                        setShowResults(false);
                        setSearch('');
                      }}
                      className="flex items-center gap-3 px-3 py-2 text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-brand-soft)]">
                        <span className="text-[10px] font-bold text-[var(--text-brand)]">C</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight text-[var(--text-strong)]">{c.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{c.type} - {c.status}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">Showing top results - go to module for full list</p>
              </div>
            </div>
          )}

          {showResults && q.length >= 2 && !hasResults && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-3 shadow-[var(--shadow-lg)]">
              <p className="text-center text-sm text-[var(--text-muted)]">No results for &quot;{q}&quot;</p>
            </div>
          )}

          {hoveredPatient && showResults && (
            <div
              onMouseEnter={() => { if (hoverClearRef.current) clearTimeout(hoverClearRef.current); }}
              onMouseLeave={() => { hoverClearRef.current = setTimeout(() => setHoveredPatient(null), 150); }}
              className="absolute left-full top-12 z-50 ml-2 w-72 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-brand-soft)] text-sm font-bold text-[var(--text-brand)]">
                  {hoveredPatient.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-strong)]">{hoveredPatient.fullName}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{hoveredPatient.patientCode}</p>
                </div>
              </div>
              <div className="space-y-1.5 p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Phone</span>
                  <span className="font-medium text-[var(--text-strong)]">{hoveredPatient.phone}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Region</span>
                  <span className="truncate font-medium text-[var(--text-strong)]">{hoveredPatient.region}</span>
                </div>
                {hoveredPatient.operationDistrict && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">District</span>
                    <span className="font-medium text-[var(--text-strong)]">{hoveredPatient.operationDistrict}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Sex</span>
                  <span className="font-medium text-[var(--text-strong)]">{hoveredPatient.sex}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Date of Birth</span>
                  <span className="font-medium text-[var(--text-strong)]">{formatDate(hoveredPatient.dateOfBirth)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Status</span>
                  <span className="font-medium text-[#2C9942]">{hoveredPatient.screeningStatus}</span>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">Click to navigate and highlight this patient</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={toggleTheme}
        className="flex size-10 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <Link
        href="/followups"
        title="View overdue follow-ups"
        className="relative flex size-10 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
      >
        <Bell size={18} />
        {notifCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-0.5 text-[9px] font-bold text-white">
            {notifCount > 99 ? '99+' : notifCount}
          </span>
        )}
      </Link>

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-3 focus-visible:ring-[#2C9942]/25">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[var(--surface-brand-soft)]"
              style={{ background: user.color }}
            >
              {user.initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-[var(--text-strong)]">{user.name}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{user.role}</p>
            </div>
            <ChevronDown size={14} className="hidden text-[var(--text-muted)] sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-[#647184]">{user.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={logout} className="text-[#E53935] focus:bg-[#FDECEB] focus:text-[#A32421]">
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}

