import { useState, useEffect } from 'react';
import L from 'leaflet';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  map: L.Map | null;
  onSelectLocation?: (pin: { lat: number; lng: number }) => void;
}

export default function LocationSearch({ map, onSelectLocation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);

  // The setTimeout/clearTimeout pair below is the debounce; the `cancelled`
  // flag (via the effect's cleanup) stops a stale, slow response from a
  // superseded keystroke from overwriting a newer, already-rendered result.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
        );
        const data: NominatimResult[] = await res.json();
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) { console.error(err); setResults([]); }
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  function handleSelect(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    map?.setView([lat, lng], 15);
    onSelectLocation?.({ lat, lng });
    setQuery(result.display_name);
    setOpen(false);
    setResults([]);
  }

  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1000, width: 'min(360px, 90vw)',
    }}>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Search for a place…"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 14px',paddingRight: '36px',
            borderRadius: 8, border: '1px solid #ccc', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#999',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul style={{
          listStyle: 'none', margin: '4px 0 0', padding: 0,
          background: 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {results.map(r => (
            <li
              key={r.place_id}
              onClick={() => handleSelect(r)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
