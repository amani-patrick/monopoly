'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { CopyIcon, UsersIcon, LockIcon, PlayIcon } from '@/components/layout/Icons';

const AVATARS = ['green','yellow','orange','red','blue','cyan','teal','pink','purple','brown'];

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [room, setRoom]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]  = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('green');
  const [joined, setJoined]  = useState(false);
  const [starting, setStarting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load room
  useEffect(() => {
    api.getRoomByCode(code).then(({ data }) => { setRoom(data); setLoading(false); }).catch(() => setLoading(false));
  }, [code]);

  // WS connection
  useEffect(() => {
    if (!user || authLoading) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, { auth: { token }, transports: ['websocket','polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', { roomCode: code });
      setJoined(true);
    });

    socket.on('room.player.joined',  ({ room }) => setRoom(room));
    socket.on('room.player.left',    ({ room }) => setRoom(room));
    socket.on('room.player.ready',   ({ room }) => setRoom(room));
    socket.on('room.game.starting',  () => {});
    socket.on('game.started',        ({ gameId }) => router.push(`/game/${gameId}`));

    return () => { socket.disconnect(); };
  }, [user, authLoading, code]);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/lobby/${code}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function handleReady() {
    socketRef.current?.emit('room:ready');
  }

  async function handleStart() {
    if (!room || starting) return;
    setStarting(true);
    try {
      socketRef.current?.emit('room:start', { roomCode: code });
    } catch (e) { setStarting(false); }
  }

  async function handleSpectate() {
    try {
      const { data } = await api.joinRoom(code);
      router.push(`/game/${data.gameId}?spectator=true`);
    } catch {}
  }

  if (loading || authLoading) return <LoadingScreen />;
  if (!room) return <div style={{ color: 'white', padding: '4rem', textAlign: 'center' }}>Room not found.</div>;

  const isHost   = user?.id === room.hostId;
  const isInGame = room.status === 'IN_GAME';
  const isPaid   = (room.settings?.entryFeeRwf ?? room.entryFeeRwf ?? 0) > 0;
  const fee      = room.entryFeeRwf ?? room.settings?.entryFeeRwf ?? 0;
  const pool     = fee * (room.players?.length || 1);
  const allReady = room.players?.every((p: any) => p.ready) && room.players?.length >= 2;
  const myPlayer = room.players?.find((p: any) => p.userId === user?.id);
  const gameLink = typeof window !== 'undefined' ? `${window.location.origin}/lobby/${code}` : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, height: 'calc(100vh - 52px)', marginTop: '52px' }}>

        {/* ── LEFT: board preview + avatar selector ── */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
          {/* Blurred board bg */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(245,158,11,0.08) 0%, transparent 60%)', filter: 'blur(1px)' }} />

          <div className="animate-slide-up" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            {isInGame ? (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎮</div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Game in progress</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>This game has already started.</p>
                {isPaid && <button onClick={handleSpectate} className="btn-secondary">👁 Spectate as viewer</button>}
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Select your player appearance:</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: '12px', justifyContent: 'center', marginBottom: '2rem' }}>
                  {AVATARS.map(a => (
                    <button key={a} onClick={() => setSelectedAvatar(a)} style={{
                      width: 48, height: 48, borderRadius: '50%', border: selectedAvatar === a ? '3px solid white' : '3px solid transparent',
                      cursor: 'pointer', padding: 0, transition: 'all 0.2s',
                      boxShadow: selectedAvatar === a ? '0 0 0 2px var(--purple-primary), 0 0 16px var(--purple-glow)' : 'none',
                      transform: selectedAvatar === a ? 'scale(1.15)' : 'scale(1)',
                    }}>
                      <div className={`avatar avatar-${a}`} style={{ width: '100%', height: '100%', borderRadius: '50%', fontSize: '0.75rem' }}>
                        {selectedAvatar === a ? '✓' : ''}
                      </div>
                    </button>
                  ))}
                </div>

                {!myPlayer ? (
                  <button onClick={() => socketRef.current?.emit('room:join', { roomCode: code, avatar: selectedAvatar })} className="btn-primary" style={{ fontSize: '1.05rem', padding: '0.85rem 2.5rem', borderRadius: '50px', gap: '0.75rem' }}>
                    Join game →
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={handleReady} className={myPlayer.ready ? 'btn-secondary' : 'btn-primary'} style={{ fontSize: '1rem', padding: '0.75rem 2rem', borderRadius: '50px' }}>
                      {myPlayer.ready ? '✓ Ready!' : 'Mark as Ready'}
                    </button>
                    {isHost && (
                      <button onClick={handleStart} disabled={!allReady || starting} className="btn-gold" style={{
                        fontSize: '1rem', padding: '0.75rem 2rem', borderRadius: '50px', opacity: allReady ? 1 : 0.5,
                      }}>
                        {starting ? 'Starting…' : '▶ Start Game'}
                      </button>
                    )}
                    {!allReady && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Waiting for all players to be ready…</p>}
                  </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '50px' }}>
                    🛒 Get more appearances
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: settings panel ── */}
        <div style={{ borderLeft: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Share link */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Share this game</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ℹ</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly value={gameLink} className="input" style={{ fontSize: '0.78rem', padding: '0.5rem 0.75rem' }} onClick={e => (e.target as HTMLInputElement).select()} />
              <button onClick={copyLink} className="btn-secondary" style={{ padding: '0.5rem 0.75rem', flexShrink: 0 }}>
                {copied ? '✓' : <CopyIcon />}
              </button>
            </div>
          </div>

          {/* Waiting status */}
          <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {isInGame ? '🎮 Game in progress' : '⏳ Waiting for players…'}
          </div>

          {/* Players */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem' }}>
              Players ({room.players?.length || 0}/{room.maxPlayers || room.settings?.maxPlayers || 4})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(room.players || []).map((p: any, i: number) => (
                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: 'var(--radius-md)', background: p.userId === user?.id ? 'rgba(124,58,237,0.1)' : 'transparent', border: p.userId === user?.id ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent' }}>
                  <div className={`avatar avatar-${p.avatar || AVATARS[i % AVATARS.length]}`} style={{ width: 30, height: 30, fontSize: '0.75rem', flexShrink: 0 }}>
                    {p.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                      {p.displayName} {p.userId === room.hostId && <span style={{ fontSize: '0.65rem', color: 'var(--gold)' }}>HOST</span>}
                      {p.isBot && <span className="tag-beta" style={{ marginLeft: '4px' }}>BOT</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: p.ready ? 'var(--green-pos)' : 'var(--text-muted)' }}>
                    {p.ready ? '✓ Ready' : 'Waiting'}
                  </div>
                </div>
              ))}
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, (room.maxPlayers || room.settings?.maxPlayers || 4) - (room.players?.length || 0)) }).map((_, i) => (
                <div key={`empty-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', opacity: 0.35 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px dashed var(--border-bright)' }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Waiting for player…</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prize pool (paid only) */}
          {isPaid && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Prize Pool</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)' }}>{pool.toLocaleString()} RWF</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Entry: {fee.toLocaleString()} RWF · Platform cut: 10%</div>
            </div>
          )}

          {/* Game settings */}
          <div style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem' }}>Game Settings</h3>
            {[
              { label: 'Maximum players', value: room.settings?.maxPlayers || room.maxPlayers || 4, icon: '👥' },
              { label: 'Private room', value: (room.isPrivate || room.settings?.privateRoom) ? 'On' : 'Off', icon: '🔒' },
              { label: 'Allow bots', value: room.settings?.allowBots ? 'On' : 'Off', icon: '🤖' },
              { label: 'Board map', value: 'Rwanda Classic', icon: '🗺️' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', gap: '7px' }}><span>{icon}</span>{label}</span>
                <span style={{ fontWeight: 600, color: value === 'Off' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}

            <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1rem 0 0.75rem' }}>Gameplay Rules</h3>
            {[
              { label: '×2 rent on full-set properties', active: room.settings?.doubleRentFullSet },
              { label: 'Vacation cash', active: room.settings?.vacationCash },
              { label: 'Auction', active: room.settings?.auctionEnabled },
              { label: "Don't collect rent while in prison", active: room.settings?.noRentInJail },
              { label: 'Even build (houses & hotels)', active: room.settings?.evenBuild !== false },
              { label: 'Randomize player order', active: room.settings?.randomizeOrder || isPaid },
            ].map(({ label, active }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                <div style={{ width: 32, height: 18, borderRadius: '9px', background: active ? 'var(--purple-primary)' : 'var(--bg-hover)', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: active ? 16 : 2, transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '3rem' }} className="animate-dice">🎲</div>
      <p style={{ color: 'var(--text-secondary)' }}>Loading game…</p>
    </div>
  );
}
