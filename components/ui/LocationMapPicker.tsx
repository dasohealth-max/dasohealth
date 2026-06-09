'use client';
import { useState, useEffect, useRef } from 'react';
import { SOMALIA_CITIES } from '@/lib/cities';
import { Search, MapPin, X, Navigation } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletAny = any;

export interface LocationSelectResult {
  lat: number;
  lng: number;
  district: string;
  region: string;
}

interface Props {
  lat?: number;
  lng?: number;
  onLocationSelect: (loc: LocationSelectResult) => void;
}

export default function LocationMapPicker({ lat, lng, onLocationSelect }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletAny>(null);
  const markerRef   = useRef<LeafletAny>(null);
  const [search, setSearch]           = useState('');
  const [suggestions, setSuggestions] = useState<typeof SOMALIA_CITIES>([]);
  const [showSug, setShowSug]         = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter suggestions
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) { setSuggestions([]); setShowSug(false); return; }
    const matches = SOMALIA_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
    ).slice(0, 8);
    setSuggestions(matches);
    setShowSug(matches.length > 0);
  }, [search]);

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSug(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Init map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    let destroyed = false;

    import('leaflet').then((L) => {
      if (destroyed || !mapRef.current || mapInstance.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapRef.current as any)._leaflet_id = undefined;

      const map = L.map(mapRef.current, {
        center: [5.5, 46], zoom: 5, zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      if (lat !== undefined && lng !== undefined) {
        markerRef.current = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 10);
      }

      map.on('click', (e: LeafletAny) => {
        const { lat: clat, lng: clng } = e.latlng;
        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
        markerRef.current = L.marker([clat, clng]).addTo(map);

        let nearest = SOMALIA_CITIES[0];
        let minDist = Infinity;
        SOMALIA_CITIES.forEach((c) => {
          const d = Math.sqrt(Math.pow(c.lat - clat, 2) + Math.pow(c.lng - clng, 2));
          if (d < minDist) { minDist = d; nearest = c; }
        });
        onLocationSelect({ district: nearest.district, region: nearest.region, lat: clat, lng: clng });
      });

      mapInstance.current = map;
    });

    return () => {
      destroyed = true;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; markerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when lat/lng change externally
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
    setSearch(city.name);
    setShowSug(false);
    onLocationSelect({ district: city.district, region: city.region, lat: city.lat, lng: city.lng });
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            placeholder="Raadi magaalo… e.g. Mogadishu, Hargeisa"
            className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400 bg-transparent"
          />
          {search && (
            <button onClick={() => { setSearch(''); setShowSug(false); }} className="text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>
        {showSug && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-[500] overflow-hidden">
            {suggestions.map((c) => (
              <button
                key={`${c.name}-${c.lat}`}
                type="button"
                onClick={() => pickCity(c)}
                className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-0"
              >
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

      {/* Map */}
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
