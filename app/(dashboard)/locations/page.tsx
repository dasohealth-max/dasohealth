'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/utils';
import type { Location, FacilityType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, X, ArrowLeft, Save, Search, MapPin, Navigation } from 'lucide-react';
import { usePermissions } from '@/lib/auth';
import { SOMALIA_CITIES } from '@/lib/cities';

const FACILITY_TYPES: FacilityType[] = ['Hospital', 'Clinic', 'Mobile Unit', 'School', 'Community Centre'];

const FAC_COLORS: Record<FacilityType, string> = {
  Hospital:          'bg-red-100 text-red-700',
  Clinic:            'bg-blue-100 text-blue-700',
  'Mobile Unit':     'bg-amber-100 text-amber-700',
  School:            'bg-green-100 text-green-700',
  'Community Centre':'bg-purple-100 text-purple-700',
};

const BLANK: Omit<Location, 'id' | 'createdAt'> = {
  name: '', code: '', facilityType: 'Hospital', district: '', region: '',
  country: 'Somalia', lat: 2.0469, lng: 45.3182, phone: '',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMap = any;

const FAC_PIN_COLORS: Record<FacilityType, string> = {
  Hospital:          '#ef4444',
  Clinic:            '#3b82f6',
  'Mobile Unit':     '#f59e0b',
  School:            '#22c55e',
  'Community Centre':'#8b5cf6',
};

// ─── Map Picker ────────────────────────────────────────────────────────────────
function LocationMapPicker({ lat, lng, onSelect }: {
  lat: number; lng: number;
  onSelect: (d: { district: string; region: string; lat: number; lng: number }) => void;
}) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap>(null);
  const markerRef   = useRef<LeafletMap>(null);
  const [search, setSearch]           = useState('');
  const [suggestions, setSuggestions] = useState<typeof SOMALIA_CITIES>([]);
  const [showSug, setShowSug]         = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) { setSuggestions([]); setShowSug(false); return; }
    const matches = SOMALIA_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
    ).slice(0, 8);
    setSuggestions(matches);
    setShowSug(matches.length > 0);
  }, [search]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSug(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    let destroyed = false;
    import('leaflet').then((L) => {
      if (destroyed || !mapRef.current || mapInstance.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapRef.current as any)._leaflet_id = undefined;
      const map = L.map(mapRef.current, { center: [5.5, 46], zoom: 5, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      // Initial marker
      markerRef.current = L.marker([lat, lng]).addTo(map);
      map.setView([lat, lng], 8);

      map.on('click', (e: LeafletMap) => {
        const { lat: clat, lng: clng } = e.latlng;
        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
        markerRef.current = L.marker([clat, clng]).addTo(map);
        let nearest = SOMALIA_CITIES[0]; let minDist = Infinity;
        SOMALIA_CITIES.forEach((c) => {
          const d = Math.sqrt(Math.pow(c.lat - clat, 2) + Math.pow(c.lng - clng, 2));
          if (d < minDist) { minDist = d; nearest = c; }
        });
        onSelect({ district: nearest.district, region: nearest.region, lat: clat, lng: clng });
      });
      mapInstance.current = map;
    });
    return () => {
      destroyed = true;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; markerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstance.current || lat === undefined || lng === undefined) return;
    import('leaflet').then((L) => {
      if (!mapInstance.current) return;
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current);
      mapInstance.current.setView([lat, lng], 10);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  function pickCity(city: typeof SOMALIA_CITIES[0]) {
    setSearch(city.name); setShowSug(false);
    onSelect({ district: city.district, region: city.region, lat: city.lat, lng: city.lng });
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            placeholder="Search city… e.g. Mogadishu, Hargeisa"
            className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400 bg-transparent" />
          {search && <button onClick={() => { setSearch(''); setShowSug(false); }} className="text-slate-300 hover:text-slate-500"><X size={13} /></button>}
        </div>
        {showSug && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-[500] overflow-hidden">
            {suggestions.map((c) => (
              <button key={`${c.name}-${c.lat}`} type="button" onClick={() => pickCity(c)}
                className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-0">
                <MapPin size={13} className="text-teal-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800 leading-tight">{c.name}</p>
                  <p className="text-[11px] text-slate-400">{c.district} · {c.region}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-200">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 320 }} />
        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow text-[10px] text-slate-500 flex items-center gap-1.5">
          <Navigation size={10} className="text-teal-600" />
          Click on the map or search a city
        </div>
      </div>
    </div>
  );
}

// ─── Map Overview (read-only, all markers) ─────────────────────────────────────
function MapView({ locations }: { locations: Location[] }) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap>(null);
  const markersRef  = useRef<LeafletMap[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    if (mapInstance.current) return;
    let destroyed = false;
    import('leaflet').then((L) => {
      if (destroyed || !mapRef.current || mapInstance.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapRef.current as any)._leaflet_id = undefined;
      const map = L.map(mapRef.current, { center: [5, 46], zoom: 5, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      mapInstance.current = map;
    });
    return () => {
      destroyed = true;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; markersRef.current = []; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('leaflet').then((L) => {
      const map = mapInstance.current;
      if (!map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      locations.forEach((loc) => {
        const color = FAC_PIN_COLORS[loc.facilityType] ?? '#0d9488';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map)
          .bindPopup(`<div style="font-family:sans-serif;font-size:13px;line-height:1.5"><b>${loc.name}</b><br/><span style="color:#64748b">${loc.facilityType}</span><br/>${loc.district}, ${loc.region}<br/><span style="font-family:monospace;color:#0d9488">${loc.code}</span></div>`, { maxWidth: 220 });
        markersRef.current.push(marker);
      });
    });
  }, [locations]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} style={{ height: '100%', minHeight: 360 }} className="rounded-xl overflow-hidden" />
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-md z-[400] space-y-1">
        {Object.entries(FAC_PIN_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-sm" style={{ background: color }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full-page Location Form ───────────────────────────────────────────────────
function LocationFullForm({
  editing, form, setForm, onSave, onCancel, isValid,
}: {
  editing: Location | null;
  form: typeof BLANK;
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK>>;
  onSave: () => void;
  onCancel: () => void;
  isValid: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) {
    if (v === null || v === undefined) return;
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleMapSelect(d: { district: string; region: string; lat: number; lng: number }) {
    setForm((f) => ({ ...f, district: d.district, region: d.region, lat: d.lat, lng: d.lng }));
  }

  const field = 'w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors placeholder:text-slate-400';

  return (
    <div className="-m-4 sm:-m-6 bg-slate-50 flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {editing ? `Edit Location — ${editing.name}` : 'Add New Location'}
            </h1>
            <p className="text-xs text-slate-400">Fill in all required fields (*) then save</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl text-slate-600">Cancel</Button>
          <Button onClick={onSave} disabled={!isValid}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-2 disabled:opacity-50">
            <Save size={14} />
            {editing ? 'Update Location' : 'Add Location'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* 1. Identity */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. Facility Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block font-medium text-slate-600">Facility Name *</Label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                  className={`${field} ${!form.name.trim() ? 'border-red-300 focus:border-red-400' : ''}`}
                  placeholder="e.g. Mogadishu Central Eye Clinic" />
                {!form.name.trim() && <p className="text-[11px] text-red-500 mt-0.5">Required</p>}
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Facility Code *</Label>
                <input value={form.code} onChange={(e) => set('code', e.target.value)}
                  className={`${field} ${!form.code.trim() ? 'border-red-300' : ''}`}
                  placeholder="e.g. MOG-01" />
                {!form.code.trim() && <p className="text-[11px] text-red-500 mt-0.5">Required</p>}
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Facility Type</Label>
                <select value={form.facilityType} onChange={(e) => set('facilityType', e.target.value as FacilityType)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer transition-colors">
                  {FACILITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* 2. Contact */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Phone Number</Label>
                <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
                  className={field} placeholder="+252 61 …" />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Country</Label>
                <input value={form.country} onChange={(e) => set('country', e.target.value)}
                  className={field} />
              </div>
            </div>
          </section>

          {/* 3. Location — auto-filled from map */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">3. Location (from map →)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">District</Label>
                <input value={form.district} onChange={(e) => set('district', e.target.value)}
                  className={field} placeholder="Auto-filled from map" />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Region</Label>
                <input value={form.region} onChange={(e) => set('region', e.target.value)}
                  className={field} placeholder="Auto-filled from map" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                <Navigation size={13} className="text-teal-600 shrink-0" />
                <p className="text-xs text-teal-700 font-medium">
                  GPS: {form.lat.toFixed(4)}°, {form.lng.toFixed(4)}°
                </p>
              </div>
            </div>
          </section>

        </div>

        {/* Right: Map */}
        <div className="w-[400px] xl:w-[460px] shrink-0 border-l border-slate-100 bg-white p-4 flex flex-col gap-3 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">GPS Location</h3>
            <p className="text-[11px] text-slate-400">Search a city or click anywhere on the map</p>
          </div>
          <div className="flex-1 min-h-0">
            <LocationMapPicker lat={form.lat} lng={form.lng} onSelect={handleMapSelect} />
          </div>
          {(form.district || form.region) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 shrink-0">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Selected Location</p>
              {form.district && <p className="text-sm font-medium text-slate-700"><span className="text-slate-400 text-xs">District:</span> {form.district}</p>}
              {form.region && <p className="text-sm font-medium text-slate-700"><span className="text-slate-400 text-xs">Region:</span> {form.region}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LocationsPage() {
  const { locations, addLocation, updateLocation, deleteLocation } = useStore();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Location | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);

  const isValid = form.name.trim().length > 0 && form.code.trim().length > 0;

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(l: Location) {
    setEditing(l);
    const { id, createdAt, ...r } = l;
    setForm(r);
    setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditing(null); }
  function save() {
    if (editing) updateLocation({ ...editing, ...form });
    else addLocation({ id: uid(), createdAt: new Date().toISOString(), ...form });
    cancel();
  }

  // Full-page form mode
  if (showForm) {
    return (
      <LocationFullForm
        editing={editing}
        form={form}
        setForm={setForm}
        onSave={save}
        onCancel={cancel}
        isValid={isValid}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Locations</h1>
          <p className="text-sm text-slate-500">{locations.length} service delivery sites</p>
        </div>
        {can('locations','create') && (
          <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl">
            <Plus size={15} />Add Location
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{['Code', 'Name', 'Type', 'District', 'GPS', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {locations.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">No locations.</td></tr>}
                  {locations.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-teal-700 font-semibold">{l.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800"><p>{l.name}</p><p className="text-xs text-slate-400">{l.region}</p></td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FAC_COLORS[l.facilityType]}`}>{l.facilityType}</span></td>
                      <td className="px-4 py-3 text-slate-500">{l.district}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.lat.toFixed(3)}, {l.lng.toFixed(3)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {can('locations','edit') && <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={14} /></button>}
                          {can('locations','delete') && <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-3" style={{ height: 420 }}>
            <MapView locations={locations} />
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Location?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteLocation(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
