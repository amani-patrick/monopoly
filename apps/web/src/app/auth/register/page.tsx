'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMsg } from '@/lib/api';

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
      router.push('/');
    } catch (err) { setError(getErrorMsg(err)); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎲</div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, background: 'linear-gradient(135deg,#fff,var(--purple-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>UMUKINO</h1>
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Create your account and start playing.</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem', color: 'var(--red-neg)', fontSize: '0.87rem', marginBottom: '1.25rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Avatar picker */}
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

          <div style={{ position: 'relative', margin: '1.5rem 0', textAlign: 'center' }}>
            <div className="divider" />
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-card)', padding: '0 0.75rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>or</span>
          </div>

          <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`} className="btn-secondary" style={{ justifyContent: 'center', width: '100%', textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </a>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.87rem' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--purple-light)', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
