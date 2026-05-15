'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { api, getErrorMsg } from '@/lib/api';
import { CopyIcon, LockIcon, UsersIcon } from '@/components/layout/Icons';

const DEFAULT_SETTINGS = {
  maxPlayers: 4,
  privateRoom: true,
  allowBots: false,
  onlyLoggedIn: false,
  doubleRentFullSet: false,
  vacationCash: false,
  auctionEnabled: false,
  noRentInJail: false,
  evenBuild: true,
  randomizeOrder: false,
  startingBalance: 150000,
  entryFeeRwf: 0,
  prizeDistribution: '1st_only' as '1st_only' | '1st_2nd' | '1st_2nd_3rd' | 'shared',
  minPlayers: 2,
};

export default function CreateRoomPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [lobbyType, setLobbyType] = useState<'friendly' | 'paid'>('friendly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }));
  const set = (key: keyof typeof settings, val: any) =>
    setSettings(s => ({ ...s, [key]: val }));

  async function handleCreate() {
    if (!name.trim()) { setError('Give your room a name'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.createRoom({
        name: name.trim(),
        settings: {
          ...settings,
          entryFeeRwf: lobbyType === 'paid' ? settings.entryFeeRwf : 0,
        },
        entryFeeRwf: lobbyType === 'paid' ? settings.entryFeeRwf : 0,
        maxPlayers: settings.maxPlayers,
        isPrivate: settings.privateRoom,
      });
      router.push(`/lobby/${data.code}`);
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 1.5rem 4rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>Create a game</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Configure your lobby settings, then share the link with friends.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
            color: 'var(--red-neg)', fontSize: '0.87rem', marginBottom: '1.5rem',
          }}>{error}</div>
        )}

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Room name */}
          <Section title="Room name">
            <input className="input" placeholder="e.g. Friday Night Monopoly"
              value={name} onChange={e => setName(e.target.value)} />
          </Section>

          {/* Lobby type */}
          <Section title="Lobby type">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {(['friendly','paid'] as const).map(t => (
                <button key={t} onClick={() => setLobbyType(t)} style={{
                  padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: `2px solid ${lobbyType === t ? 'var(--purple-primary)' : 'var(--border)'}`,
                  background: lobbyType === t ? 'rgba(124,58,237,0.12)' : 'var(--bg-elevated)',
                  color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>
                    {t === 'friendly' ? '🎮' : '💰'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {t === 'friendly' ? 'Friendly' : 'Paid'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t === 'friendly'
                      ? 'Play with friends, no real money'
                      : 'Real RWF entry fee, winner takes pot'}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Entry fee (paid only) */}
          {lobbyType === 'paid' && (
            <Section title="Entry fee (RWF)">
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[300, 500, 1000, 2000, 5000, 10000].map(fee => (
                  <button key={fee} onClick={() => set('entryFeeRwf', fee)} style={{
                    padding: '8px 16px', borderRadius: '50px',
                    border: `1px solid ${settings.entryFeeRwf === fee ? 'var(--gold)' : 'var(--border)'}`,
                    background: settings.entryFeeRwf === fee ? 'rgba(245,158,11,0.15)' : 'var(--bg-elevated)',
                    color: settings.entryFeeRwf === fee ? 'var(--gold)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {fee.toLocaleString()}
                  </button>
                ))}
                <input type="number" className="input" placeholder="Custom"
                  style={{ width: '100px' }}
                  value={settings.entryFeeRwf || ''}
                  onChange={e => set('entryFeeRwf', parseInt(e.target.value) || 0)} />
              </div>
              <PrizePreview fee={settings.entryFeeRwf} maxPlayers={settings.maxPlayers} />
            </Section>
          )}

          {/* Prize distribution (paid only) */}
          {lobbyType === 'paid' && (
            <Section title="Prize distribution">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { key: '1st_only', label: '🥇 1st place only takes all', desc: 'Winner gets 90% of pool' },
                  { key: '1st_2nd', label: '🥇🥈 Top 2 share', desc: '1st: 60% · 2nd: 30% · Platform: 10%' },
                  { key: '1st_2nd_3rd', label: '🥇🥈🥉 Top 3 share', desc: '1st: 50% · 2nd: 25% · 3rd: 15% · Platform: 10%' },
                  { key: 'shared', label: '🤝 Proportional share', desc: 'Ranked distribution based on final balance' },
                ].map(opt => (
                  <button key={opt.key} onClick={() => set('prizeDistribution', opt.key)} style={{
                    padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    border: `1px solid ${settings.prizeDistribution === opt.key ? 'var(--purple-primary)' : 'var(--border)'}`,
                    background: settings.prizeDistribution === opt.key ? 'rgba(124,58,237,0.1)' : 'var(--bg-elevated)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{opt.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Game settings */}
          <Section title="Game settings">
            <SettingToggle label="Maximum players" desc="How many players can join" icon="👥"
              control={
                <select className="select" value={settings.maxPlayers}
                  onChange={e => set('maxPlayers', parseInt(e.target.value))}>
                  {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              }
            />
            <SettingToggle label="Private room" desc="Only accessible via the room link"
              icon="🔒" value={settings.privateRoom} onToggle={() => toggle('privateRoom')} />
            <SettingToggle label="Allow bots to join" desc="Bots will join if seats are available" icon="🤖"
              badge="Beta" value={settings.allowBots} onToggle={() => toggle('allowBots')} />
            <SettingToggle label="Only logged-in users" desc="Guests cannot join this game"
              icon="👤" value={settings.onlyLoggedIn} onToggle={() => toggle('onlyLoggedIn')} />
            <SettingToggle label="Board map" desc="Change map tiles, properties and stacks"
              icon="🗺️" control={<span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Rwanda Classic · More coming soon →</span>} />
            <SettingToggle label="Randomize player order" desc="Shuffle turn order at game start"
              icon="🔀" value={settings.randomizeOrder} onToggle={() => toggle('randomizeOrder')} />
            {lobbyType === 'paid' && (
              <SettingToggle label="Minimum players to start"
                desc="Game won't start until this many players join" icon="⏳"
                control={
                  <select className="select" value={settings.minPlayers}
                    onChange={e => set('minPlayers', parseInt(e.target.value))}>
                    {[2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                }
              />
            )}
          </Section>

          {/* Gameplay rules */}
          <Section title="Gameplay rules">
            <SettingToggle label="×2 rent on full-set properties"
              desc="If a player owns a full property set, the base rent is doubled" icon="💰"
              value={settings.doubleRentFullSet} onToggle={() => toggle('doubleRentFullSet')} />
            <SettingToggle label="Vacation cash"
              desc="If a player lands on Vacation, all collected money from taxes and bank payments will be earned" icon="🏖️"
              value={settings.vacationCash} onToggle={() => toggle('vacationCash')} />
            <SettingToggle label="Auction"
              desc="If someone skips purchasing the property landed on, it will be sold to the highest bidder" icon="🔨"
              value={settings.auctionEnabled} onToggle={() => toggle('auctionEnabled')} />
            <SettingToggle label="Don't collect rent while in prison"
              desc="Rent will not be collected when landing on properties whose owners are in prison" icon="🚔"
              value={settings.noRentInJail} onToggle={() => toggle('noRentInJail')} />
            <SettingToggle label="Even build"
              desc="Houses and hotels must be built and sold evenly within a property set" icon="🏗️"
              value={settings.evenBuild} onToggle={() => toggle('evenBuild')} />
          </Section>

          {/* Create button */}
          <button className="btn-primary" onClick={handleCreate} disabled={loading} style={{
            width: '100%', padding: '1rem', fontSize: '1rem', justifyContent: 'center',
            borderRadius: 'var(--radius-md)', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Creating...' : '🎲 Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  );
}

function SettingToggle({ label, desc, icon, value, onToggle, control, badge }: {
  label: string; desc?: string; icon?: string;
  value?: boolean; onToggle?: () => void;
  control?: React.ReactNode; badge?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.6rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        {icon && <span style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center' }}>{icon}</span>}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{label}</span>
            {badge && <span className="tag-beta">{badge}</span>}
          </div>
          {desc && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{desc}</div>}
        </div>
      </div>
      <div style={{ flexShrink: 0, marginLeft: '1rem' }}>
        {control ?? (
          <label className="toggle">
            <input type="checkbox" checked={!!value} onChange={onToggle} />
            <span className="toggle-slider" />
          </label>
        )}
      </div>
    </div>
  );
}

function PrizePreview({ fee, maxPlayers }: { fee: number; maxPlayers: number }) {
  const pool = fee * maxPlayers;
  const cut = Math.floor(pool * 0.1);
  const prize = pool - cut;
  return (
    <div style={{
      marginTop: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
      padding: '0.75rem 1rem', fontSize: '0.8rem', display: 'flex', gap: '1.5rem',
    }}>
      <div><div style={{ color: 'var(--text-muted)' }}>Prize pool</div><div style={{ fontWeight: 700, color: 'var(--gold)' }}>{pool.toLocaleString()} RWF</div></div>
      <div><div style={{ color: 'var(--text-muted)' }}>Platform cut</div><div style={{ fontWeight: 700, color: 'var(--red-neg)' }}>−{cut.toLocaleString()} RWF</div></div>
      <div><div style={{ color: 'var(--text-muted)' }}>Winner gets</div><div style={{ fontWeight: 700, color: 'var(--green-pos)' }}>{prize.toLocaleString()} RWF</div></div>
    </div>
  );
}
