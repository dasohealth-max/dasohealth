'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield, UserRound, BarChart3, HeartHandshake } from 'lucide-react';
import { setSession, getSession } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const DEMOS = [
  { email: 'admin@eyecare.org',   pass: 'admin123',  label: 'Super Admin',     desc: 'Full access',        icon: Shield,         color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
  { email: 'dr.sara@eyecare.org', pass: 'doctor123', label: 'Ophthalmologist', desc: 'Clinical access',    icon: UserRound,      color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
  { email: 'pm@eyecare.org',      pass: 'pm123',     label: 'Project Manager', desc: 'Campaign & reports', icon: BarChart3,      color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { email: 'donor@eyecare.org',   pass: 'donor123',  label: 'Donor',           desc: 'Aggregate view',     icon: HeartHandshake, color: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100' },
];

export default function LoginPage() {
  const router = useRouter();
  const { users } = useStore();
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) router.replace('/dashboard');
  }, [router]);

  function fill(e: string, p: string) {
    setEmail(e); setPass(p); setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 400));

    const emailLower = email.trim().toLowerCase();

    // 1. Check against store users (includes all newly created users)
    const storeUser = users.find(
      (u) => u.email.toLowerCase() === emailLower && u.password === pass && u.active
    );

    if (storeUser) {
      setSession({
        email:    storeUser.email,
        name:     storeUser.name,
        role:     storeUser.role,
        initials: storeUser.initials,
        color:    storeUser.color,
      });
      router.push('/dashboard');
    } else {
      setError('Invalid email or password.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-3xl -top-40 -right-20" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-3xl -bottom-32 -left-20" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
              <Eye className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">EyeCare Pro</h1>
            <p className="text-slate-500 text-sm mt-1">Eye Health Management Platform</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span> {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-slate-700 font-medium text-sm mb-1.5 block">Email Address</Label>
              <Input
                type="email"
                placeholder="admin@eyecare.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-slate-700 font-medium text-sm mb-1.5 block">Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  className="h-11 border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl font-semibold shadow-md shadow-teal-500/30 transition-all"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Demo Accounts</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMOS.map(({ email: e, pass: p, label, desc, icon: Icon, color }) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => fill(e, p)}
                  className={cn('flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all text-xs font-medium', color)}
                >
                  <Icon size={14} className="shrink-0" />
                  <div>
                    <div className="font-semibold">{label}</div>
                    <div className="opacity-70 font-normal">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-4">
          EyeCare Pro v1.0 · Secure health data platform
        </p>
      </div>
    </div>
  );
}
