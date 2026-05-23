'use client';
import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api, getErrorMsg } from '@/lib/api';
import { useRouter } from 'next/navigation';
import type { IconProps } from '@/components/layout/Icons';
import {
  ChartIcon, UsersIcon, DiceIcon, CoinsIcon, ShieldIcon, SparklesIcon,
  GamepadIcon, OnlineIcon, BanknoteIcon, RefreshIcon, BanIcon, CheckIcon,
  AlertIcon, IconBox,
} from '@/components/layout/Icons';

type AdminTab = 'dashboard' | 'users' | 'games' | 'revenue' | 'anticheat';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab]       = useState<AdminTab>('dashboard');
  const [dash, setDash]     = useState<any>(null);
  const [users, setUsers]   = useState<any[]>([]);
  const [games, setGames]   = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [queue, setQueue]   = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    loadTab(tab);
  }, [tab, user]);

  async function loadTab(t: AdminTab) {
    setLoading(true);
    try {
      if (t === 'dashboard') {
        const { data } = await api.http.get('/admin/dashboard');
        setDash(data);
      } else if (t === 'users') {
        const { data } = await api.http.get('/admin/users');
        setUsers(data?.data || data || []);
      } else if (t === 'games') {
        const { data } = await api.http.get('/admin/games');
        setGames(data || []);
      } else if (t === 'revenue') {
        const { data } = await api.http.get('/admin/revenue');
        setRevenue(data || []);
      } else if (t === 'anticheat') {
        const { data } = await api.http.get('/admin/review-queue');
        setQueue(data || []);
      }
    } catch { /* use mock */ } finally { setLoading(false); }
  }

  async function banUser(userId: string) {
    const reason = prompt('Ban reason:');
    if (!reason) return;
    try {
      await api.http.post(`/admin/users/${userId}/ban`, { reason });
      setMsg(`User ${userId} banned.`);
      loadTab('users');
    } catch (e) { setMsg(getErrorMsg(e)); }
  }

  async function unbanUser(userId: string) {
    try {
      await api.http.post(`/admin/users/${userId}/unban`, {});
      setMsg(`User ${userId} unbanned.`);
      loadTab('users');
    } catch (e) { setMsg(getErrorMsg(e)); }
  }

  async function forceEndGame(gameId: string) {
    const reason = prompt('Reason for ending game:');
    if (!reason) return;
    try {
      await api.http.post(`/admin/games/${gameId}/end`, { reason });
      setMsg(`Game ${gameId} ended.`);
      loadTab('games');
    } catch (e) { setMsg(getErrorMsg(e)); }
  }

  if (authLoading || !user || user.role !== 'admin') return null;

  const NAV_TABS: { key: AdminTab; label: string; Icon: React.ComponentType<IconProps> }[] = [
    { key: 'dashboard', label: 'Dashboard', Icon: ChartIcon },
    { key: 'users',     label: 'Users',     Icon: UsersIcon },
    { key: 'games',     label: 'Games',     Icon: DiceIcon },
    { key: 'revenue',   label: 'Revenue',   Icon: CoinsIcon },
    { key: 'anticheat', label: 'Anti-Cheat', Icon: ShieldIcon },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 52px)', marginTop: '52px' }}>

        {/* Sidebar */}
        <div style={{ borderRight: '1px solid var(--border)', padding: '1.5rem 1rem', background: 'var(--bg-surface)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Admin Panel</div>
            {NAV_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none',
                background: tab === t.key ? 'rgba(124,58,237,0.15)' : 'none',
                color: tab === t.key ? 'var(--purple-light)' : 'var(--text-secondary)',
                fontWeight: tab === t.key ? 700 : 500, fontSize: '0.88rem', cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left', marginBottom: '2px',
                borderLeft: `3px solid ${tab === t.key ? 'var(--purple-primary)' : 'transparent'}`,
              }}>
                <t.Icon size={16} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          {msg && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', color: 'var(--green-pos)', fontSize: '0.87rem', marginBottom: '1.25rem' }}>
              {msg} <button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ChartIcon size={22} /> Dashboard</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { label: 'Total Users', value: dash?.users?.total ?? '—', Icon: UsersIcon, color: 'var(--purple-light)' },
                  { label: 'New Today', value: dash?.users?.newToday ?? '—', Icon: SparklesIcon, color: 'var(--green-pos)' },
                  { label: 'Active Games', value: dash?.activeNow?.games ?? '—', Icon: GamepadIcon, color: 'var(--gold)' },
                  { label: 'Online Players', value: dash?.activeNow?.players ?? '—', Icon: OnlineIcon, color: 'var(--green-pos)' },
                  { label: "Today's Revenue", value: dash?.revenue?.today ? `${Number(dash.revenue.today).toLocaleString()} RWF` : '—', Icon: BanknoteIcon, color: 'var(--gold)' },
                  { label: 'Total Revenue', value: dash?.revenue?.total ? `${Number(dash.revenue.total).toLocaleString()} RWF` : '—', Icon: CoinsIcon, color: 'var(--gold)' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '1.25rem' }}>
                    <IconBox color={s.color}><s.Icon size={26} /></IconBox>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {!dash && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center' }}><RefreshIcon size={32} /></div>
                  <p>Connect to backend to see live stats</p>
                  <button onClick={() => loadTab('dashboard')} className="btn-secondary" style={{ marginTop: '1rem' }}>Retry</button>
                </div>
              )}
            </>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}><UsersIcon size={22} /> Users</h2>
                <input className="input" placeholder="Search by name or email…" style={{ width: '250px' }} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 100px', padding: '0.75rem 1.25rem', background: 'var(--bg-elevated)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>User</span><span>Email</span><span>Role</span><span>Status</span><span>Actions</span>
                </div>
                {loading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : (users.length === 0 ? MOCK_USERS : users).filter((u: any) =>
                    !search || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
                  ).map((u: any) => (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 100px', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={`avatar avatar-${u.avatar || 'green'}`} style={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0 }}>{u.displayName?.[0]?.toUpperCase()}</div>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{u.displayName}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u.email}</span>
                    <span style={{ fontSize: '0.78rem' }}>
                      {u.role === 'admin' ? <span className="tag-pro">ADMIN</span> : <span style={{ color: 'var(--text-muted)' }}>player</span>}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: u.isBanned ? 'var(--red-neg)' : 'var(--green-pos)' }}>
                      {u.isBanned ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BanIcon size={12} /> Banned</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckIcon size={12} /> Active</span>}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {u.isBanned
                        ? <button onClick={() => unbanUser(u.id)} style={{ fontSize: '0.72rem', padding: '4px 8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', color: 'var(--green-pos)', cursor: 'pointer' }}>Unban</button>
                        : <button onClick={() => banUser(u.id)} style={{ fontSize: '0.72rem', padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: 'var(--red-neg)', cursor: 'pointer' }}>Ban</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── GAMES ── */}
          {tab === 'games' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}><DiceIcon size={22} /> Active Games</h2>
                <button onClick={() => loadTab('games')} className="btn-secondary" style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><RefreshIcon size={14} /> Refresh</button>
              </div>
              {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(games.length === 0 ? MOCK_GAMES : games).map((g: any) => (
                    <div key={g.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>Game {g.id?.slice(0, 8)}…</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {g.players} players · Round {g.round} · Started {g.startedAt ? new Date(g.startedAt).toLocaleTimeString() : 'unknown'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '50px', background: 'rgba(34,197,94,0.1)', color: 'var(--green-pos)', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 600 }}>
                          {g.status}
                        </span>
                        <button onClick={() => forceEndGame(g.id)} style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: 'var(--red-neg)', cursor: 'pointer' }}>
                          Force End
                        </button>
                      </div>
                    </div>
                  ))}
                  {games.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No active games right now.</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── REVENUE ── */}
          {tab === 'revenue' && (
            <>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><CoinsIcon size={22} /> Revenue</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { label: "Today's Cut",    value: dash?.revenue?.today,     color: 'var(--green-pos)' },
                  { label: "This Month",     value: dash?.revenue?.thisMonth, color: 'var(--purple-light)' },
                  { label: "All Time",       value: dash?.revenue?.total,     color: 'var(--gold)' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color }}>
                      {s.value ? `${Number(s.value).toLocaleString()} RWF` : '—'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-elevated)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <span>Date</span><span>Room</span><span style={{ textAlign: 'right' }}>Amount (RWF)</span>
                </div>
                {(revenue.length === 0 ? MOCK_REVENUE : revenue).map((r: any, i: number) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.date || new Date(r.created_at || Date.now()).toLocaleDateString()}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.room_id ? r.room_id.slice(0,8) + '…' : 'N/A'}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-pos)' }}>+{Number(r.revenue || r.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── ANTI-CHEAT ── */}
          {tab === 'anticheat' && (
            <>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldIcon size={22} /> Anti-Cheat Review Queue</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem', marginBottom: '1.5rem' }}>Players flagged by the anti-collusion engine for manual review.</p>
              {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div> : (
                queue.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ marginBottom: '0.75rem', color: 'var(--green-pos)', display: 'flex', justifyContent: 'center' }}><CheckIcon size={40} /></div>
                    <div style={{ fontWeight: 600 }}>Queue is clear</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>No players flagged for review.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {queue.map((entry: string) => {
                      const [uid1, uid2] = entry.split(':');
                      return (
                        <div key={entry} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--red-neg)', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertIcon size={14} /> Flagged player pair</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>{uid1}{uid2 ? ` ↔ ${uid2}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => api.http.post('/admin/confirm-violation', { userId: uid1, type: 'collusion' }).then(() => loadTab('anticheat'))} style={{ fontSize: '0.75rem', padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--red-neg)', cursor: 'pointer' }}>
                              Confirm
                            </button>
                            <button onClick={() => api.http.post('/admin/clear-violations', { userId: uid1 }).then(() => loadTab('anticheat'))} style={{ fontSize: '0.75rem', padding: '5px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--green-pos)', cursor: 'pointer' }}>
                              Clear
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Mock data for dev
const MOCK_USERS = [
  { id: '1', displayName: 'Amani Patrick', email: 'amani@umukino.rw', avatar: 'purple', role: 'admin', isBanned: false },
  { id: '2', displayName: 'Keza Marie',    email: 'keza@gmail.com',   avatar: 'yellow', role: 'player', isBanned: false },
  { id: '3', displayName: 'Bad Actor',     email: 'bad@example.com',  avatar: 'red',    role: 'player', isBanned: true },
];
const MOCK_GAMES = [
  { id: 'abc123def456', players: 4, round: 7, status: 'ACTIVE', startedAt: new Date().toISOString() },
  { id: 'xyz789uvw012', players: 3, round: 2, status: 'ACTIVE', startedAt: new Date().toISOString() },
];
const MOCK_REVENUE = [
  { date: new Date().toLocaleDateString(), room_id: 'room-001', amount: 3200 },
  { date: new Date(Date.now() - 86400000).toLocaleDateString(), room_id: 'room-002', amount: 4500 },
  { date: new Date(Date.now() - 172800000).toLocaleDateString(), room_id: 'room-003', amount: 1800 },
];
