'use client';
import { useState, useEffect, useTransition } from 'react';
import { formatDateTime } from '@/lib/utils';
import type { User, Role } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, Shield, Activity, X, Eye, EyeOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { usePermissions } from '@/lib/auth';
import {
  actionGetAllUsers,
  actionCreateUser,
  actionUpdateUserMetadata,
  actionDeleteUser,
  actionGetAuditLogs,
} from '@/app/actions/users';

interface UserFormData extends Omit<User, 'id' | 'createdAt'> {
  password: string;
}

const ROLES: Role[] = [
  'Super Administrator','Project Manager','Campaign Manager','Hospital Coordinator',
  'Data Clerk','Screening Officer','Ophthalmologist','Surgeon',
  'Follow-Up Officer','Outreach Officer','Logistics Officer','Inventory Officer',
  'MEAL Officer','Finance Officer','Donor User',
];

const ROLE_COLORS: Record<string, string> = {
  'Super Administrator': 'bg-teal-100 text-teal-700',
  'Project Manager':     'bg-amber-100 text-amber-700',
  'Campaign Manager':    'bg-indigo-100 text-indigo-700',
  'Hospital Coordinator':'bg-orange-100 text-orange-700',
  'Data Clerk':          'bg-slate-100 text-slate-700',
  'Screening Officer':   'bg-cyan-100 text-cyan-700',
  'Ophthalmologist':     'bg-purple-100 text-purple-700',
  'Surgeon':             'bg-blue-100 text-blue-700',
  'Follow-Up Officer':   'bg-emerald-100 text-emerald-700',
  'Outreach Officer':    'bg-green-100 text-green-700',
  'Logistics Officer':   'bg-yellow-100 text-yellow-700',
  'Inventory Officer':   'bg-rose-100 text-rose-700',
  'MEAL Officer':        'bg-sky-100 text-sky-700',
  'Finance Officer':     'bg-violet-100 text-violet-700',
  'Donor User':          'bg-pink-100 text-pink-700',
};

const BLANK: UserFormData = {
  name: '', email: '', password: '', role: 'Screening Officer', initials: '', color: '#0d9488', active: true,
};

const DEFAULT_ORG = {
  name: 'EyeCare Somalia', country: 'Somalia', region: 'East Africa',
  email: 'info@eyecare.org',
  mission: 'To eliminate preventable blindness across East Africa through community-led eye health programmes.',
};

type AuditRow = { id: string; actor: string; action: string; entity: string; entityId: string; details: string; createdAt: string };

