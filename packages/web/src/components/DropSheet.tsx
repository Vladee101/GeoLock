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

const s = {
  backdrop: (open: boolean): React.CSSProperties => ({
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.3)',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
    transition: 'opacity 0.3s ease',
  }),
  sheet: (open: boolean): React.CSSProperties => ({
  position: 'fixed', bottom: 0, zIndex: 2001,
  left: '50%', transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
  width: 'min(480px, 100vw)',
  background: '#ffffff',
  borderRadius: '16px 16px 0 0',
  boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
  display: 'flex', flexDirection: 'column',
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  maxHeight: '80vh',
  }),
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: '#e0e0e0', margin: '12px auto 0',
    flexShrink: 0,
  } as React.CSSProperties,
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  } as React.CSSProperties,
  title: {
    margin: 0, fontSize: 18, fontWeight: 600,
    color: '#1a1a1a', letterSpacing: '-0.3px',
  } as React.CSSProperties,
  closeBtn: {
    width: 32, height: 32, borderRadius: '50%',
    border: 'none', background: '#f5f5f5',
    cursor: 'pointer', fontSize: 18, color: '#666',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  body: {
    flex: 1, overflowY: 'auto', padding: '20px',
  } as React.CSSProperties,
  statusBadge: (inside: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, fontWeight: 500,
    color: inside ? '#1D9E75' : '#888',
    background: inside ? '#f0faf6' : '#fafafa',
    border: `1px solid ${inside ? '#b8e8d8' : '#eee'}`,
    borderRadius: 20, padding: '5px 12px',
    marginBottom: 20,
  }),
  content: {
    fontSize: 15, lineHeight: 1.7,
    color: '#1a1a1a', whiteSpace: 'pre-wrap',
    background: '#fafafa', borderRadius: 10,
    padding: '14px 16px',
  } as React.CSSProperties,
  label: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#555', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  } as React.CSSProperties,
  keyWrap: {
    position: 'relative', marginBottom: 16,
  } as React.CSSProperties,
  keyInput: {
    width: '100%', padding: '10px 48px 10px 12px',
    border: '1.5px solid #e8e8e8', borderRadius: 8,
    fontSize: 14, color: '#1a1a1a', outline: 'none',
    boxSizing: 'border-box', background: '#fafafa',
  } as React.CSSProperties,
  showBtn: {
    position: 'absolute', right: 10, top: '50%',
    transform: 'translateY(-50%)',
    background: 'none', border: 'none',
    fontSize: 12, color: '#888', cursor: 'pointer',
    fontWeight: 500,
  } as React.CSSProperties,
  error: {
    fontSize: 13, color: '#E24B4A',
    background: '#fff5f5', border: '1px solid #ffd0d0',
    borderRadius: 8, padding: '10px 12px', marginBottom: 16,
  } as React.CSSProperties,
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #f0f0f0',
    flexShrink: 0,
  } as React.CSSProperties,
  unlockBtn: (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '13px',
    background: disabled ? '#e8e8e8' : '#1a1a1a',
    color: disabled ? '#aaa' : '#fff',
    border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
    letterSpacing: '-0.2px',
  }),
};

export default function DropSheet({ drop, position, onClose }: Props) {
  const open = drop !== null;

  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Unlocked | null>(null);

  useEffect(() => {
    setKey(''); setShowKey(false); setLoading(false);
    setError(null); setUnlocked(null);
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

  const isDisabled = loading || (drop?.has_key && !key) || !drop?.slug;

  return (
    <>
      <div onClick={onClose} style={s.backdrop(open)} />

      <div style={s.sheet(open)}>
        {/* Drag handle */}
        <div style={s.handle} />

        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>{drop?.title ?? 'Unnamed drop'}</h2>
          <button onClick={onClose} aria-label="Close" style={s.closeBtn}>×</button>
        </div>

        {drop && (
          <>
            <div style={s.body}>
              {unlocked ? (
                /* Unlocked content */
                <div style={s.content}>{unlocked.content}</div>
              ) : (
                <>
                  {/* Zone status */}
                  <div style={s.statusBadge(drop.you_are_inside)}>
                    <span>{drop.you_are_inside ? '📍' : '🔒'}</span>
                    <span>{drop.you_are_inside ? 'You are inside this zone' : 'Get closer to unlock'}</span>
                  </div>

                  {/* Key input */}
                  {drop.has_key && (
                    <>
                      <label style={s.label}>Key</label>
                      <div style={s.keyWrap}>
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={key}
                          onChange={e => setKey(e.target.value)}
                          placeholder="Enter key"
                          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                          style={s.keyInput}
                        />
                        <button onClick={() => setShowKey(v => !v)} style={s.showBtn}>
                          {showKey ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Error */}
                  {error && <div style={s.error}>{error}</div>}
                </>
              )}
            </div>

            {/* Footer — only show when not yet unlocked */}
            {!unlocked && (
              <div style={s.footer}>
                <button
                  onClick={handleUnlock}
                  disabled={!!isDisabled}
                  style={s.unlockBtn(!!isDisabled)}
                >
                  {loading ? 'Checking…' : 'Unlock'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}