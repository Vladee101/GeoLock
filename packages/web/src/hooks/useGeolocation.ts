import { useState, useEffect } from 'react';

export interface Position { lat: number; lng: number; accuracy: number }

// ipwho.is — free, keyless, HTTPS + CORS. Gives an instant city-level fix
// from the visitor's IP; used only to center the map. GPS (`position`)
// stays the only authoritative source for drops/unlocks.
interface IpWhoResponse { latitude?: unknown; longitude?: unknown }

export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [approximate, setApproximate] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }

    const id = navigator.geolocation.watchPosition(
      pos => setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Instant approximate fix — browsers silently deny GPS on insecure origins
  // and remember earlier denials, so this is what most visitors actually get.
  useEffect(() => {
    let cancelled = false;
    fetch('https://ipwho.is/')
      .then(r => r.json())
      .then((d: IpWhoResponse) => {
        if (cancelled) return;
        if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          setApproximate({ lat: d.latitude, lng: d.longitude, accuracy: 50_000 });
        }
      })
      .catch(() => { /* silent — the hardcoded fallback view remains */ });
    return () => { cancelled = true; };
  }, []);

  return { position, approximate, error };
}
