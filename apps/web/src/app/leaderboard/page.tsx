'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { TrophyIcon, ChartIcon, MedalIcon, FlameIcon, IconBox } from '@/components/layout/Icons';

const TABS = ['wins','winrate'] as const;

export default function LeaderboardPage() {
  const [tab, setTab]         = useState<'wins'|'winrate'>('wins');
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    setLoading(true);
    api.getLeaderboard(tab)
      .then(({ data }) => setData(data || []))
      .catch(() => setData(MOCK_LB))
      .finally(() => setLoading(false));
  }, [tab]);

  const filtered = data.filter(p => !search || p.displayName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 1.5rem 4rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <IconBox size="3rem" color="var(--gold)"><TrophyIcon size={48} /></IconBox>
          <h1 style={{ fontSize: '2rem', fontWeight: 900 }}>Leaderboard</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>Top players on Umukino</p>
        </div>

        {/* Tabs + search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '7px 18px', borderRadius: '50px', border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--purple-primary)' : 'var(--bg-elevated)',
                color: tab === t ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem',
              }}>
                {t === 'wins' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><TrophyIcon size={14} /> Most Wins</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ChartIcon size={14} /> Win Rate</span>}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Search player…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '200px' }} />
        </div>

        {/* Top 3 podium */}
        {!loading && filtered.length >= 3 && !search && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
            {[filtered[1], filtered[0], filtered[2]].map((p, i) => {
              const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
              const heights = [80, 100, 60];
              const podiumColors = ['#9ca3af', 'var(--gold)', '#b45309'];
              return (
                <div key={p?.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <MedalIcon size={28} color={podiumColors[i]} />
                  <div className={`avatar avatar-${p?.avatar || 'purple'}`} style={{ width: 48, height: 48, fontSize: '1.1rem' }}>
                    {p?.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{p?.displayName}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p?.gamesWon ?? 0}W</div>
                  <div style={{
                    width: 70, height: heights[i],
                    background: rank === 1 ? 'linear-gradient(180deg,var(--gold),#d97706)' : rank === 2 ? 'linear-gradient(180deg,#9ca3af,#6b7280)' : 'linear-gradient(180deg,#b45309,#92400e)',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 900, color: 'rgba(0,0,0,0.5)',
                  }}>{rank}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No players found.</div>
          ) : (
            filtered.map((p: any, i: number) => (
              <div key={p.userId || i} style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem',
                borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Rank */}
                <div style={{ width: 28, textAlign: 'center', fontWeight: 800, color: i < 3 ? ['var(--gold)','#9ca3af','#b45309'][i] : 'var(--text-muted)', fontSize: i < 3 ? '1rem' : '0.9rem' }}>
                  {i < 3 ? <MedalIcon size={18} color={['var(--gold)','#9ca3af','#b45309'][i]} /> : i + 1}
                </div>
                {/* Avatar */}
                <div className={`avatar avatar-${p.avatar || 'green'}`} style={{ width: 36, height: 36, fontSize: '0.85rem', flexShrink: 0 }}>
                  {p.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                {/* Name */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{p.displayName}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.gamesPlayed || 0} games played</div>
                </div>
                {/* Stats */}
                <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.95rem' }}>{p.gamesWon || 0}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Wins</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--purple-light)', fontSize: '0.95rem' }}>
                      {p.gamesPlayed ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(0) : 0}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Win rate</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--green-pos)', fontSize: '0.88rem' }}>
                      {p.currentWinStreak > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><FlameIcon size={14} />{p.currentWinStreak}</span> : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Streak</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const MOCK_LB = [
  { userId: '1', displayName: 'Amani Patrick', avatar: 'purple', gamesWon: 42, gamesPlayed: 60, currentWinStreak: 5 },
  { userId: '2', displayName: 'Keza Marie',    avatar: 'yellow', gamesWon: 38, gamesPlayed: 55, currentWinStreak: 2 },
  { userId: '3', displayName: 'Mugisha Boss',  avatar: 'red',    gamesWon: 31, gamesPlayed: 48, currentWinStreak: 0 },
  { userId: '4', displayName: 'Uwase Grace',   avatar: 'green',  gamesWon: 28, gamesPlayed: 45, currentWinStreak: 1 },
  { userId: '5', displayName: 'Hirwa Tech',    avatar: 'blue',   gamesWon: 22, gamesPlayed: 40, currentWinStreak: 3 },
];
