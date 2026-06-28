import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface Attempt {
  lat: number;
  lng: number;
  granted: boolean;
  reason: string | null;
  attempted_at: string;
}

interface Props {
  attempts: Attempt[];
}

export default function AttemptMap({ attempts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = attempts.map(a =>
      L.circleMarker([a.lat, a.lng], {
        radius: 6,
        color: a.granted ? '#1D9E75' : '#E24B4A',
        fillOpacity: 0.8, weight: 1,
      }).bindPopup(a.reason ?? 'granted').addTo(map)
    );

    if (attempts.length) {
      map.fitBounds(
        L.latLngBounds(attempts.map(a => [a.lat, a.lng] as [number, number])),
        { padding: [20, 20] }
      );
    }

    return () => markers.forEach(m => m.remove());
  }, [attempts]);

  return <div ref={containerRef} style={{ width: '100%', height: 300 }} />;
}
