'use client';
import { useState } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [collapsed,  setCollapsed]    = useState(false);

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden" data-print-shell="">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0 bg-[var(--surface-app)]" data-print-shell="">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-[var(--surface-app)] p-4 sm:p-6" data-print-shell="">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

