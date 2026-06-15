'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Search } from 'lucide-react';
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
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[#D0E8DA] bg-white px-5 shadow-[var(--shadow-xs)]">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-[#7A9A87] transition-colors hover:bg-[#E8F5EE] lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div ref={searchRef} className="relative max-w-sm flex-1">
        <div className="flex h-10 items-center gap-2 rounded-md border border-[#C0D8CC] bg-[#FAFAF8] px-3 shadow-[var(--shadow-xs)] transition-colors focus-within:border-[#1A7A46] focus-within:ring-3 focus-within:ring-[#1A7A46]/20">
          <Search className="h-4 w-4 shrink-0 text-[#7A9A87]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => search.length >= 2 && setShowResults(true)}
            placeholder="Search patients, campaigns..."
            className="w-full bg-transparent text-sm text-[#1C2B22] outline-none placeholder:text-[#7A9A87]"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setShowResults(false);
              }}
              className="shrink-0 text-xs font-bold text-[#7A9A87] hover:text-[#1C2B22]"
              aria-label="Clear search"
            >
              x
            </button>
          )}
        </div>

        {showResults && hasResults && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#D0E8DA] bg-white shadow-[var(--shadow-lg)]">
            {patientResults.length > 0 && (
              <div>
                <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#7A9A87]">Patients</p>
                {patientResults.map((p) => (
                  <Link
                    key={p.id}
                    href="/patients"
                    onClick={() => {
                      setShowResults(false);
                      setSearch('');
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-[#1C2B22] transition-colors hover:bg-[#FAFAF8]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#E8F5EE] text-[10px] font-bold text-[#0F4D2A]">
                      {p.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight text-[#1C2B22]">{p.fullName}</p>
                      <p className="text-[10px] text-[#7A9A87]">{p.patientCode} - {p.phone}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {campaignResults.length > 0 && (
              <div className="border-t border-[#D0E8DA]">
                <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#7A9A87]">Campaigns</p>
                {campaignResults.map((c) => (
                  <Link
                    key={c.id}
                    href="/campaigns"
                    onClick={() => {
                      setShowResults(false);
                      setSearch('');
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-[#1C2B22] transition-colors hover:bg-[#FAFAF8]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#E8F5EE]">
                      <span className="text-[10px] font-bold text-[#0F4D2A]">C</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight text-[#1C2B22]">{c.name}</p>
                      <p className="text-[10px] text-[#7A9A87]">{c.type} - {c.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-[#D0E8DA] px-3 py-2">
              <p className="text-[10px] text-[#7A9A87]">Showing top results - go to module for full list</p>
            </div>
          </div>
        )}

        {showResults && q.length >= 2 && !hasResults && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[#D0E8DA] bg-white px-3 py-3 shadow-[var(--shadow-lg)]">
            <p className="text-center text-sm text-[#7A9A87]">No results for &quot;{q}&quot;</p>
          </div>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[#8FBFA4] bg-[#E8F5EE] px-3 py-1.5 text-xs font-semibold text-[#0F4D2A] sm:flex">
        <span className="h-2 w-2 rounded-full bg-[#1A7A46]" />
        Direct Aid Somalia
      </div>

      <div className="flex-1" />

      <Link
        href="/followups"
        title="View overdue follow-ups"
        className="relative flex size-10 items-center justify-center rounded-md border border-transparent text-[#7A9A87] transition-colors hover:border-[#D0E8DA] hover:bg-[#FAFAF8] hover:text-[#1C2B22]"
      >
        <Bell size={18} />
        {notifCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B52A2A] px-0.5 text-[9px] font-bold text-white">
            {notifCount > 99 ? '99+' : notifCount}
          </span>
        )}
      </Link>

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-[#FAFAF8] focus-visible:ring-3 focus-visible:ring-[#1A7A46]/25">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[#E8F5EE]"
              style={{ background: user.color }}
            >
              {user.initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-[#1C2B22]">{user.name}</p>
              <p className="text-[10px] text-[#7A9A87]">{user.role}</p>
            </div>
            <ChevronDown size={14} className="hidden text-[#7A9A87] sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-[#7A9A87]">{user.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={logout} className="text-[#B52A2A] focus:bg-[#FCE8E8] focus:text-[#8B1E1E]">
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
