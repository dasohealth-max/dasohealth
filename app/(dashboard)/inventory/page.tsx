'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDate } from '@/lib/utils';
import type { InventoryItem, InventoryCategory } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, AlertTriangle, Minus, PackageSearch, X } from 'lucide-react';
import { usePermissions } from '@/lib/auth';

const CATEGORIES: InventoryCategory[] = ['IOL','Medication','Equipment','Consumable','PPE'];
const CAT_COLORS: Record<InventoryCategory, string> = {
  IOL:'bg-indigo-100 text-indigo-700', Medication:'bg-green-100 text-green-700',
  Equipment:'bg-slate-100 text-slate-700', Consumable:'bg-amber-100 text-amber-700', PPE:'bg-teal-100 text-teal-700',
};
const BLANK: Omit<InventoryItem, 'id' | 'createdAt'> = {
  sku:'', name:'', category:'IOL', quantity:0, reorderLevel:10, unit:'pcs', expiryDate:'', supplier:'', locationId:'', notes:'',
};
const isLow  = (i: InventoryItem) => i.quantity <= i.reorderLevel;
const isExp  = (i: InventoryItem) => !!i.expiryDate && new Date(i.expiryDate) < new Date();
const isNear = (i: InventoryItem) => { if (!i.expiryDate) return false; const d = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / 86400000); return d >= 0 && d <= 60; };

export default function InventoryPage() {
  const { inventory, locations, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useStore();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);
  const [search, setSearch]     = useState('');

  const filtered = inventory.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()),
  );
  const lowItems  = inventory.filter(isLow);
  const expItems  = inventory.filter(isExp);
  const nearItems = inventory.filter(isNear);

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(i: InventoryItem) { setEditing(i); const { id, createdAt, ...r } = i; setForm(r); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }
  function save() {
    if (editing) updateInventoryItem({ ...editing, ...form });
    else addInventoryItem({ id: uid(), createdAt: new Date().toISOString(), ...form });
    cancel();
  }
  function adjust(item: InventoryItem, delta: number) {
    updateInventoryItem({ ...item, quantity: Math.max(0, item.quantity + delta) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">{inventory.length} items Â· {lowItems.length} low stock</p>
        </div>
        {can('inventory','create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />Add Item</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {/* Alerts */}
      {(expItems.length > 0 || lowItems.length > 0 || nearItems.length > 0) && (
        <div className="space-y-2">
          {expItems.length  > 0 && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 font-medium"><AlertTriangle size={14} /><strong>{expItems.length} expired:</strong> {expItems.map((i) => i.name).join(', ')}</div>}
          {lowItems.length  > 0 && <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700 font-medium"><AlertTriangle size={14} /><strong>{lowItems.length} low stock:</strong> {lowItems.map((i) => `${i.name} (${i.quantity})`).join(', ')}</div>}
          {nearItems.length > 0 && <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-sm text-orange-700 font-medium"><AlertTriangle size={14} /><strong>{nearItems.length} expiring soon:</strong> {nearItems.map((i) => i.name).join(', ')}</div>}
        </div>
      )}

      {showForm && (
        <InlineForm title={editing ? `Edit â€” ${editing.name}` : 'Add Inventory Item'}
          onClose={cancel} onSave={save} saveLabel={editing ? 'Update' : 'Add Item'} saveDisabled={!form.name}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs mb-1 block">SKU</Label><Input value={form.sku} onChange={(e) => set('sku', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Unit</Label><Input value={form.unit} onChange={(e) => set('unit', e.target.value)} className="rounded-xl" placeholder="pcs, boxesâ€¦" /></div>
            <div><Label className="text-xs mb-1 block">Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => set('quantity', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Reorder Level</Label><Input type="number" value={form.reorderLevel} onChange={(e) => set('reorderLevel', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Supplier</Label><Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Location</Label>
              <Select value={form.locationId} onValueChange={(v) => set('locationId', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Notes</Label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-14" />
            </div>
          </div>
        </InlineForm>
      )}

      <div className="relative max-w-sm">
        <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKUâ€¦" className="pl-9 rounded-xl border-slate-200" />
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['SKU','Name','Category','Qty','Reorder','Unit','Expiry','Supplier','Status',''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-slate-400">No items.</td></tr>}
                {filtered.map((item) => (
                  <tr key={item.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${isExp(item) ? 'bg-red-50/20' : isLow(item) ? 'bg-amber-50/20' : ''} ${editing?.id === item.id ? 'ring-1 ring-teal-200' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[item.category]}`}>{item.category}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => adjust(item, -1)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-100 text-slate-400"><Minus size={10} /></button>
                        <span className={`font-semibold min-w-[28px] text-center text-sm ${isLow(item) ? 'text-red-600' : 'text-slate-800'}`}>{item.quantity}</span>
                        <button onClick={() => adjust(item, 1)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-100 text-slate-400"><Plus size={10} /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.reorderLevel}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs font-medium ${isExp(item) ? 'text-red-600' : isNear(item) ? 'text-orange-600' : 'text-slate-400'}`}>{item.expiryDate ? formatDate(item.expiryDate) : 'â€”'}</span></td>
                    <td className="px-4 py-3 text-slate-500">{item.supplier}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isExp(item) ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Expired</span>
                        : isLow(item) ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Low Stock</span>
                        : isNear(item) ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Near Expiry</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">OK</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        {can('inventory','edit') && <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={13} /></button>}
                        {can('inventory','delete') && <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Item?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteInventoryItem(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
