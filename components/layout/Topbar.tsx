'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllPatients } from '@/app/actions/patients';
import { signOut, usePermissions } from '@/lib/auth';
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
  const { user } = usePermissions();
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  useEffect(() => {
    Promise.all([getAllPatients(), getAllCampaigns(), getAllFollowUps()])
      .then(([p, c, f]) => {
        setPatients(p);
        setCampaigns(c);
        setFollowUps(f);
      });
  }, []);

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
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[#DDE3EA] bg-white px-5 shadow-[var(--shadow-xs)]">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-[#647184] transition-colors hover:bg-[#EBF7EE] lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div ref={searchRef} className="relative max-w-sm flex-1">
        <div className="flex h-10 items-center gap-2 rounded-md border border-[#CDD5DF] bg-[#F5F7FA] px-3 shadow-[var(--shadow-xs)] transition-colors focus-within:border-[#2C9942] focus-within:ring-3 focus-within:ring-[#2C9942]/20">
          <Search className="h-4 w-4 shrink-0 text-[#647184]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => search.length >= 2 && setShowResults(true)}
            placeholder="Search patients, campaigns..."
            className="w-full bg-transparent text-sm text-[#141920] outline-none placeholder:text-[#647184]"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setShowResults(false);
              }}
              className="shrink-0 text-xs font-bold text-[#647184] hover:text-[#141920]"
              aria-label="Clear search"
            >
              x
            </button>
          )}
        </div>

        {showResults && hasResults && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#DDE3EA] bg-white shadow-[var(--shadow-lg)]">
            {patientResults.length > 0 && (
              <div>
                <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#647184]">Patients</p>
                {patientResults.map((p) => (
                  <Link
                    key={p.id}
                    href="/patients"
                    onClick={() => {
                      setShowResults(false);
                      setSearch('');
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-[#141920] transition-colors hover:bg-[#F5F7FA]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EBF7EE] text-[10px] font-bold text-[#002E63]">
                      {p.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight text-[#141920]">{p.fullName}</p>
                      <p className="text-[10px] text-[#647184]">{p.patientCode} - {p.phone}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {campaignResults.length > 0 && (
              <div className="border-t border-[#DDE3EA]">
                <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#647184]">Campaigns</p>
                {campaignResults.map((c) => (
                  <Link
                    key={c.id}
                    href="/campaigns"
                    onClick={() => {
                      setShowResults(false);
                      setSearch('');
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-[#141920] transition-colors hover:bg-[#F5F7FA]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EBF7EE]">
                      <span className="text-[10px] font-bold text-[#002E63]">C</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight text-[#141920]">{c.name}</p>
                      <p className="text-[10px] text-[#647184]">{c.type} - {c.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-[#DDE3EA] px-3 py-2">
              <p className="text-[10px] text-[#647184]">Showing top results - go to module for full list</p>
            </div>
          </div>
        )}

        {showResults && q.length >= 2 && !hasResults && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[#DDE3EA] bg-white px-3 py-3 shadow-[var(--shadow-lg)]">
            <p className="text-center text-sm text-[#647184]">No results for &quot;{q}&quot;</p>
          </div>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[#A6DCB5] bg-[#EBF7EE] px-3 py-1.5 text-xs font-semibold text-[#002E63] sm:flex">
        <span className="h-2 w-2 rounded-full bg-[#2C9942]" />
        Direct Aid Somalia
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={toggleTheme}
        className="flex size-10 items-center justify-center rounded-md border border-transparent text-[#647184] transition-colors hover:border-[#DDE3EA] hover:bg-[#F5F7FA] hover:text-[#141920]"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <Link
        href="/followups"
        title="View overdue follow-ups"
        className="relative flex size-10 items-center justify-center rounded-md border border-transparent text-[#647184] transition-colors hover:border-[#DDE3EA] hover:bg-[#F5F7FA] hover:text-[#141920]"
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
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-[#F5F7FA] focus-visible:ring-3 focus-visible:ring-[#2C9942]/25">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[#EBF7EE]"
              style={{ background: user.color }}
            >
              {user.initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-[#141920]">{user.name}</p>
              <p className="text-[10px] text-[#647184]">{user.role}</p>
            </div>
            <ChevronDown size={14} className="hidden text-[#647184] sm:block" />
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

