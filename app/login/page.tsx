'use client';

import Image from 'next/image';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { signIn, getUser } from '@/lib/auth';
import { defaultPathForRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get('from');
  const from = rawFrom && /^\/(?!\/)/.test(rawFrom) ? rawFrom : '';

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUser().then((user) => {
      if (user) router.replace(from || defaultPathForRole(String(user.app_metadata?.role ?? user.user_metadata?.role ?? '')));
    });
  }, [router, from]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const session = await signIn(email.trim(), pass);
      router.push(from || defaultPathForRole(String(session.user.app_metadata?.role ?? session.user.user_metadata?.role ?? '')));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setError(
        msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')
          ? 'Invalid email or password.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-5 py-8">
      <div className="grid min-h-[680px] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[#E2DDD5] bg-white shadow-2xl shadow-[#1C2B22]/12 lg:grid-cols-[1.12fr_500px]">
        <section className="hidden border-r border-[#E2DDD5] bg-[#F0EDE6] p-12 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="max-w-xl">
            <Image
              src="/brand/01_daso-health-primary.svg"
              alt="DASO Health"
              width={280}
              height={90}
              priority
              className="h-auto w-72"
            />
            <div className="mt-14">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7A9A87]">Direct Aid Somalia</p>
              <h1 className="mt-4 max-w-lg text-5xl font-bold leading-[1.05] text-[#1C2B22]">
                Regional Eye Care Management
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#4A6455]">
                Manage campaigns, patients, screening, surgery, follow-up, and reporting with region-based accountability.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="rounded-2xl border border-[#D0E8DA] bg-white/75 p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#0F4D2A]">Secure</p>
              <p className="mt-1.5 leading-5 text-[#4A6455]">Role based access</p>
            </div>
            <div className="rounded-2xl border border-[#D0E8DA] bg-white/75 p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#0F4D2A]">Regional</p>
              <p className="mt-1.5 leading-5 text-[#4A6455]">State scoped data</p>
            </div>
            <div className="rounded-2xl border border-[#D0E8DA] bg-white/75 p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#0F4D2A]">Clinical</p>
              <p className="mt-1.5 leading-5 text-[#4A6455]">Surgery follow-up</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center p-8 sm:p-12">
          <div className="mb-10 lg:hidden">
            <Image
              src="/brand/01_daso-health-primary.svg"
              alt="DASO Health"
              width={240}
              height={78}
              priority
              className="h-auto w-60"
            />
          </div>

          <div className="mb-9">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7A9A87]">Secure access</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1C2B22]">Sign in to DASO Health</h2>
            <p className="mt-2 text-base text-[#4A6455]">Regional Eye Care Management</p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-[#F0C0C0] bg-[#FCE8E8] px-4 py-3 text-sm text-[#B52A2A]">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-semibold text-[#1C2B22]">Email Address</Label>
              <Input
                type="email"
                autoComplete="username"
                suppressHydrationWarning
                placeholder="admin@dasohealth.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-2xl border-[#E2DDD5] bg-[#FAFAF8] px-4 text-base focus:border-[#1A7A46] focus:ring-[#1A7A46]/20"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-semibold text-[#1C2B22]">Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  suppressHydrationWarning
                  placeholder="Password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  className="h-12 rounded-2xl border-[#E2DDD5] bg-[#FAFAF8] px-4 pr-11 text-base focus:border-[#1A7A46] focus:ring-[#1A7A46]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A9A87] hover:text-[#1C2B22]"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-2xl bg-[#1A7A46] text-base font-semibold text-white shadow-lg shadow-[#1A7A46]/20 hover:bg-[#0F4D2A]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-10 text-center text-xs text-[#7A9A87]">
            DASO Health v1.0 | Direct Aid Somalia
          </p>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
