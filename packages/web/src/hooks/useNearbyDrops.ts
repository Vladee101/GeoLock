import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api.ts';
import type { Position } from './useGeolocation.ts';

export interface NearbyDrop {
  id: string;
  lat: number; lng: number;
  title: string | null;
  has_key: boolean;
  you_are_inside: boolean;
  hard_expires_at: string;
  slug?: string | null; // null (not absent) when you_are_inside is false — see T-05
}

export function useNearbyDrops(position: Position | null, radiusM = 20000) {
  const [drops, setDrops] = useState<NearbyDrop[]>([]);

  // Keep the latest position in a ref rather than the effect's dependency
  // array. watchPosition (T-10) fires on every GPS update, including tiny
  // jitter while stationary — depending on position.lat/lng directly would
  // re-fetch on every jitter instead of every 30s as SPEC.md intends.
  const positionRef = useRef(position);
  positionRef.current = position;

  const hasPosition = position != null;

  useEffect(() => {
    if (!hasPosition) return;

    const fetchDrops = () => {
      const p = positionRef.current;
      if (!p) return;
      apiFetch<{ drops: NearbyDrop[] }>(
        `/drops/nearby?lat=${p.lat}&lng=${p.lng}&radius_m=${radiusM}&accuracy=${p.accuracy}`
      ).then(r => setDrops(r.drops)).catch(console.error);
    };

    fetchDrops();
    const id = setInterval(fetchDrops, 30_000);
    return () => clearInterval(id);
  }, [hasPosition, radiusM]);

  return drops;
}
