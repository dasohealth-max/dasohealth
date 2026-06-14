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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D0E8DA] bg-white shadow-lg shadow-[#1C2B22]/10">
            <Image src="/brand/02_daso-health-icon-dark.svg" alt="DASO Health" width={34} height={34} className="h-8 w-8" priority />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#1C2B22]">DASO Health</p>
            <p className="mt-0.5 text-xs text-[#7A9A87]">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
