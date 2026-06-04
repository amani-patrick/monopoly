'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMsg } from '@/lib/api';
import { CheckIcon, DiceIcon } from '@/components/layout/Icons';

const AVATARS = ['green','yellow','orange','red','blue','cyan','teal','pink','purple','brown'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, completeOnboarding } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('green');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/auth/login');
    if (user?.onboardingCompleted) router.replace(user.isVerified ? '/' : '/auth/verify');
    if (user) {
      setDisplayName(user.displayName);
      setAvatar(user.avatar || 'green');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await completeOnboarding({ displayName: displayName.trim(), avatar });
      router.push(updated.isVerified ? '/lobby/create' : '/auth/verify');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple-light)' }}>
        <DiceIcon size={44} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '84px 1rem 2rem' }}>
        <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: 460, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
            <div style={{ color: 'var(--purple-light)' }}><DiceIcon size={34} /></div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Set up your player</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>This is what friends see in private lobbies.</p>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem', color: 'var(--red-neg)', fontSize: '0.87rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
            Display name
          </label>
          <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={30} required />

          <div style={{ marginTop: '1.1rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>Player color</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 40px)', gap: '10px' }}>
              {AVATARS.map(color => (
                <button key={color} type="button" onClick={() => setAvatar(color)} aria-label={color} style={{
                  width: 40, height: 40, borderRadius: '50%', padding: 0, cursor: 'pointer',
                  border: avatar === color ? '3px solid white' : '3px solid transparent',
                  boxShadow: avatar === color ? '0 0 0 2px var(--purple-primary)' : 'none',
                  background: 'transparent',
                }}>
                  <div className={`avatar avatar-${color}`} style={{ width: '100%', height: '100%', borderRadius: '50%' }}>
                    {avatar === color ? <CheckIcon size={14} /> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Continue'}
            </button>
            <Link href="/" className="btn-secondary" style={{ justifyContent: 'center', textDecoration: 'none' }}>Later</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
