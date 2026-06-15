'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

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

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#D0E8DA] bg-white shadow-[var(--shadow-md)]">
            <Image src="/brand/das-health-icon.png" alt="DAS Health" width={34} height={34} className="h-9 w-9 object-contain" priority />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#1C2B22]">DAS Health</p>
            <p className="mt-0.5 text-xs text-[#7A9A87]">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
