'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Role, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InlineForm from '@/components/forms/InlineForm';
import { actionCreateUser, actionDeleteUser, actionGetAllUsers, actionGetAuditLogs, actionUpdateUserMetadata } from '@/app/actions/users';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { usePermissions } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';

interface UserFormData extends Omit<User, 'id' | 'createdAt'> {
  password: string;
}

const BLANK: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'Screening Officer',
  assignedRegion: 'Banadir / Mogadishu',
  initials: '',
  color: '#0d9488',
  active: true,
};

type AuditRow = {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  region?: string;
  details: string;
  createdAt: string;
};

export default function SettingsPage() {
  const { user: sessionUser, role, can } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [form, setForm] = useState<UserFormData>(BLANK);
  const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const allowedRoles: Role[] = useMemo(() => {
    if (role === 'Super Administrator') return ['Project Manager', 'Data Clerk', 'Screening Officer'];
    if (role === 'Project Manager') return ['Data Clerk', 'Screening Officer'];
    return [];
  }, [role]);

  async function loadUsers(showLoading = true) {
    if (showLoading) setIsLoading(true);
    const result = await actionGetAllUsers();
    if (result.ok) setUsers(result.data);
    setIsLoading(false);
  }

  async function loadAudit() {
    const result = await actionGetAuditLogs(100);
    if (result.ok) setAuditRows(result.data);
  }

  useEffect(() => {
    actionGetAllUsers().then((result) => {
      if (result.ok) setUsers(result.data);
      setIsLoading(false);
    });
  }, []);

  function set<K extends keyof UserFormData>(key: K, value: UserFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function initialsFor(name: string) {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  function openAdd() {
    setEditing(null);
    setSaveError('');
    setForm({
      ...BLANK,
      assignedRegion: role === 'Project Manager' ? sessionUser?.assignedRegion : BLANK.assignedRegion,
      role: allowedRoles[0] ?? 'Screening Officer',
    });
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setSaveError('');
    setForm({ ...user, password: '' });
    setShowForm(true);
  }

  async function save() {
    setSaveError('');
    startTransition(async () => {
      const initials = initialsFor(form.name);
      const assignedRegion = role === 'Project Manager' ? sessionUser?.assignedRegion : form.assignedRegion;
      const result = editing
        ? await actionUpdateUserMetadata(editing.id, {
            name: form.name,
            role: form.role,
            assignedRegion,
            initials,
            color: form.color,
          })
        : await actionCreateUser({
            email: form.email,
            password: form.password,
            name: form.name,
            role: form.role,
            assignedRegion,
            initials,
            color: form.color,
          });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      await loadUsers(false);
      setShowForm(false);
      setEditing(null);
    });
  }

  async function remove(user: User) {
    const result = await actionDeleteUser(user.id);
    if (result.ok) setUsers((rows) => rows.filter((row) => row.id !== user.id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage regional users and review accountability logs</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="users" className="rounded-lg">Users</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg" onClick={loadAudit}>Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{users.length} users available</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { void loadUsers(); }} className="h-9 rounded-xl px-3">
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </Button>
              {can('settings', 'create') && !showForm && <Button onClick={openAdd} className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"><Plus size={15} />Add User</Button>}
              {showForm && <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-xl"><X size={14} />Cancel</Button>}
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {saveError}
            </div>
          )}

          {showForm && (
            <InlineForm
              title={editing ? `Edit ${editing.name}` : 'Add Regional User'}
              onClose={() => setShowForm(false)}
              onSave={save}
              saveLabel={editing ? 'Update User' : 'Add User'}
              saveDisabled={!form.name || !form.email || !form.role || !form.assignedRegion || (!editing && form.password.length < 6) || isPending}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div><Label className="mb-1 block text-xs">Full Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" /></div>
                <div><Label className="mb-1 block text-xs">Email *</Label><Input type="email" disabled={!!editing} value={form.email} onChange={(e) => set('email', e.target.value)} className="rounded-xl" /></div>
                {!editing && <div><Label className="mb-1 block text-xs">Password *</Label><Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="rounded-xl" /></div>}
                <div>
                  <Label className="mb-1 block text-xs">Role *</Label>
                  <Select value={form.role} onValueChange={(value) => { if (value) set('role', value as Role); }}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{allowedRoles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Assigned Region *</Label>
                  <Select value={form.assignedRegion ?? ''} onValueChange={(value) => { if (value) set('assignedRegion', value); }} disabled={role === 'Project Manager'}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{REGIONAL_CAMPAIGN_AREAS.map((area) => <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="mb-1 block text-xs">Avatar Colour</Label><Input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="h-10 rounded-xl p-1" /></div>
              </div>
            </InlineForm>
          )}

          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>{['User', 'Email', 'Role', 'Region', 'Status', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                        <td className="px-4 py-3 text-slate-500">{user.email}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">{user.role}</span></td>
                        <td className="px-4 py-3 text-slate-600">{user.assignedRegion ?? 'All regions'}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{user.active ? 'Active' : 'Inactive'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {can('settings', 'edit') && <button onClick={() => openEdit(user)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={14} /></button>}
                            {can('settings', 'delete') && user.email !== sessionUser?.email && <button onClick={() => remove(user)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>{['When', 'Actor', 'Role', 'Action', 'Entity', 'Region', 'Details'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(row.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.actorName}</td>
                        <td className="px-4 py-3 text-slate-500">{row.actorRole}</td>
                        <td className="px-4 py-3 text-slate-600">{row.action}</td>
                        <td className="px-4 py-3 text-slate-600">{row.entity}</td>
                        <td className="px-4 py-3 text-slate-600">{row.region ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{row.details}</td>
                      </tr>
                    ))}
                    {auditRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">No audit logs loaded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
