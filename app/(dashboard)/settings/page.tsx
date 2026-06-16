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
import { actionCreateUser, actionDeleteUser, actionGetAllUsers, actionGetAuditLogs, actionResetUserPassword, actionUpdateUserMetadata } from '@/app/actions/users';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { usePermissions } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { AlertTriangle, KeyRound, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';

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
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [auditRegion, setAuditRegion] = useState('all');
  const [auditAction, setAuditAction] = useState('all');
  const [auditDate, setAuditDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const allowedRoles: Role[] = useMemo(() => {
    if (role === 'Super Administrator') return ['Project Manager', 'Data Clerk', 'Screening Officer'];
    if (role === 'Project Manager') return ['Data Clerk', 'Screening Officer'];
    return [];
  }, [role]);

  const visibleUsers = useMemo(() => {
    if (role !== 'Super Administrator' || selectedRegion === 'all') return users;
    return users.filter((item) => item.assignedRegion === selectedRegion);
  }, [role, selectedRegion, users]);

  const visibleAuditRows = useMemo(() => {
    return auditRows.filter((row) => {
      const matchesRegion = auditRegion === 'all' || row.region === auditRegion;
      const matchesAction = auditAction === 'all' || row.action === auditAction;
      const matchesDate = !auditDate || row.createdAt.startsWith(auditDate);
      return matchesRegion && matchesAction && matchesDate;
    });
  }, [auditAction, auditDate, auditRegion, auditRows]);

  const auditActions = useMemo(
    () => Array.from(new Set(auditRows.map((row) => row.action))).sort(),
    [auditRows],
  );

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
    setResetTarget(null);
    setSaveError('');
    setForm({ ...user, password: '' });
    setShowForm(true);
  }

  function openResetPassword(user: User) {
    setResetTarget(user);
    setResetPassword('');
    setResetError('');
    setShowForm(false);
    setEditing(null);
  }

  function canResetPassword(target: User) {
    if (!can('settings', 'edit')) return false;
    if (role === 'Super Administrator') return true;
    if (role === 'Project Manager') {
      return target.assignedRegion === sessionUser?.assignedRegion
        && (target.role === 'Data Clerk' || target.role === 'Screening Officer');
    }
    return false;
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

  async function resetUserPassword() {
    if (!resetTarget) return;
    setResetError('');
    startTransition(async () => {
      const result = await actionResetUserPassword(resetTarget.id, resetPassword);
      if (!result.ok) {
        setResetError(result.error);
        return;
      }
      setResetTarget(null);
      setResetPassword('');
      await loadAudit();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#141920]">Settings</h1>
        <p className="text-sm text-[#4B5666]">Manage regional users and review accountability logs</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="rounded-xl bg-[#EAEEF3] p-1">
          <TabsTrigger value="users" className="rounded-lg">Users</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg" onClick={loadAudit}>Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#4B5666]">
              {visibleUsers.length} of {users.length} users shown
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { void loadUsers(); }} className="h-9 rounded-xl px-3">
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </Button>
              {can('settings', 'create') && !showForm && <Button onClick={openAdd} className="gap-2 rounded-xl bg-[#2C9942] text-white hover:bg-[#002E63]"><Plus size={15} />Add User</Button>}
              {(showForm || resetTarget) && <Button variant="outline" onClick={() => { setShowForm(false); setResetTarget(null); }} className="gap-2 rounded-xl"><X size={14} />Cancel</Button>}
            </div>
          </div>

          {role === 'Super Administrator' && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#DDE3EA] bg-white px-4 py-3 shadow-sm">
              <div className="min-w-72">
                <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Filter by State</Label>
                <Select value={selectedRegion} onValueChange={(value) => { if (value) setSelectedRegion(value); }}>
                  <SelectTrigger className="rounded-xl border-[#DDE3EA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {REGIONAL_CAMPAIGN_AREAS.map((area) => (
                      <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="pb-2 text-xs text-[#647184]">
                Showing users by assigned state/region.
              </p>
            </div>
          )}

          {saveError && (
            <div className="flex items-start gap-2 rounded-xl border border-[#FACDCB] bg-[#FDECEB] px-4 py-2.5 text-sm font-medium text-[#E53935]">
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

          {resetTarget && (
            <InlineForm
              title={`Reset Password - ${resetTarget.name}`}
              onClose={() => setResetTarget(null)}
              onSave={resetUserPassword}
              saveLabel="Reset Password"
              saveDisabled={resetPassword.length < 6 || isPending}
            >
              {resetError && (
                <div className="mb-4 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-3 py-2 text-sm text-[#E53935]">
                  {resetError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">User</Label>
                  <Input value={`${resetTarget.name} (${resetTarget.email})`} disabled className="rounded-xl bg-[#EAEEF3]" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">New Password *</Label>
                  <Input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="rounded-xl"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-[#647184]">
                The password is updated immediately. Share it with the user through your approved secure channel.
              </p>
            </InlineForm>
          )}

          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                    <tr>{['User', 'Email', 'Role', 'Region', 'Status', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#647184]">{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user) => (
                      <tr key={user.id} className="border-b border-[#EAEEF3] hover:bg-[#F5F7FA]">
                        <td className="px-4 py-3 font-medium text-[#141920]">{user.name}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{user.email}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-[#EBF7EE] px-2 py-1 text-xs font-medium text-[#2C9942]">{user.role}</span></td>
                        <td className="px-4 py-3 text-[#4B5666]">{user.assignedRegion ?? 'All regions'}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{user.active ? 'Active' : 'Inactive'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {can('settings', 'edit') && <button onClick={() => openEdit(user)} className="rounded-lg p-1.5 text-[#647184] hover:bg-[#EBF7EE] hover:text-[#2C9942]"><Pencil size={14} /></button>}
                            {canResetPassword(user) && <button onClick={() => openResetPassword(user)} title="Reset password" className="rounded-lg p-1.5 text-[#647184] hover:bg-[#FFF5E6] hover:text-[#F59E0B]"><KeyRound size={14} /></button>}
                            {can('settings', 'delete') && user.email !== sessionUser?.email && <button onClick={() => remove(user)} className="rounded-lg p-1.5 text-[#647184] hover:bg-[#FDECEB] hover:text-[#E53935]"><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visibleUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-sm text-[#647184]">
                          No users found for this state.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm md:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Region</Label>
              <Select value={auditRegion} onValueChange={(value) => { if (value) setAuditRegion(value); }}>
                <SelectTrigger className="rounded-xl border-[#DDE3EA]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {REGIONAL_CAMPAIGN_AREAS.map((area) => (
                    <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Action</Label>
              <Select value={auditAction} onValueChange={(value) => { if (value) setAuditAction(value); }}>
                <SelectTrigger className="rounded-xl border-[#DDE3EA]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {auditActions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Date</Label>
              <Input type="date" value={auditDate} onChange={(event) => setAuditDate(event.target.value)} className="rounded-xl border-[#DDE3EA]" />
            </div>
          </div>
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                    <tr>{['When', 'Actor', 'Role', 'Action', 'Entity', 'Region', 'Details'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#647184]">{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {visibleAuditRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#EAEEF3]">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#4B5666]">{formatDateTime(row.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-[#141920]">{row.actorName}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{row.actorRole}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{row.action}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{row.entity}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{row.region ?? '-'}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{row.details}</td>
                      </tr>
                    ))}
                    {visibleAuditRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-[#647184]">No audit logs match the current filters.</td></tr>}
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

