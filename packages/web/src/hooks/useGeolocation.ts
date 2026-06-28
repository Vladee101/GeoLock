import { useState, useEffect } from 'react';

export interface Position { lat: number; lng: number; accuracy: number }

export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
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

  return { position, error };
}
