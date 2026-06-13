'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import type { AppModule } from '@/lib/permissions';
import {
  LayoutDashboard, Megaphone, Users, Microscope,
  Scissors, CalendarCheck,
  FileBarChart, Settings, Eye, ChevronLeft, ChevronRight,
  X,
} from 'lucide-react';

const NAV: { label: string; href: string; icon: React.ElementType; module: AppModule }[] = [
  { label: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard, module: 'dashboard'  },
  { label: 'Campaigns',  href: '/campaigns',  icon: Megaphone,       module: 'campaigns'  },
  { label: 'Patients',   href: '/patients',   icon: Users,           module: 'patients'   },
  { label: 'Screening',  href: '/screening',  icon: Microscope,      module: 'screening'  },
  { label: 'Surgery',    href: '/surgeries',  icon: Scissors,        module: 'surgeries'  },
  { label: 'Follow-ups', href: '/followups',  icon: CalendarCheck,   module: 'followups'  },
  { label: 'Reports',    href: '/reports',    icon: FileBarChart,    module: 'reports'    },
  { label: 'Settings',   href: '/settings',   icon: Settings,        module: 'settings'   },
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
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
      {visibleNav.map(({ label, href, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
              active
                ? 'bg-teal-600/90 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? label : undefined}
          >
            <Icon
              size={18}
              className={cn(
                'shrink-0',
                active ? 'text-white' : 'text-slate-400 group-hover:text-white',
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
      'flex items-center gap-3 px-4 py-5 border-b border-slate-700/60 shrink-0',
      collapsed && 'justify-center px-0',
    )}>
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shrink-0">
        <Eye className="w-4 h-4 text-white" />
      </div>
      {!collapsed && (
        <div className="overflow-hidden">
          <p className="text-sm font-bold leading-tight text-white">EyeCare Pro</p>
          <p className="text-[10px] text-slate-400 leading-tight">Health Platform</p>
        </div>
      )}
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
        'fixed top-0 left-0 z-50 h-full w-64 flex flex-col bg-slate-900 text-white transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">EyeCare Pro</p>
              <p className="text-[10px] text-slate-400">Health Platform</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <NavLinks collapsed={false} onClose={onMobileClose} />
      </aside>

      {/* ── Desktop sidebar (always visible, collapsible) ── */}
      <aside className={cn(
        'hidden lg:relative lg:flex lg:flex-col bg-slate-900 text-white transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60',
      )}>
        <Logo collapsed={collapsed} />
        <NavLinks collapsed={collapsed} />
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center h-10 border-t border-slate-700/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>
    </>
  );
}
