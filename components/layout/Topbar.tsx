'use client';
import { useRouter } from 'next/navigation';
import { signOut, usePermissions } from '@/lib/auth';
import { Bell, LogOut, Search, ChevronDown, Menu } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAllPatients } from '@/app/actions/patients';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import type { Patient, Campaign, FollowUp } from '@/types';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();
  const { user } = usePermissions();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [patients, setPatients]   = useState<Patient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  useEffect(() => {
    Promise.all([getAllPatients(), getAllCampaigns(), getAllFollowUps()])
      .then(([p, c, f]) => { setPatients(p); setCampaigns(c); setFollowUps(f); });
  }, []);

  // Real notification count
  const overdueCount  = followUps.filter((f) => f.status === 'Overdue').length;
  const notifCount    = overdueCount;

  // Close search on outside click
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

  // Quick search: patients + campaigns
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

  return (
    <header className="h-14 bg-white border-b border-[#E2DDD5] flex items-center px-4 gap-3 shrink-0 shadow-sm z-30">
      {/* Hamburger – mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[#E8F5EE] text-[#7A9A87] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Global search */}
      <div ref={searchRef} className="relative flex-1 max-w-sm">
        <div className="flex items-center gap-2 bg-[#FAFAF8] border border-[#E2DDD5] rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-[#7A9A87] shrink-0" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => search.length >= 2 && setShowResults(true)}
            placeholder="Search patients, campaigns…"
            className="bg-transparent text-sm outline-none text-[#1C2B22] placeholder:text-[#7A9A87] w-full"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowResults(false); }}
              className="text-[#7A9A87] hover:text-[#1C2B22] text-xs font-bold shrink-0"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {showResults && hasResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-[#E2DDD5] overflow-hidden z-50">
            {patientResults.length > 0 && (
              <div>
                <p className="text-[10px] text-[#7A9A87] font-semibold uppercase tracking-wider px-3 pt-2.5 pb-1">Patients</p>
                {patientResults.map((p) => (
                  <Link
                    key={p.id}
                    href="/patients"
                    onClick={() => { setShowResults(false); setSearch(''); }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-[#F0EDE6] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#E8F5EE] flex items-center justify-center text-[#0F4D2A] text-[10px] font-bold shrink-0">
                      {p.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1C2B22] leading-tight">{p.fullName}</p>
                      <p className="text-[10px] text-[#7A9A87]">{p.patientCode} · {p.phone}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {campaignResults.length > 0 && (
              <div className="border-t border-[#F0EDE6]">
                <p className="text-[10px] text-[#7A9A87] font-semibold uppercase tracking-wider px-3 pt-2.5 pb-1">Campaigns</p>
                {campaignResults.map((c) => (
                  <Link
                    key={c.id}
                    href="/campaigns"
                    onClick={() => { setShowResults(false); setSearch(''); }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-[#F0EDE6] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#FEF3DC] flex items-center justify-center shrink-0">
                      <span className="text-[#C47D11] text-[10px] font-bold">C</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1C2B22] leading-tight">{c.name}</p>
                      <p className="text-[10px] text-[#7A9A87]">{c.type} · {c.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="border-t border-[#E2DDD5] px-3 py-2">
              <p className="text-[10px] text-[#7A9A87]">Showing top results — go to module for full list</p>
            </div>
          </div>
        )}
        {showResults && q.length >= 2 && !hasResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-[#E2DDD5] px-3 py-3 z-50">
            <p className="text-sm text-[#7A9A87] text-center">No results for &quot;{q}&quot;</p>
          </div>
        )}
      </div>

      {/* Org badge */}
      <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#4A6455] bg-[#E8F5EE] border border-[#D0E8DA] rounded-lg px-3 py-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#1A7A46] animate-pulse" />
        Direct Aid Somalia
      </div>

      <div className="flex-1" />

      {/* Notifications — use div inside Link to avoid <a><button> nesting */}
      <Link
        href="/followups"
        title="View overdue follow-ups"
        className="relative p-2 rounded-lg hover:bg-[#E8F5EE] text-[#7A9A87] transition-colors flex items-center justify-center"
      >
        <Bell size={18} />
        {notifCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#B52A2A] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {notifCount > 99 ? '99+' : notifCount}
          </span>
        )}
      </Link>

      {/* User menu */}
      {user && (
        <DropdownMenu>
          {/* DropdownMenuTrigger already renders a <button> — use div inside, not button */}
          <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-[#E8F5EE] rounded-lg px-2 py-1.5 transition-colors outline-none">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: user.color }}
              >
                {user.initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[#1C2B22] leading-tight">{user.name}</p>
                <p className="text-[10px] text-[#7A9A87]">{user.role}</p>
              </div>
              <ChevronDown size={14} className="text-[#7A9A87] hidden sm:block" />
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
              <DropdownMenuItem onClick={logout} className="text-[#B52A2A] focus:text-[#B52A2A] focus:bg-[#FCE8E8]">
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
