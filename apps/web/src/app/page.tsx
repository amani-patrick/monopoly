'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PublicRoomsList } from '@/components/lobby/PublicRoomsList';
import { HowToPlay } from '@/components/landing/HowToPlay';
import { useAuth } from '@/hooks/useAuth';

const FLOATERS = [
  { emoji: '🏦', x: 8,  y: 25, size: 52, delay: 0 },
  { emoji: '💳', x: 5,  y: 55, size: 38, delay: 0.8 },
  { emoji: '🏠', x: 12, y: 72, size: 44, delay: 1.5 },
  { emoji: '✈️', x: 20, y: 40, size: 36, delay: 0.4 },
  { emoji: '⚡', x: 72, y: 28, size: 40, delay: 1.1 },
  { emoji: '❓', x: 80, y: 55, size: 54, delay: 0.2 },
  { emoji: '💰', x: 85, y: 75, size: 38, delay: 1.7 },
  { emoji: '🎲', x: 90, y: 35, size: 32, delay: 0.6 },
  { emoji: '💡', x: 15, y: 85, size: 34, delay: 2.0 },
  { emoji: '🏢', x: 75, y: 85, size: 46, delay: 0.9 },
  { emoji: '💎', x: 3,  y: 40, size: 30, delay: 1.3 },
  { emoji: '🎯', x: 92, y: 60, size: 32, delay: 1.8 },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const [showRooms, setShowRooms] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', overflowX: 'hidden' }}>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', paddingTop: '52px',
      }}>
        {/* Floating icons */}
        {mounted && FLOATERS.map((f, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${f.x}%`, top: `${f.y}%`,
            fontSize: `${f.size}px`, opacity: 0.06, userSelect: 'none', pointerEvents: 'none',
            animation: `${i % 2 === 0 ? 'float' : 'floatReverse'} ${3.5 + i * 0.3}s ease-in-out ${f.delay}s infinite`,
          }}>
            {f.emoji}
          </div>
        ))}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: '700px', height: '700px', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(124,58,237,0.13) 0%, transparent 70%)',
        }} />

        <div className="animate-slide-up" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '80px', marginBottom: '0.75rem' }} className="animate-dice">🎲</div>

          <h1 style={{
            fontSize: 'clamp(2.8rem,8vw,5.5rem)', fontWeight: 900,
            letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '0.35rem',
            background: 'linear-gradient(135deg,#fff 0%,var(--purple-light) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>UMUKINO</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '2.5rem' }}>
            Fata umurimo w'ubukungu &nbsp;•&nbsp; Rule the economy
          </p>

          {/* Playing as chip */}
          {!loading && user && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              background: 'var(--bg-elevated)', borderRadius: '50px',
              padding: '7px 16px 7px 8px', marginBottom: '1.5rem',
              border: '1px solid var(--border)',
            }}>
              <div className={`avatar avatar-${user.avatar}`} style={{ width: 28, height: 28, fontSize: '0.78rem' }}>
                {user.displayName[0].toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Playing as</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{user.displayName}</div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Link
              href={user ? '/lobby/quick' : '/auth/login'}
              className="btn-primary animate-glow"
              style={{ fontSize: '1.15rem', padding: '0.95rem 3.5rem', borderRadius: '50px' }}
            >
              <span>▶▶</span> Play
            </Link>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => { setShowRooms(v => !v); setTimeout(() => document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                className="btn-secondary" style={{ borderRadius: '50px', gap: '8px' }}>
                👥 All rooms
              </button>
              <Link href="/lobby/create" className="btn-secondary" style={{ borderRadius: '50px', gap: '8px' }}>
                🔒 Create a private game
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center',
          animation: 'float 2.5s ease-in-out infinite',
        }}>
          <div>Scroll down to see rooms & rules</div>
          <div style={{ marginTop: 4 }}>↓</div>
        </div>
      </section>

      {/* ── Rooms ── */}
      <section id="rooms" style={{ padding: '2rem 1.5rem 4rem', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Open Rooms</h2>
          <Link href="/lobby/create" className="btn-primary" style={{ borderRadius: '50px', fontSize: '0.9rem' }}>
            + Create Room
          </Link>
        </div>
        <PublicRoomsList />
      </section>

      {/* ── How to play ── */}
      <HowToPlay />

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '1.5rem 2rem',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: '2rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.8rem',
      }}>
        {['More Information', 'Blog', 'Terms & Conditions', 'Privacy', 'Cookies', 'Play Games'].map(l => (
          <Link key={l} href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none',
            transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >{l}</Link>
        ))}
      </footer>
    </div>
  );
}
