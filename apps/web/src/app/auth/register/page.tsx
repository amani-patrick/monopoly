'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMsg } from '@/lib/api';
import { DiceIcon } from '@/components/layout/Icons';

const AVATARS = ['green','yellow','orange','red','blue','cyan','teal','pink','purple','brown'];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', displayName: '', avatar: 'green' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(form.password)) { setError('Password must contain an uppercase letter'); return; }
    if (!/[0-9]/.test(form.password)) { setError('Password must contain a number'); return; }
    setLoading(true); setError('');
    try {
      await register(form.email, form.password, form.displayName);
      router.push('/auth/verify');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ marginBottom: '0.5rem', color: 'var(--purple-light)', display: 'flex', justifyContent: 'center' }}><DiceIcon size={48} /></div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, background: 'linear-gradient(135deg,#fff,var(--purple-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>UMUKINO</h1>
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Create your account and start playing.</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem', color: 'var(--red-neg)', fontSize: '0.87rem', marginBottom: '1.25rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Choose your color</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {AVATARS.map(a => (
                  <button key={a} type="button" onClick={() => set('avatar', a)} style={{
                    width: 32, height: 32, borderRadius: '50%', border: form.avatar === a ? '3px solid white' : '3px solid transparent',
                    cursor: 'pointer', padding: 0, transition: 'all 0.15s',
                    boxShadow: form.avatar === a ? '0 0 0 2px var(--purple-primary)' : 'none',
                  }}>
                    <div className={`avatar avatar-${a}`} style={{ width: '100%', height: '100%', fontSize: '0.7rem', borderRadius: '50%' }}>
                      {form.avatar === a ? '✓' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Display Name</label>
              <input className="input" placeholder="meliodas reborn" value={form.displayName} onChange={e => set('displayName', e.target.value)} required minLength={2} maxLength={30} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Password</label>
              <input className="input" type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={e => set('password', e.target.value)} required />
              <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { ok: form.password.length >= 8, label: '8+ chars' },
                  { ok: /[A-Z]/.test(form.password), label: 'Uppercase' },
                  { ok: /[0-9]/.test(form.password), label: 'Number' },
                ].map(({ ok, label }) => (
                  <span key={label} style={{ fontSize: '0.72rem', color: ok ? 'var(--green-pos)' : 'var(--text-muted)' }}>
                    {ok ? '✓' : '○'} {label}
                  </span>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center', marginTop: '0.25rem', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.87rem' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
