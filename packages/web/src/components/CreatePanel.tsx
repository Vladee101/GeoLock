import { useState, useEffect } from 'react';
import L from 'leaflet';
import { apiFetch } from '../lib/api.ts';
import { saveOwned } from '../lib/storage.ts';

const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 20000;

const EXPIRY_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '6 hours', hours: 6 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
];

function sliderToRadius(s: number): number {
  return Math.round(MIN_RADIUS_M * Math.pow(MAX_RADIUS_M / MIN_RADIUS_M, s / 100));
}
function radiusToSlider(r: number): number {
  return (Math.log(r / MIN_RADIUS_M) / Math.log(MAX_RADIUS_M / MIN_RADIUS_M)) * 100;
}

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

interface Props {
  map: L.Map | null;
  isOpen: boolean;
  onClose: () => void;
  pin: { lat: number; lng: number } | null;
  setPin: (pin: { lat: number; lng: number } | null) => void;
}

const s = {
  panel: (isOpen: boolean): React.CSSProperties => ({
    position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 2001,
    width: 'min(380px, 100vw)',
    background: '#ffffff',
    boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }),
  header: {
    padding: '20px 20px 16px',
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
    lineHeight: 1,
  } as React.CSSProperties,
  backBtn: {
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 14, color: '#555', padding: 0,
  } as React.CSSProperties,
  body: {
    flex: 1, overflowY: 'auto', padding: '20px',
  } as React.CSSProperties,
  pinHint: (hasPin: boolean): React.CSSProperties => ({
    fontSize: 13,
    color: hasPin ? '#1D9E75' : '#888',
    background: hasPin ? '#f0faf6' : '#fafafa',
    border: `1px solid ${hasPin ? '#b8e8d8' : '#eee'}`,
    borderRadius: 8, padding: '10px 12px',
    marginBottom: 20,
    display: 'flex', alignItems: 'center', gap: 8,
  }),
  fieldGroup: {
    marginBottom: 16,
  } as React.CSSProperties,
  label: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#555', marginBottom: 6, textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  input: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #e8e8e8', borderRadius: 8,
    fontSize: 14, color: '#1a1a1a', outline: 'none',
    boxSizing: 'border-box', background: '#fafafa',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  textarea: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #e8e8e8', borderRadius: 8,
    fontSize: 14, color: '#1a1a1a', outline: 'none',
    boxSizing: 'border-box', background: '#fafafa',
    resize: 'vertical', minHeight: 100,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  select: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #e8e8e8', borderRadius: 8,
    fontSize: 14, color: '#1a1a1a', outline: 'none',
    boxSizing: 'border-box', background: '#fafafa',
    appearance: 'none', cursor: 'pointer',
  } as React.CSSProperties,
  radiusRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  } as React.CSSProperties,
  radiusValue: {
    fontSize: 13, fontWeight: 600, color: '#378ADD',
    background: '#eef5fd', padding: '2px 8px', borderRadius: 20,
  } as React.CSSProperties,
  slider: {
    width: '100%', accentColor: '#378ADD',
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
  submitBtn: (disabled: boolean): React.CSSProperties => ({
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

export default function CreatePanel({ map, isOpen, onClose, pin, setPin }: Props) {
  const isMobile = window.innerWidth < 768;
  const [step, setStep] = useState<'pin' | 'form'>('pin');

  const [radiusM, setRadius]  = useState(100);
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [key, setKey]         = useState('');
  const [expiryH, setExpiry]  = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!pin || !map) return;
    const circle = L.circle([pin.lat, pin.lng], {
      radius: radiusM, color: '#378ADD',
      fillOpacity: 0.12, weight: 1.5,
    }).addTo(map);
    const marker = L.marker([pin.lat, pin.lng]).addTo(map);
    return () => { circle.remove(); marker.remove(); };
  }, [pin, radiusM, map]);

  // Disabled during mobile step 2 — the form sheet covers the map there,
  // so a tap is hitting the sheet, not the map underneath it.
  useEffect(() => {
    if (!isOpen || !map || (isMobile && step === 'form')) return;
    const handler = (e: L.LeafletMouseEvent) =>
      setPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [isOpen, map, step, isMobile]);

  useEffect(() => {
    if (isOpen) return;
    setPin(null); setRadius(100); setTitle(''); setContent('');
    setKey(''); setExpiry(24); setError(null);
    setStep('pin');
  }, [isOpen]);

  async function handleSubmit() {
    if (!pin || !content.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await apiFetch<{ slug: string; owner_token: string }>('/drops', {
        method: 'POST',
        body: JSON.stringify({
          title: title || undefined,
          content, lat: pin.lat, lng: pin.lng,
          radius_m: radiusM,
          key: key || undefined,
          hard_expires_at: new Date(Date.now() + expiryH * 3_600_000).toISOString(),
        }),
      });
      saveOwned({ slug: result.slug, owner_token: result.owner_token });
      onClose();
    } catch (err: any) {
      setError(err?.error ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || !pin || !content.trim();

  // Shared between the desktop panel and the mobile step-2 sheet — same
  // fields, same styles, just mounted inside a different container.
  const formBody = (
    <>
      {/* Radius */}
      <div style={s.fieldGroup}>
        <div style={s.radiusRow}>
          <span style={s.label}>Radius</span>
          <span style={s.radiusValue}>{formatRadius(radiusM)}</span>
        </div>
        <input
          type="range" min={0} max={100} step={1}
          value={radiusToSlider(radiusM)}
          onChange={e => setRadius(sliderToRadius(Number(e.target.value)))}
          style={s.slider}
        />
      </div>

      {/* Title */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Title <span style={{ color: '#bbb', fontWeight: 400 }}>optional</span></label>
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Festival welcome"
          style={s.input}
        />
      </div>

      {/* Content */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Content</label>
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="What's the secret?"
          style={s.textarea}
        />
      </div>

      {/* Key */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Key <span style={{ color: '#bbb', fontWeight: 400 }}>optional</span></label>
        <input
          value={key} onChange={e => setKey(e.target.value)}
          placeholder="Share this with people at the location"
          style={s.input}
        />
      </div>

      {/* Expiry */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Expires after</label>
        <select value={expiryH} onChange={e => setExpiry(Number(e.target.value))} style={s.select}>
          {EXPIRY_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.label}</option>)}
        </select>
      </div>

      {error && <div style={s.error}>{error}</div>}
    </>
  );

  // Desktop: side panel, unchanged.
  if (!isMobile) {
    return (
      <div style={s.panel(isOpen)}>
        <div style={s.header}>
          <h2 style={s.title}>New drop</h2>
          <button onClick={onClose} aria-label="Close" style={s.closeBtn}>×</button>
        </div>

        <div style={s.body}>
          <div style={s.pinHint(!!pin)}>
            <span>{pin ? '📍' : '🗺️'}</span>
            <span>
              {pin
                ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
                : 'Tap the map to place your drop'}
            </span>
          </div>
          {formBody}
        </div>

        <div style={s.footer}>
          <button onClick={handleSubmit} disabled={isDisabled} style={s.submitBtn(isDisabled)}>
            {loading ? 'Creating…' : 'Drop it'}
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  // Mobile, step 1: floating bar over a fully visible map.
  if (step === 'pin') {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
        background: 'white', padding: '16px 20px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        borderRadius: '16px 16px 0 0',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <p style={{ margin: 0, fontSize: 14, color: '#555', textAlign: 'center' }}>
          {pin ? `📍 ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Tap the map to place your drop'}
        </p>
        <button
          onClick={() => setStep('form')}
          disabled={!pin}
          style={{
            padding: '13px', borderRadius: 10, border: 'none',
            background: pin ? '#1a1a1a' : '#e8e8e8',
            color: pin ? '#fff' : '#aaa',
            fontSize: 15, fontWeight: 600, cursor: pin ? 'pointer' : 'not-allowed',
          }}
        >
          Confirm pin →
        </button>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#888',
          fontSize: 13, cursor: 'pointer', padding: 0,
        }}>
          Cancel
        </button>
      </div>
    );
  }

  // Mobile, step 2: form sheet covering ~90% of the screen.
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
      height: '90vh', background: 'white',
      borderRadius: '16px 16px 0 0',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      transform: 'translateY(0)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <div style={s.header}>
        <button onClick={() => setStep('pin')} style={s.backBtn}>← Back</button>
        <h2 style={{ ...s.title, flex: 1, textAlign: 'center' }}>New drop</h2>
        <button onClick={onClose} aria-label="Close" style={s.closeBtn}>×</button>
      </div>

      <div style={s.body}>
        {formBody}
      </div>

      <div style={s.footer}>
        <button onClick={handleSubmit} disabled={isDisabled} style={s.submitBtn(isDisabled)}>
          {loading ? 'Creating…' : 'Drop it'}
        </button>
      </div>
    </div>
  );
}
