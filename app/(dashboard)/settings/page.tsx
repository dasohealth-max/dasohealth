'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDateTime } from '@/lib/utils';
import type { User, Role } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, Shield, Activity, X, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { usePermissions } from '@/lib/auth';
import { actionCreateUser, actionUpdateUserMetadata, actionDeleteUser } from '@/app/actions/users';

// Form data type — extends User with a `password` field used only during creation.
// Password is never stored in the User domain type; it goes straight to Supabase Auth.
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
  name: 'EyeCare Somalia',
  country: 'Somalia',
  region: 'East Africa',
  email: 'info@eyecare.org',
  mission: 'To eliminate preventable blindness across East Africa through community-led eye health programmes.',
};

export default function SettingsPage() {
  const { users, auditLogs, addUser, updateUser, deleteUser, resetStore } = useStore();
  const { user: sessionUser } = usePermissions();
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<User | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [form, setForm]                 = useState<UserFormData>(BLANK);
  const [showPass, setShowPass]         = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  // Org profile state
  const [org, setOrg]       = useState(DEFAULT_ORG);
  const [orgSaved, setOrgSaved] = useState(false);

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
    const initials = form.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const { password, ...userFields } = form;

    if (editing) {
      updateUser({ ...editing, ...userFields, initials });
      // Update Supabase Auth metadata for UUID-based users (not legacy seeds)
      if (editing.id.length > 10) {
        await actionUpdateUserMetadata(editing.id, {
          name: form.name, role: form.role, initials, color: form.color,
        });
      }
    } else {
      const result = await actionCreateUser({
        email: form.email, password, name: form.name,
        role: form.role, initials, color: form.color,
      });
      if (!result.ok) { setSaveError(result.error); return; }
      addUser({ id: result.data.id, createdAt: new Date().toISOString(), ...userFields, initials });
    }
    cancel();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage users, roles, and organisation profile</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="bg-slate-100 rounded-xl p-1">
          <TabsTrigger value="users" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Users & Roles</TabsTrigger>
          <TabsTrigger value="org" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Organisation</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Audit Log</TabsTrigger>
        </TabsList>

        {/* Users */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{users.length} users registered</p>
            {!showForm
              ? <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={16} />Add User</Button>
              : <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>
            }
          </div>

          {saveError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          {showForm && (
            <InlineForm
              title={editing ? `Edit â€” ${editing.name}` : 'Add User'}
              onClose={cancel}
              onSave={save}
              saveLabel={editing ? 'Update' : 'Add User'}
              saveDisabled={!form.name || !form.email || (!editing && (!form.password || form.password.length < 6))}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label className="text-xs mb-1 block">Full Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" placeholder="e.g. Dr. Ahmed Hassan" /></div>
                <div><Label className="text-xs mb-1 block">Email *</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="rounded-xl" placeholder="user@eyecare.org" /></div>
                {/* Password field â€” required on add, optional on edit */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1 block">
                    Password {editing ? <span className="text-slate-400 font-normal">(leave blank to keep current)</span> : <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      className="rounded-xl pr-10"
                      placeholder={editing ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : 'Min. 6 characters'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
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
                <div className="flex items-center gap-2 col-span-full">
                  <input type="checkbox" id="active" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-4 h-4 accent-teal-600 rounded" />
                  <Label htmlFor="active" className="text-sm">Active account</Label>
                </div>
              </div>
            </InlineForm>
          )}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{['User', 'Email', 'Role', 'Status', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: u.color }}>{u.initials}</div>
                          <span className="font-medium text-slate-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <span>âœ“</span> Organisation profile saved successfully.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1 block">Organisation Name</Label>
                  <Input value={org.name} onChange={(e) => setOrg((o) => ({ ...o, name: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Country</Label>
                  <Input value={org.country} onChange={(e) => setOrg((o) => ({ ...o, country: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Region</Label>
                  <Input value={org.region} onChange={(e) => setOrg((o) => ({ ...o, region: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Contact Email</Label>
                  <Input type="email" value={org.email} onChange={(e) => setOrg((o) => ({ ...o, email: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Mission Statement</Label>
                <textarea
                  value={org.mission}
                  onChange={(e) => setOrg((o) => ({ ...o, mission: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-20"
                />
              </div>
              <Button
                onClick={saveOrg}
                disabled={!org.name.trim()}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50"
              >
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit log */}
        <TabsContent value="audit" className="mt-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Activity size={15} className="text-teal-600" />
              <CardTitle className="text-sm font-semibold text-slate-700">Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No audit events yet. Actions taken in the app will appear here.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>{['Actor','Action','Entity','Details','Time'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {auditLogs.slice(0, 50).map((log) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{log.actor}</td>
                        <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{log.action}</span></td>
                        <td className="px-4 py-2.5 text-slate-500">{log.entity}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[200px] truncate">{log.details}</td>
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

      {/* â”€â”€ Danger Zone â€” Super Administrator only â”€â”€ */}
      {sessionUser?.role === 'Super Administrator' && (
        <Card className="border border-red-200 bg-red-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle size={15} /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Clear All Data</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently deletes all patients, campaigns, screenings, surgeries, referrals, follow-ups,
                inventory, outreach, transport and all other users. <strong>Only your account will remain.</strong>
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setConfirmReset(true)}
              className="shrink-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 rounded-xl gap-2"
            >
              <AlertTriangle size={14} /> Clear Database
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete user confirm */}
      {/* Delete user confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) {
                  await actionDeleteUser(deleteId);
                  deleteUser(deleteId);
                }
                setDeleteId(null);
              }}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear database confirm */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={18} /> Clear All Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 leading-relaxed">
              This will permanently delete <strong>all patients, campaigns, locations, screenings,
              surgeries, referrals, follow-ups, inventory, outreach, transport records and all other users</strong>.
              <br /><br />
              Only your Super Administrator account will be kept. <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const myUser = users.find((u) => u.email === sessionUser?.email);
                if (myUser) resetStore(myUser.id);
                setConfirmReset(false);
              }}
              className="bg-red-600 hover:bg-red-700 rounded-xl gap-2"
            >
              <AlertTriangle size={14} /> Yes, Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
