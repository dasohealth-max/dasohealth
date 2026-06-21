'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { actionRequestPasswordReset } from '@/app/actions/auth';

type Step = 'email' | 'sent' | 'password' | 'done';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createBrowserClient(url, anon);
}

function ErrorBanner({ error }: { error: string }) {
  return error ? (
    <div className="mb-5 rounded-xl border border-[#FACDCB] bg-[#FDECEB] px-4 py-3 text-sm text-[#A32421]">
      {error}
    </div>
  ) : null;
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep]       = useState<Step>('email');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [cooldown, setCooldown] = useState(0); // seconds remaining before resend is allowed

  // Countdown timer â€” ticks down every second when cooldown > 0
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // When the user clicks the email link they land on /forgot-password with a
  // #access_token=...&type=recovery hash. We parse it immediately on mount
  // (before any async subscription can miss the event) and call setSession
  // directly to establish the recovery session, then show the password form.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.slice(1));
      const type         = params.get('type');
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (type === 'recovery' && accessToken && refreshToken) {
        getClient()
          .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (!error) {
              window.history.replaceState(null, '', window.location.pathname);
              setStep('password');
            }
          });
        return;
      }
    }

    // Fallback: also listen for the PASSWORD_RECOVERY event in case the hash
    // is processed by Supabase before we read it above.
    const { data: { subscription } } = getClient().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.history.replaceState(null, '', window.location.pathname);
        setStep('password');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  function friendlyError(msg: string): string {
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many'))
      return 'Too many attempts. Please wait 60 seconds before requesting another link.';
    return msg;
  }

  // â”€â”€ Step 1: send reset link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const redirectUrl = `${window.location.origin}/forgot-password`;
    const result = await actionRequestPasswordReset(email.trim(), redirectUrl);
    setLoading(false);

    if (!result.ok) {
      setError(friendlyError(result.error ?? 'An error occurred.'));
      if ((result.error ?? '').toLowerCase().includes('rate limit') ||
          (result.error ?? '').toLowerCase().includes('too many')) {
        setCooldown(60);
      }
      return;
    }
    setCooldown(60);
    setStep('sent');
  }

  // â”€â”€ Resend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleResend() {
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    const redirectUrl = `${window.location.origin}/forgot-password`;
    const result = await actionRequestPasswordReset(email.trim(), redirectUrl);
    setLoading(false);
    if (!result.ok) {
      setError(friendlyError(result.error ?? 'An error occurred.'));
    }
    setCooldown(60);
  }

  // â”€â”€ Step 2: set new password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: updateError } = await getClient().auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    await getClient().auth.signOut();
    setLoading(false);
    setStep('done');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-5 py-8">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/das-health-logo-transparent.png"
            alt="DAS Health"
            width={220}
            height={72}
            priority
            className="h-auto w-52 object-contain"
          />
        </div>

        <div className="rounded-2xl border border-[#DDE3EA] bg-white p-8 shadow-(--shadow-lg)">

          {/* â”€â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'done' && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF7EE]">
                <CheckCircle className="h-7 w-7 text-[#2C9942]" />
              </div>
              <h2 className="text-xl font-bold text-[#141920]">Password updated</h2>
              <p className="mt-2 text-sm text-[#647184]">
                Your password has been changed. Sign in with your new password.
              </p>
              <Button
                className="mt-6 h-11 w-full rounded-md bg-[#2C9942] font-semibold text-white hover:bg-[#002E63]"
                onClick={() => router.push('/login')}
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {/* â”€â”€â”€ Step 1: Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'email' && (
            <>
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#647184]">Password reset</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#141920]">Forgot your password?</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#647184]">
                  Enter your Super Administrator email. We&apos;ll send a secure reset link to your inbox.
                </p>
              </div>

              <ErrorBanner error={error} />

              <form onSubmit={handleSendLink} className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-[#141920]">Email address</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="admin@dasohealth.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-md border-[#CDD5DF] bg-[#F5F7FA] px-4 text-base focus:border-[#2C9942] focus:ring-[#2C9942]/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className="h-12 w-full rounded-md bg-[#2C9942] text-base font-semibold text-white shadow-(--shadow-brand) hover:bg-[#002E63] disabled:opacity-60"
                >
                  {loading ? 'Sendingâ€¦' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}

          {/* â”€â”€â”€ Sent (waiting for link click) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'sent' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF7EE]">
                <Mail className="h-7 w-7 text-[#2C9942]" />
              </div>
              <h2 className="text-xl font-bold text-[#141920]">Check your inbox</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#647184]">
                We sent a reset link to{' '}
                <span className="font-semibold text-[#141920]">{email}</span>.
                Click the link in that email â€” this page will automatically show the password form.
              </p>

              {error && (
                <div className="mt-4 rounded-xl border border-[#FACDCB] bg-[#FDECEB] px-4 py-3 text-sm text-[#A32421]">
                  {error}
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-[#647184]">
                <span>Didn&apos;t get it?</span>
                {cooldown > 0 ? (
                  <span className="font-semibold text-[#647184]">Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleResend}
                    className="font-semibold text-[#2C9942] hover:text-[#002E63] disabled:opacity-50"
                  >
                    {loading ? 'Sendingâ€¦' : 'Resend link'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* â”€â”€â”€ New password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'password' && (
            <>
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#647184]">New password</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#141920]">Set a new password</h2>
                <p className="mt-2 text-sm text-[#647184]">Must be at least 8 characters.</p>
              </div>

              <ErrorBanner error={error} />

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-[#141920]">New password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPass(e.target.value)}
                      required
                      className="h-12 rounded-md border-[#CDD5DF] bg-[#F5F7FA] px-4 pr-11 text-base focus:border-[#2C9942] focus:ring-[#2C9942]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#647184] hover:text-[#141920]"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-[#141920]">Confirm password</Label>
                  <Input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="h-12 rounded-md border-[#CDD5DF] bg-[#F5F7FA] px-4 text-base focus:border-[#2C9942] focus:ring-[#2C9942]/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-md bg-[#2C9942] text-base font-semibold text-white shadow-(--shadow-brand) hover:bg-[#002E63]"
                >
                  {loading ? 'Savingâ€¦' : 'Set New Password'}
                </Button>
              </form>
            </>
          )}

          {/* Back to login */}
          {step !== 'done' && (
            <div className="mt-7 flex justify-center">
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm text-[#647184] transition-colors hover:text-[#141920]"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-[#647184]">DAS Health</p>
      </div>
    </div>
  );
}

