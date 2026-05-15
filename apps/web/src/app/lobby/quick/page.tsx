'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMsg } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Navbar } from '@/components/layout/Navbar';

export default function QuickMatchPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const findMatch = async () => {
      try {
        setStatus('Searching for available games...');
        const { data: rooms } = await api.getPublicRooms();
        
        // Find a room that is not full and not in-game
        const availableRoom = rooms.find((r: any) => 
          r.status === 'LOBBY' && 
          r.playerCount < r.maxPlayers && 
          !r.isPrivate
        );

        if (availableRoom) {
          setStatus(`Found a game: ${availableRoom.name}. Joining...`);
          await api.joinRoom(availableRoom.code);
          router.push(`/lobby/${availableRoom.code}`);
        } else {
          setStatus('No available games found. Creating a new one...');
          const { data: newRoom } = await api.createRoom({
            name: `Quick Match ${Math.floor(Math.random() * 1000)}`,
            entryFeeRwf: 0,
            maxPlayers: 4,
            isPrivate: false,
          });
          router.push(`/lobby/${newRoom.code}`);
        }
      } catch (err) {
        toast.error(getErrorMsg(err));
        router.push('/');
      }
    };

    findMatch();
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', height: '80vh', textAlign: 'center', padding: '2rem'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }} className="animate-spin-slow">⏳</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Finding a Match</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{status}</p>
        
        <button 
          onClick={() => router.push('/')}
          className="btn-secondary" 
          style={{ marginTop: '2rem', borderRadius: '50px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
