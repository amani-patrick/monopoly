'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api, getErrorMsg } from '@/lib/api';
import { CheckIcon, DiceIcon } from '@/components/layout/Icons';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/auth/login');
    if (user?.isVerified) router.replace(user.onboardingCompleted ? '/' : '/onboarding');
  }, [loading, user, router]);

  async function requestCode() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.requestVerification();
      setDevCode(data.devCode || '');
      setMessage('Verification code sent.');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.confirmVerification(code);
      await refreshUser();
      router.push('/');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setBusy(false);
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
        <form onSubmit={confirmCode} className="card" style={{ width: '100%', maxWidth: 440, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
            <div style={{ color: 'var(--purple-light)' }}><CheckIcon size={32} /></div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Verify your email</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{user.email}</p>
            </div>
          </div>

          {error && <Alert color="red">{error}</Alert>}
          {message && <Alert color="green">{message}{devCode ? ` Dev code: ${devCode}` : ''}</Alert>}

          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
            Verification code
          </label>
          <input className="input" inputMode="numeric" pattern="[0-9]*" value={code} onChange={e => setCode(e.target.value)} placeholder="000000" minLength={6} maxLength={6} required />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.2rem' }}>
            <button type="submit" className="btn-primary" disabled={busy} style={{ flex: 1, justifyContent: 'center', opacity: busy ? 0.7 : 1 }}>
              Confirm
            </button>
            <button type="button" onClick={requestCode} className="btn-secondary" disabled={busy}>
              Send code
            </button>
          </div>

          <Link href="/" style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '1rem', textDecoration: 'none' }}>
            Back to lobby
          </Link>
        </form>
      </main>
    </div>
  );
}

function Alert({ color, children }: { color: 'red' | 'green'; children: React.ReactNode }) {
  const isGreen = color === 'green';
  return (
    <div style={{
      background: isGreen ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${isGreen ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: 'var(--radius-md)', padding: '0.75rem',
      color: isGreen ? 'var(--green-pos)' : 'var(--red-neg)',
      fontSize: '0.87rem', marginBottom: '1rem',
    }}>
      {children}
    </div>
  );
}
