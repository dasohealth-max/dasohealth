'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Eye } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // mounted = component is running in the browser (not SSR)
  // authReady = session check complete
  const [mounted,   setMounted]   = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Mark as mounted first so we show the spinner, not blank content
    setMounted(true);
    const user = getSession();
    if (!user) {
      router.replace('/login');
    } else {
      setAuthReady(true);
    }
  }, [router]);

  // While checking auth or before mount, show branded loading screen
  if (!mounted || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-teal-500/30 animate-pulse">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">EyeCare Pro</p>
            <p className="text-xs text-slate-400 mt-0.5">Loading your workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
