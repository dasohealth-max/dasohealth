import Link from 'next/link';
import {
  Eye, Users, MapPin, Stethoscope, Scissors, ClipboardList,
  BarChart3, Package, ShieldCheck, HeartHandshake, ArrowRight,
  CheckCircle2, Globe,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: 'Patient Management',
    desc: 'Register patients with full clinical profiles, GPS coordinates, consent tracking, and duplicate detection by phone number.',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    icon: Globe,
    title: 'Campaign Tracking',
    desc: 'Plan and monitor eye health campaigns across Somalia with budget tracking, progress towards targets, and multi-location support.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Stethoscope,
    title: 'Clinical Screening',
    desc: 'Record visual acuity, IOP, cataract/glaucoma findings, and auto-route patients to surgery or referral based on recommendation.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Scissors,
    title: 'Surgery Board',
    desc: 'Kanban surgery workflow from Scheduled → In-Theatre → Completed with surgeon assignment and auto-generated follow-up milestones.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: ClipboardList,
    title: 'Follow-Up & Referrals',
    desc: 'Track post-surgery outcomes at Day 1, Week 1, Month 1, and Month 3. Automatic overdue detection with SMS reminder support.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    desc: 'Generate campaign summaries, surgery outcomes, referral conversion rates, and donor briefs. Export to PDF or Excel.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Package,
    title: 'Inventory Control',
    desc: 'Track IOLs, medications, equipment, and consumables with low-stock alerts, expiry warnings, and per-location quantities.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: HeartHandshake,
    title: 'Community Outreach',
    desc: 'Log awareness campaigns, radio broadcasts, school visits, and CHW training with reach and conversion metrics.',
    color: 'bg-pink-50 text-pink-600',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Security',
    desc: '15 distinct roles from Super Administrator to Donor User, each with granular module-level permissions enforced server-side.',
    color: 'bg-slate-50 text-slate-600',
  },
];

const STATS = [
  { value: '15', label: 'User roles' },
  { value: '13', label: 'Clinical modules' },
  { value: '100%', label: 'Database-backed' },
  { value: 'RBAC', label: 'Server-side security' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shadow-md shadow-teal-500/20">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">EyeCare Pro</span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-teal-500/30"
          >
            Login <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[700px] h-[700px] rounded-full bg-teal-500/10 blur-3xl -top-40 -right-20" />
          <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-3xl -bottom-32 -left-20" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <MapPin size={12} /> Built for Somalia Eye Health Programmes
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Eliminate Preventable<br />
            <span className="bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">Blindness</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            A full-stack eye health management platform for screening campaigns, surgery tracking,
            post-operative follow-ups, and donor reporting — built for field operations across East Africa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-teal-500/30"
            >
              Access the Platform <ArrowRight size={18} />
            </Link>
            <a
              href="#features"
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all border border-white/10"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-extrabold text-teal-400 mb-1">{value}</p>
                <p className="text-sm text-slate-400 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Everything your programme needs</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            From patient registration to donor reporting — one platform, one source of truth.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="group p-6 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all bg-white">
              <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-4`}>
                <Icon size={20} />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Clinical workflow, end-to-end</h2>
            <p className="text-slate-500 text-base">Each step automatically triggers the next</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3 justify-center">
            {[
              { step: '01', label: 'Registration', sub: 'Patient + consent' },
              { step: '02', label: 'Screening', sub: 'VA + findings' },
              { step: '03', label: 'Referral', sub: 'Auto-generated' },
              { step: '04', label: 'Surgery', sub: 'Kanban board' },
              { step: '05', label: 'Follow-Up', sub: '4 milestones' },
              { step: '06', label: 'Report', sub: 'PDF / Excel' },
            ].map(({ step, label, sub }, i, arr) => (
              <div key={step} className="flex items-center gap-3">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex flex-col items-center justify-center shadow-md shadow-teal-500/20">
                    <span className="text-[9px] font-bold text-teal-200">{step}</span>
                    <span className="text-xs font-bold leading-tight">{label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight size={16} className="text-slate-300 shrink-0 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security callout */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-slate-900 to-teal-900 rounded-3xl p-10 md:p-14">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold mb-4">
              <ShieldCheck size={16} /> Enterprise Security
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6">Security that goes all the way down</h2>
            <ul className="space-y-3 mb-8">
              {[
                'Supabase Auth JWT — every request validated server-side',
                '15-role permission matrix enforced in every server action',
                'Middleware route protection — unauthenticated access blocked before the page renders',
                'Donor User masking — patient identifiers hidden at the UI layer',
                'Danger zone confirmation — typed phrase required before destructive operations',
                'Service role key never exposed to the client bundle',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Login to Access <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-600 to-indigo-600 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Ready to get started?</h2>
          <p className="text-teal-100 text-lg mb-8">Log in to access your dashboard. New users are created by the Super Administrator.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-teal-700 hover:bg-teal-50 font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg"
          >
            Go to Login <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center">
              <Eye className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-700">EyeCare Pro</span>
          </div>
          <p className="text-sm text-slate-400">Eye Health Management Platform · Somalia</p>
          <Link href="/login" className="text-sm text-teal-600 hover:text-teal-700 font-medium">Staff Login →</Link>
        </div>
      </footer>
    </div>
  );
}
