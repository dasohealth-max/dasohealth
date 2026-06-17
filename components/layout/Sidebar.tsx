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
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {visibleNav.map(({ label, href, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-all',
              active
                ? 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? label : undefined}
          >
            {active && !collapsed && (
              <span className="absolute bottom-2 left-[-10px] top-2 w-1 rounded-full bg-[var(--sidebar-ring)]" />
            )}
            <Icon
              size={18}
              className={cn(
                'shrink-0',
                active ? 'text-[var(--sidebar-primary-foreground)]' : 'text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-accent-foreground)]',
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
      'flex shrink-0 items-center border-b border-[var(--sidebar-border)] px-4 py-5',
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
      {/* â”€â”€ Mobile overlay backdrop â”€â”€ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* â”€â”€ Mobile drawer â”€â”€ */}
      <aside className={cn(
        'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--sidebar-border)] px-4 py-5">
          <div className="flex items-center gap-3">
            <Image src="/brand/das-health-logo-white.png" alt="DAS Health" width={208} height={62} className="h-auto w-48 max-w-full object-contain" priority />
          </div>
          <button
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
          >
            <X size={18} />
          </button>
        </div>
        <NavLinks collapsed={false} onClose={onMobileClose} />
      </aside>

      {/* â”€â”€ Desktop sidebar (always visible, collapsible) â”€â”€ */}
      <aside className={cn(
        'hidden shrink-0 border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-[var(--sidebar-shadow)] transition-all duration-300 lg:relative lg:flex lg:flex-col',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      )}>
        <Logo collapsed={collapsed} />
        <NavLinks collapsed={collapsed} />
        <button
          onClick={onToggleCollapse}
          className="flex h-12 shrink-0 items-center justify-center border-t border-[var(--sidebar-border)] text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>
    </>
  );
}

