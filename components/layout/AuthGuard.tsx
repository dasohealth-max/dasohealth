'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, signOut } from '@/lib/auth';

export const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    getUser().then((user) => {
      if (!user) {
        router.replace('/login');
      } else {
        setAuthReady(true);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!authReady) return;

    let timeoutId: number | undefined;
    let loggingOut = false;

    const logoutForInactivity = async () => {
      if (loggingOut) return;
      loggingOut = true;

      try {
        await signOut();
      } finally {
        router.replace('/login?reason=timeout');
      }
    };

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(logoutForInactivity, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'focus',
      'keydown',
      'mousedown',
      'mousemove',
      'scroll',
      'touchstart',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });
    document.addEventListener('visibilitychange', resetTimer);
    resetTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
      document.removeEventListener('visibilitychange', resetTimer);
    };
  }, [authReady, router]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#DDE3EA] bg-white shadow-[var(--shadow-md)]">
            <Image src="/brand/das-health-icon.png" alt="DAS Health" width={34} height={34} className="h-9 w-9 object-contain" priority />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#141920]">DAS Health</p>
            <p className="mt-0.5 text-xs text-[#647184]">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

