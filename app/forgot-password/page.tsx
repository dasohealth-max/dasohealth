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

  // Countdown timer — ticks down every second when cooldown > 0
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // When the user clicks the email link they land back on /forgot-password with
  // a #access_token=...&type=recovery hash. Supabase fires PASSWORD_RECOVERY
  // via onAuthStateChange — we jump straight to the password form.
  useEffect(() => {
    const { data: { subscription } } = getClient().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStep('password');
        // Remove the token hash from the address bar
        window.history.replaceState(null, '', window.location.pathname);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  function friendlyError(msg: string): string {
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many'))
      return 'Too many attempts. Please wait 60 seconds before requesting another link.';
    return msg;
  }

  // ── Step 1: send reset link ──────────────────────────────────────────────────
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

  // ── Resend ───────────────────────────────────────────────────────────────────
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

  // ── Step 2: set new password ─────────────────────────────────────────────────
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
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

  const ErrorBanner = () =>
    error ? (
      <div className="mb-5 rounded-xl border border-[#F0C0C0] bg-[#FCE8E8] px-4 py-3 text-sm text-[#8B1E1E]">
        {error}
      </div>
    ) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-5 py-8">
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

        <div className="rounded-2xl border border-[#D0E8DA] bg-white p-8 shadow-[var(--shadow-lg)]">

          {/* ─── Done ──────────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5EE]">
                <CheckCircle className="h-7 w-7 text-[#1A7A46]" />
              </div>
              <h2 className="text-xl font-bold text-[#1C2B22]">Password updated</h2>
              <p className="mt-2 text-sm text-[#7A9A87]">
                Your password has been changed. Sign in with your new password.
              </p>
              <Button
                className="mt-6 h-11 w-full rounded-md bg-[#1A7A46] font-semibold text-white hover:bg-[#0F4D2A]"
                onClick={() => router.push('/login')}
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {/* ─── Step 1: Email ─────────────────────────────────────────────── */}
          {step === 'email' && (
            <>
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7A9A87]">Password reset</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#1C2B22]">Forgot your password?</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#7A9A87]">
                  Enter your Super Administrator email. We&apos;ll send a secure reset link to your inbox.
                </p>
              </div>

              <ErrorBanner />

              <form onSubmit={handleSendLink} className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-[#1C2B22]">Email address</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="admin@dasohealth.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-md border-[#C0D8CC] bg-[#FAFAF8] px-4 text-base focus:border-[#1A7A46] focus:ring-[#1A7A46]/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className="h-12 w-full rounded-md bg-[#1A7A46] text-base font-semibold text-white shadow-[var(--shadow-brand)] hover:bg-[#0F4D2A] disabled:opacity-60"
                >
                  {loading ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}

          {/* ─── Sent (waiting for link click) ─────────────────────────────── */}
          {step === 'sent' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5EE]">
                <Mail className="h-7 w-7 text-[#1A7A46]" />
              </div>
              <h2 className="text-xl font-bold text-[#1C2B22]">Check your inbox</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#7A9A87]">
                We sent a reset link to{' '}
                <span className="font-semibold text-[#1C2B22]">{email}</span>.
                Click the link in that email — this page will automatically show the password form.
              </p>

              {error && (
                <div className="mt-4 rounded-xl border border-[#F0C0C0] bg-[#FCE8E8] px-4 py-3 text-sm text-[#8B1E1E]">
                  {error}
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-[#7A9A87]">
                <span>Didn&apos;t get it?</span>
                {cooldown > 0 ? (
                  <span className="font-semibold text-[#7A9A87]">Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleResend}
                    className="font-semibold text-[#1A7A46] hover:text-[#0F4D2A] disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Resend link'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── New password ──────────────────────────────────────────────── */}
          {step === 'password' && (
            <>
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7A9A87]">New password</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#1C2B22]">Set a new password</h2>
                <p className="mt-2 text-sm text-[#7A9A87]">Must be at least 10 characters.</p>
              </div>

              <ErrorBanner />

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-[#1C2B22]">New password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 10 characters"
                      value={password}
                      onChange={(e) => setPass(e.target.value)}
                      required
                      className="h-12 rounded-md border-[#C0D8CC] bg-[#FAFAF8] px-4 pr-11 text-base focus:border-[#1A7A46] focus:ring-[#1A7A46]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A9A87] hover:text-[#1C2B22]"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-[#1C2B22]">Confirm password</Label>
                  <Input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="h-12 rounded-md border-[#C0D8CC] bg-[#FAFAF8] px-4 text-base focus:border-[#1A7A46] focus:ring-[#1A7A46]/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-md bg-[#1A7A46] text-base font-semibold text-white shadow-[var(--shadow-brand)] hover:bg-[#0F4D2A]"
                >
                  {loading ? 'Saving…' : 'Set New Password'}
                </Button>
              </form>
            </>
          )}

          {/* Back to login */}
          {step !== 'done' && (
            <div className="mt-7 flex justify-center">
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm text-[#7A9A87] transition-colors hover:text-[#1C2B22]"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-[#7A9A87]">DAS Health</p>
      </div>
    </div>
  );
}
