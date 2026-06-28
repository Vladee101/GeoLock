import { useState, useEffect } from 'react';
import type { NearbyDrop } from '../hooks/useNearbyDrops.ts';
import type { Position } from '../hooks/useGeolocation.ts';
import { apiFetch } from '../lib/api.ts';

const ERROR_MSG: Record<string, string> = {
  outside_zone: 'You need to be closer. Move toward the pin and try again.',
  wrong_key:    'Incorrect key. Check with whoever placed this drop.',
  expired:      'This drop has expired.',
  not_found:    'Drop not found.',
};

interface Unlocked { title?: string; content: string }

interface Props {
  drop: NearbyDrop | null;
  position: Position | null;
  onClose: () => void;
}

export default function DropSheet({ drop, position, onClose }: Props) {
  const open = drop !== null;

  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Unlocked | null>(null);

  // Reset per-drop UI state whenever the selection changes — including
  // tapping straight from one pin to another without closing first, which
  // would otherwise leak stale key/error/unlocked-content state across drops.
  useEffect(() => {
    setKey(''); setShowKey(false); setLoading(false); setError(null); setUnlocked(null);
  }, [drop?.id]);

  async function handleUnlock() {
    if (!drop || !position || !drop.slug) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        lat: String(position.lat),
        lng: String(position.lng),
        accuracy: String(position.accuracy),
        ...(key ? { key } : {}),
      });
      const result = await apiFetch<Unlocked>(`/drops/${drop.slug}?${params}`);
      setUnlocked(result);
    } catch (err: any) {
      setError(ERROR_MSG[err?.error] ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.3)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
        background: 'white', borderRadius: '16px 16px 0 0',
        padding: '20px', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 16, border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}
        >
          ×
        </button>
        {drop && (
          <>
            <h2 style={{ margin: '0 24px 8px 0' }}>{drop.title ?? 'Unnamed drop'}</h2>

            {unlocked ? (
              <p style={{ whiteSpace: 'pre-wrap' }}>{unlocked.content}</p>
            ) : (
              <>
                <p>{drop.you_are_inside ? 'You are inside this zone' : 'Get closer to unlock'}</p>

                {drop.has_key && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={key}
                      onChange={e => setKey(e.target.value)}
                      placeholder="Enter key"
                      onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                    />
                    <button onClick={() => setShowKey(v => !v)}>
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}

                {error && <p style={{ color: '#E24B4A' }}>{error}</p>}

                <button
                  onClick={handleUnlock}
                  disabled={loading || (drop.has_key && !key) || !drop.slug}
                >
                  {loading ? 'Checking…' : 'Unlock'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
