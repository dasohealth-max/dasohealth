'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import type { AppModule } from '@/lib/permissions';
import {
  LayoutDashboard, Megaphone, Users, Microscope,
  Scissors, CalendarCheck,
  FileBarChart, Settings, ChevronLeft, ChevronRight,
  X,
} from 'lucide-react';

const NAV: { label: string; href: string; icon: React.ElementType; module: AppModule }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone, module: 'campaigns' },
  { label: 'Patients', href: '/patients', icon: Users, module: 'patients' },
  { label: 'Screening', href: '/screening', icon: Microscope, module: 'screening' },
  { label: 'Surgery', href: '/surgeries', icon: Scissors, module: 'surgeries' },
  { label: 'Follow-ups', href: '/followups', icon: CalendarCheck, module: 'followups' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, module: 'reports' },
  { label: 'Settings', href: '/settings', icon: Settings, module: 'settings' },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function NavLinks({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const path = usePathname();
  const { canAccess } = usePermissions();
  const visibleNav = NAV.filter(({ module }) => canAccess(module));
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {visibleNav.map(({ label, href, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-all group',
              active
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? label : undefined}
          >
            {active && !collapsed && (
              <span className="absolute left-[-10px] top-2 bottom-2 w-1 rounded-full bg-[#6FCFA0]" />
            )}
            <Icon
              size={18}
              className={cn(
                'shrink-0',
                active ? 'text-white' : 'text-white/60 group-hover:text-white',
              )}
            />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn(
      'flex items-center px-4 py-5 border-b border-white/10 shrink-0',
      collapsed && 'justify-center px-0',
    )}>
      <Image
        src={collapsed ? '/brand/das-health-icon-white.png' : '/brand/das-health-logo-white.png'}
        alt="DAS Health"
        width={collapsed ? 34 : 208}
        height={collapsed ? 34 : 62}
        className={collapsed ? 'h-9 w-9 shrink-0 object-contain' : 'h-auto w-full max-w-[208px] shrink-0 object-contain'}
        priority
      />
    </div>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-64 flex flex-col bg-[#0F4D2A] text-white transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between gap-3 px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Image src="/brand/das-health-logo-white.png" alt="DAS Health" width={208} height={62} className="h-auto w-48 max-w-full object-contain" priority />
          </div>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <NavLinks collapsed={false} onClose={onMobileClose} />
      </aside>

      {/* ── Desktop sidebar (always visible, collapsible) ── */}
      <aside className={cn(
        'hidden lg:relative lg:flex lg:flex-col bg-[#0F4D2A] text-white transition-all duration-300 shrink-0',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      )}>
        <Logo collapsed={collapsed} />
        <NavLinks collapsed={collapsed} />
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center h-12 border-t border-white/10 text-white/65 transition-colors hover:bg-white/10 hover:text-white shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>
    </>
  );
}
