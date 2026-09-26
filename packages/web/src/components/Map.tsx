import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { lockedIcon, unlockedIcon } from './DropPin.tsx';
import type { NearbyDrop } from '../hooks/useNearbyDrops.ts';

interface Props {
  onMapReady: (map: L.Map) => void;
  drops: NearbyDrop[];
  onSelectDrop: (drop: NearbyDrop) => void;
}

export default function Map({ onMapReady, drops, onSelectDrop }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isMobile = window.innerWidth < 768;

    const map = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: !isMobile,
    }).setView([40.6950, -74.0060], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

    mapRef.current = map;
    onMapReady(map);

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: L.Marker[] = [];
    drops.forEach(drop => {
      const m = L.marker([drop.lat, drop.lng], {
        icon: drop.you_are_inside ? unlockedIcon : lockedIcon,
      }).addTo(map);
      if (drop.title) {
        m.bindTooltip(drop.title, {
          permanent: true,
          direction: 'top',
          offset: [0, -36],
          className: 'drop-label',
        });
      }
      m.on('click', () => onSelectDrop(drop));
      markers.push(m);
    });

    return () => markers.forEach(m => m.remove());
  }, [drops]);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}