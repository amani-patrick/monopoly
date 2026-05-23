'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api, getErrorMsg } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  DiceIcon, TrophyIcon, ChartIcon, FlameIcon, CheckIcon, PencilIcon, IconBox,
} from '@/components/layout/Icons';

const AVATARS = ['green','yellow','orange','red','blue','cyan','teal','pink','purple','brown'];

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats]       = useState<any>(null);
  const [history, setHistory]   = useState<any[]>([]);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({ displayName: '', avatar: '' });
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
    if (user) {
      setForm({ displayName: user.displayName, avatar: user.avatar });
      api.getPlayerStats(user.id).then(({ data }) => setStats(data)).catch(() => {});
      api.getLeaderboard().then(({ data }) => {}).catch(() => {});
    }
  }, [user, authLoading]);

  async function saveProfile() {
    setSaving(true); setMsg('');
    try {
      await api.updateMe(form);
      setEditing(false); setMsg('Profile updated!');
    } catch (e) { setMsg(getErrorMsg(e)); }
    finally { setSaving(false); }
  }

  if (authLoading || !user) return null;

  const winRate = stats ? ((stats.gamesWon / Math.max(stats.gamesPlayed, 1)) * 100).toFixed(1) : '—';

  const statCards = [
    { label: 'Games Played', value: stats?.gamesPlayed ?? '—', Icon: DiceIcon },
    { label: 'Wins', value: stats?.gamesWon ?? '—', Icon: TrophyIcon, color: 'var(--gold)' },
    { label: 'Win Rate', value: stats?.gamesPlayed ? `${winRate}%` : '—', Icon: ChartIcon, color: 'var(--purple-light)' },
    { label: 'Best Streak', value: stats?.longestWinStreak ?? '—', Icon: FlameIcon, color: 'var(--gold)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 1.5rem 4rem' }}>

        <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <div className={`avatar avatar-${editing ? form.avatar : user.avatar}`} style={{ width: 80, height: 80, fontSize: '2rem', flexShrink: 0 }}>
                {user.displayName[0].toUpperCase()}
              </div>
              {stats?.currentWinStreak >= 3 && (
                <div style={{ position: 'absolute', top: -6, right: -6, background: 'var(--gold)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a2e' }}>
                  <FlameIcon size={14} />
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input className="input" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} maxLength={30} style={{ maxWidth: '280px' }} />
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {AVATARS.map(a => (
                      <button key={a} onClick={() => setForm(f => ({ ...f, avatar: a }))} style={{
                        width: 32, height: 32, borderRadius: '50%', border: form.avatar === a ? '2px solid white' : '2px solid transparent',
                        cursor: 'pointer', padding: 0, boxShadow: form.avatar === a ? '0 0 0 2px var(--purple-primary)' : 'none',
                      }}>
                        <div className={`avatar avatar-${a}`} style={{ width: '100%', height: '100%', borderRadius: '50%', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {form.avatar === a ? <CheckIcon size={12} /> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ fontSize: '0.85rem' }}>{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditing(false)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Cancel</button>
                  </div>
                  {msg && <div style={{ color: 'var(--green-pos)', fontSize: '0.82rem' }}>{msg}</div>}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{user.displayName}</h1>
                    {user.role === 'admin' && <span className="tag-pro">ADMIN</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{user.email}</div>
                  <button onClick={() => setEditing(true)} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <PencilIcon size={14} /> Edit Profile
                  </button>
                </>
              )}
            </div>

            {stats?.currentWinStreak > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', textAlign: 'center' }}>
                <IconBox color="var(--gold)"><FlameIcon size={28} /></IconBox>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>{stats.currentWinStreak}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Win streak</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {statCards.map(s => (
            <div key={s.label} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <IconBox color={s.color}><s.Icon size={28} /></IconBox>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color || 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Member since</div>
              <div style={{ fontWeight: 600 }}>{new Date(user.createdAt || Date.now()).toLocaleDateString('en-RW', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status</div>
              <div style={{ fontWeight: 600, color: 'var(--green-pos)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckIcon size={14} /> Active
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Earned</div>
              <div style={{ fontWeight: 600, color: 'var(--gold)' }}>{Number(stats?.totalEarned || 0).toLocaleString()} RWF</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
