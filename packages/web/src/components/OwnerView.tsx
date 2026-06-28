import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.ts';
import { getOwnerToken } from '../lib/storage.ts';
import AttemptMap from './AttemptMap.tsx';

interface Attempt {
  lat: number;
  lng: number;
  granted: boolean;
  reason: string | null;
  attempted_at: string;
}

interface AttemptsResponse {
  total: number;
  granted: number;
  denied: number;
  attempts: Attempt[];
}

interface Props {
  slug: string;
}

export default function OwnerView({ slug }: Props) {
  const [ownerToken] = useState(() => getOwnerToken(slug));
  const [data, setData] = useState<AttemptsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!ownerToken) return;
    apiFetch<AttemptsResponse>(`/drops/${slug}/attempts`, {
      headers: { 'x-owner-token': ownerToken },
    })
      .then(setData)
      .catch(() => setError('Could not load this drop. It may have expired or been deleted.'));
  }, [slug, ownerToken]);

  async function handleDelete() {
    if (!ownerToken) return;
    setDeleting(true);
    try {
      await apiFetch(`/drops/${slug}`, {
        method: 'DELETE',
        headers: { 'x-owner-token': ownerToken },
      });
      window.location.href = '/';
    } catch {
      setError('Could not delete this drop.');
      setDeleting(false);
    }
  }

  if (!ownerToken) {
    return <p style={{ padding: 20 }}>You don't own this drop, or localStorage was cleared.</p>;
  }

  if (error) {
    return <p style={{ padding: 20 }}>{error}</p>;
  }

  if (!data) {
    return <p style={{ padding: 20 }}>Loading…</p>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h1>Drop: {slug}</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div>Total: {data.total}</div>
        <div>Granted: {data.granted}</div>
        <div>Denied: {data.denied}</div>
      </div>

      <AttemptMap attempts={data.attempts} />

      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>Time</th><th>Reason</th><th>Result</th></tr>
        </thead>
        <tbody>
          {data.attempts.map((a, i) => (
            <tr key={i}>
              <td>{new Date(a.attempted_at).toLocaleString()}</td>
              <td>{a.reason ?? '—'}</td>
              <td>{a.granted ? 'Granted' : 'Denied'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{ marginTop: 16, background: '#E24B4A', color: 'white' }}
      >
        {deleting ? 'Deleting…' : 'Delete drop'}
      </button>
    </div>
  );
}
