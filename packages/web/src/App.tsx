import { useState } from 'react';
import L from 'leaflet';
import Map from './components/Map.tsx';
import DropSheet from './components/DropSheet.tsx';
import CreatePanel from './components/CreatePanel.tsx';
import OwnerView from './components/OwnerView.tsx';
import LocationSearch from './components/LocationSearch.tsx';
import { useGeolocation } from './hooks/useGeolocation.ts';
import { useNearbyDrops } from './hooks/useNearbyDrops.ts';

export default function App() {
  const ownerMatch = window.location.pathname.match(/^\/owner\/(.+)$/);
  if (ownerMatch) return <OwnerView slug={ownerMatch[1]} />;

  const [map, setMap] = useState<L.Map | null>(null);
  const { position } = useGeolocation();
  const drops = useNearbyDrops(position);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedDrop = selectedId
    ? drops.find(d => d.id === selectedId) ?? null
    : null;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div style={{ position: 'relative' }}>
      <Map
        onMapReady={setMap}
        drops={drops}
        onSelectDrop={drop => setSelectedId(drop.id)}
      />
      <LocationSearch map={map} onSelectLocation={setPin} />
      <DropSheet drop={selectedDrop} position={position} onClose={() => setSelectedId(null)} />
      <CreatePanel
        map={map}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        pin={pin}
        setPin={setPin}
      />

      <button
        onClick={() => setIsCreateOpen(true)}
        aria-label="New drop"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1500,
          width: 56, height: 56, borderRadius: '50%',
          background: '#0F9B8E', color: 'white', fontSize: 28,
          border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer',
        }}
      >
        +
      </button>

      <div style={{ position: 'fixed', bottom: 12, left: 16, zIndex: 1000, fontSize: 12, color: '#555', pointerEvents: 'none' }}>
        Built by{' '}
        <a href="https://softwarean.com" target="_blank" rel="noopener noreferrer" style={{ color: '#555', pointerEvents: 'all' }}>Softwarean™</a>
      </div>
    </div>
  );
}