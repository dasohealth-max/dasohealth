import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, MapPin, ShieldCheck, Stethoscope } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-3 rounded-2xl bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200 ring-1 ring-teal-400/20">
            <Eye size={18} /> EyeCare Pro
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Regional eye surgery campaign management for Somalia</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Manage one-region campaigns, assigned Project Managers, patient registration, screening, scheduled surgery, follow-up, reports, and audit accountability.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/login" className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Sign in</Link>
            <Link href="/dashboard" className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Dashboard</Link>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature icon={MapPin} title="Region scoped" text="Campaigns, users, patients, surgery, and reports are scoped by assigned state/region." />
          <Feature icon={Stethoscope} title="Surgery workflow" text="Screening recommendations create scheduled surgery records and completion creates follow-up tasks." />
          <Feature icon={ShieldCheck} title="Accountability" text="Every important mutation records who did it, their role, region, entity, and timestamp." />
        </div>
      </div>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Eye; title: string; text: string }) {
  return (
    <Card className="border-white/10 bg-white/5 text-white">
      <CardContent className="p-5">
        <Icon className="mb-4 text-teal-300" size={22} />
        <p className="font-semibold">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
      </CardContent>
    </Card>
  );
}