export default function SettingsPage() {
  const { user: sessionUser, can } = usePermissions();
  const [users, setUsers]           = useState<User[]>([]);
  const [auditLogs, setAuditLogs]   = useState<AuditRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<User | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [form, setForm]             = useState<UserFormData>(BLANK);
  const [showPass, setShowPass]     = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Danger zone: require typing exact phrase
  const [dangerPhrase, setDangerPhrase] = useState('');
  const [showDanger, setShowDanger]     = useState(false);
  const CONFIRM_PHRASE = 'DELETE ALL DATA';

  const [org, setOrg]           = useState(DEFAULT_ORG);
  const [orgSaved, setOrgSaved] = useState(false);

  async function loadUsers() {
    setIsLoadingUsers(true);
    const result = await actionGetAllUsers();
    if (result.ok) setUsers(result.data);
    setIsLoadingUsers(false);
  }

  async function loadAudit() {
    setIsLoadingAudit(true);
    const result = await actionGetAuditLogs(100);
    if (result.ok) setAuditLogs(result.data);
    setIsLoadingAudit(false);
  }

  useEffect(() => { loadUsers(); }, []);

  function saveOrg() { setOrgSaved(true); setTimeout(() => setOrgSaved(false), 3000); }

  function openAdd() { setEditing(null); setForm(BLANK); setSaveError(null); setShowForm(true); }
  function openEdit(u: User) {
    setEditing(u);
    const { id, createdAt, ...r } = u;
    setForm({ ...r, password: '' });
    setSaveError(null);
    setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditing(null); setSaveError(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof UserFormData, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaveError(null);
    startTransition(async () => {
      const initials = form.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

      if (editing) {
        const result = await actionUpdateUserMetadata(editing.id, {
          name: form.name, role: form.role, initials, color: form.color,
        });
        if (!result.ok) { setSaveError(result.error); return; }
      } else {
        const { password } = form;
        const result = await actionCreateUser({
          email: form.email, password, name: form.name,
          role: form.role, initials, color: form.color,
        });
        if (!result.ok) { setSaveError(result.error); return; }
      }
      await loadUsers();
      cancel();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage users, roles, and organisation profile</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="bg-slate-100 rounded-xl p-1">
          <TabsTrigger value="users"  className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Users & Roles</TabsTrigger>
          <TabsTrigger value="org"   className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Organisation</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm" onClick={loadAudit}>Audit Log</TabsTrigger>
        </TabsList>

        {/* Users */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{users.length} users registered</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadUsers} className="gap-2 rounded-xl text-slate-600 h-9 px-3">
                <RefreshCw size={13} className={isLoadingUsers ? 'animate-spin' : ''} />
              </Button>
              {can('settings','create') && !showForm
                ? <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={16} />Add User</Button>
                : showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          {showForm && (
            <InlineForm
              title={editing ? `Edit — ${editing.name}` : 'Add User'}
              onClose={cancel}
              onSave={save}
              saveLabel={editing ? 'Update' : 'Add User'}
              saveDisabled={!form.name || !form.email || (!editing && (!form.password || form.password.length < 6)) || isPending}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label className="text-xs mb-1 block">Full Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" placeholder="e.g. Dr. Ahmed Hassan" /></div>
                <div><Label className="text-xs mb-1 block">Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="rounded-xl" placeholder="user@eyecare.org" disabled={!!editing} />
                  {editing && <p className="text-xs text-slate-400 mt-0.5">Email cannot be changed after creation.</p>}
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1 block">
                    Password {editing ? <span className="text-slate-400 font-normal">(not editable here — use Supabase dashboard to reset)</span> : <span className="text-red-500">*</span>}
                  </Label>
                  {!editing && (
                    <div className="relative">
                      <Input
                        type={showPass ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        className="rounded-xl pr-10"
                        placeholder="Min. 6 characters"
                      />
                      <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  )}
                  {!editing && form.password && form.password.length < 6 && (
                    <p className="text-xs text-red-500 mt-0.5">Minimum 6 characters</p>
                  )}
                </div>
                <div><Label className="text-xs mb-1 block">Role</Label>
                  <Select value={form.role} onValueChange={(v) => set('role', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs mb-1 block">Avatar Colour</Label><Input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="rounded-xl h-10 p-1" /></div>
              </div>
            </InlineForm>
          )}

          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {isLoadingUsers ? (
                <div className="text-center py-10 text-slate-400 text-sm">Loading users…</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['User', 'Email', 'Role', 'Status', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No users found.</td></tr>
                    )}
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: u.color }}>
                              {u.initials || u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {can('settings','edit') && <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={14} /></button>}
                            {can('settings','delete') && u.email !== sessionUser?.email && (
                              <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Role matrix summary */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Shield size={15} />Role Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const count = users.filter((u) => u.role === role).length;
                  return (
                    <div key={role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${ROLE_COLORS[role] || 'bg-slate-100 text-slate-600'}`}>
                      {role} <span className="font-bold">({count})</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organisation */}
        <TabsContent value="org" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Organisation Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {orgSaved && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2.5 text-sm font-medium">
                  <span>✓</span> Organisation profile saved successfully.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs mb-1 block">Organisation Name</Label><Input value={org.name} onChange={(e) => setOrg((o) => ({ ...o, name: e.target.value }))} className="rounded-xl" /></div>
                <div><Label className="text-xs mb-1 block">Country</Label><Input value={org.country} onChange={(e) => setOrg((o) => ({ ...o, country: e.target.value }))} className="rounded-xl" /></div>
                <div><Label className="text-xs mb-1 block">Region</Label><Input value={org.region} onChange={(e) => setOrg((o) => ({ ...o, region: e.target.value }))} className="rounded-xl" /></div>
                <div><Label className="text-xs mb-1 block">Contact Email</Label><Input type="email" value={org.email} onChange={(e) => setOrg((o) => ({ ...o, email: e.target.value }))} className="rounded-xl" /></div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Mission Statement</Label>
                <textarea value={org.mission} onChange={(e) => setOrg((o) => ({ ...o, mission: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-20" />
              </div>
              <Button onClick={saveOrg} disabled={!org.name.trim()} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit log */}
        <TabsContent value="audit" className="mt-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Activity size={15} className="text-teal-600" />
              <CardTitle className="text-sm font-semibold text-slate-700">Audit Log</CardTitle>
              <Button variant="outline" size="sm" onClick={loadAudit} className="ml-auto rounded-xl gap-1.5 h-7 text-xs">
                <RefreshCw size={11} className={isLoadingAudit ? 'animate-spin' : ''} />Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingAudit ? (
                <div className="text-center py-10 text-slate-400 text-sm">Loading…</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No audit events yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['Actor','Action','Entity','Details','Time'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{log.actor}</td>
                        <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{log.action}</span></td>
                        <td className="px-4 py-2.5 text-slate-500">{log.entity}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs max-w-52 truncate">{log.details}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone — Super Administrator only */}
      {sessionUser?.role === 'Super Administrator' && (
        <Card className="border border-red-200 bg-red-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle size={15} /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Clear All Database Records</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently deletes <strong>all patients, campaigns, screenings, surgeries,
                referrals, follow-ups, inventory, outreach, and transport records</strong>.
                Affects all users immediately. <strong>Cannot be undone.</strong>
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setDangerPhrase(''); setShowDanger(true); }}
              className="shrink-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 rounded-xl gap-2"
            >
              <AlertTriangle size={14} /> Clear Database
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete user confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the user from the system permanently. They will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) { await actionDeleteUser(deleteId); await loadUsers(); }
                setDeleteId(null);
              }}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >Delete User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Danger zone — typed confirmation required */}
      <AlertDialog open={showDanger} onOpenChange={(o) => { if (!o) setShowDanger(false); }}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={18} /> Clear All Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 leading-relaxed">
              This permanently deletes all records from the database for every user.
              <br /><br />
              To confirm, type <strong className="font-mono text-red-600">{CONFIRM_PHRASE}</strong> exactly:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Input
              value={dangerPhrase}
              onChange={(e) => setDangerPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="rounded-xl border-red-200 focus:border-red-400 font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={dangerPhrase !== CONFIRM_PHRASE}
              onClick={() => {
                setShowDanger(false);
                setDangerPhrase('');
              }}
              className="bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-40 gap-2"
            >
              <AlertTriangle size={14} /> Yes, Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
