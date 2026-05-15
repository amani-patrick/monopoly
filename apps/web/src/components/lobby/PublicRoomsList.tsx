'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  status: string;
  entryFeeRwf: number;
  maxPlayers: number;
  isPrivate: boolean;
  prizePool: number;
  players: any[];
  settings: any;
  createdAt: string;
}

const AVATARS = ['green','yellow','orange','red','blue','cyan','teal','pink','purple','brown'];

export function PublicRoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.getPublicRooms();
        setRooms(data || []);
      } catch {
        // Use mock data in dev
        setRooms(MOCK_ROOMS);
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(t);
  }, []);

  const filtered = rooms.filter(r =>
    filter === 'all' ? true : filter === 'free' ? r.entryFeeRwf === 0 : r.entryFeeRwf > 0
  );

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['all','free','paid'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: '50px', border: 'none',
            background: filter === f ? 'var(--purple-primary)' : 'var(--bg-elevated)',
            color: filter === f ? 'white' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            {f === 'all' ? 'All' : f === 'free' ? '🎮 Free' : '💰 Paid'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} room{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <RoomsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyRooms filter={filter} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px,1fr))', gap: '1rem' }}>
          {filtered.map(room => <RoomCard key={room.id} room={room} />)}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room }: { room: Room }) {
  const isPaid = room.entryFeeRwf > 0;
  const playerCount = room.players?.length || 1;
  const maxPlayers = room.maxPlayers || 4;

  return (
    <div className="card glass-hover" style={{ padding: '1.25rem', transition: 'all 0.2s', cursor: 'default' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isPaid ? <span className="tag-pro">PRO</span> : <span className="tag-free">FREE</span>}
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{room.name || `Room ${room.code}`}</span>
        </div>
        <span style={{
          fontSize: '0.72rem', color: 'var(--text-muted)',
          background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          fontFamily: 'monospace',
        }}>#{room.code}</span>
      </div>

      {/* Map preview */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
        padding: '0.6rem 0.9rem', marginBottom: '0.85rem',
        display: 'flex', alignItems: 'center', gap: '8px',
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '1.1rem' }}>🗺️</span>
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Rwanda Classic</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>40 spaces · Rwanda + International</div>
        </div>
      </div>

      {/* Players */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex' }}>
          {Array.from({ length: Math.min(playerCount, 4) }).map((_, i) => (
            <div key={i} className={`avatar avatar-${AVATARS[i % AVATARS.length]}`} style={{
              width: 26, height: 26, fontSize: '0.68rem', marginLeft: i > 0 ? '-6px' : 0,
              border: '2px solid var(--bg-card)', zIndex: 4 - i,
            }}>
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {playerCount}/{maxPlayers} players
        </span>
        {/* Capacity bar */}
        <div style={{ flex: 1, height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${(playerCount / maxPlayers) * 100}%`,
            background: playerCount >= maxPlayers ? 'var(--red-neg)' : 'var(--purple-primary)',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Rules chips */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {room.settings?.doubleRentFullSet && <RuleChip label="2× rent" />}
        {room.settings?.vacationCash && <RuleChip label="Vacation 💰" />}
        {room.settings?.auctionEnabled && <RuleChip label="Auction 🔨" />}
        {room.settings?.noRentInJail && <RuleChip label="Jail safe" />}
      </div>

      {/* Entry fee + join */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {isPaid ? (
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Entry fee</div>
              <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.95rem' }}>
                {room.entryFeeRwf.toLocaleString()} RWF
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--green-pos)', fontWeight: 600 }}>Free to join</div>
          )}
        </div>
        <Link href={`/lobby/${room.code}`} className={isPaid ? 'btn-gold' : 'btn-primary'}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: '50px' }}>
          {playerCount >= maxPlayers ? '👁 Spectate' : 'Join →'}
        </Link>
      </div>
    </div>
  );
}

function RuleChip({ label }: { label: string }) {
  return (
    <span style={{
      background: 'rgba(124,58,237,0.15)', color: 'var(--purple-light)',
      border: '1px solid rgba(124,58,237,0.25)',
      padding: '2px 8px', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 500,
    }}>{label}</span>
  );
}

function RoomsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '1rem' }}>
      {[1,2,3].map(i => (
        <div key={i} className="card" style={{ padding: '1.25rem', height: '240px' }}>
          <div style={{ background: 'var(--bg-elevated)', height: '16px', width: '60%', borderRadius: '4px', marginBottom: '1rem',
            backgroundImage: 'linear-gradient(90deg,var(--bg-elevated) 25%,var(--bg-hover) 50%,var(--bg-elevated) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
          }} />
          <div style={{ background: 'var(--bg-elevated)', height: '60px', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }} />
          <div style={{ background: 'var(--bg-elevated)', height: '12px', width: '40%', borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  );
}

function EmptyRooms({ filter }: { filter: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎲</div>
      <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No {filter === 'all' ? '' : filter} rooms open</div>
      <div style={{ fontSize: '0.85rem' }}>Be the first to create one!</div>
    </div>
  );
}

// ---- Mock data for development ----
const MOCK_ROOMS: Room[] = [
  { id: '1', code: 'RW001', name: 'Kigali Champions', hostId: 'u1', status: 'LOBBY', entryFeeRwf: 1000, maxPlayers: 4, isPrivate: false, prizePool: 3000, players: [{},{},{}], settings: { doubleRentFullSet: true, auctionEnabled: true }, createdAt: new Date().toISOString() },
  { id: '2', code: 'RW002', name: 'Friday Night Game', hostId: 'u2', status: 'LOBBY', entryFeeRwf: 0, maxPlayers: 6, isPrivate: false, prizePool: 0, players: [{},{}], settings: { vacationCash: true, noRentInJail: true }, createdAt: new Date().toISOString() },
  { id: '3', code: 'RW003', name: 'High Stakes', hostId: 'u3', status: 'LOBBY', entryFeeRwf: 5000, maxPlayers: 4, isPrivate: false, prizePool: 15000, players: [{}], settings: { doubleRentFullSet: true, auctionEnabled: true, vacationCash: true }, createdAt: new Date().toISOString() },
];
