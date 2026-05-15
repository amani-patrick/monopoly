'use client';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { WalletIcon, UserIcon, TrophyIcon, LogOutIcon, SettingsIcon, ShieldIcon } from './Icons';

export function Navbar() {
  const { user, logout, loading } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const [friendsOnline] = useState(0); // TODO: connect to presence service
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.5rem', height: '52px',
      background: 'rgba(13,13,26,0.85)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          transition: 'color 0.15s, background 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ color: 'var(--green-pos)', fontWeight: 600 }}>{friendsOnline}</span>
          <span>friends online</span>
        </button>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Store */}
        <Link href="/store" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          color: 'var(--text-secondary)', textDecoration: 'none',
          fontSize: '0.9rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          transition: 'color 0.15s, background 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          Store
        </Link>

        {/* Auth */}
        {loading ? (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)' }} />
        ) : !user ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/auth/login" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Log in
            </Link>
            <Link href="/auth/register" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Sign up
            </Link>
          </div>
        ) : (
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button onClick={() => setDropOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: dropOpen ? 'var(--bg-elevated)' : 'none',
              border: '1px solid ' + (dropOpen ? 'var(--border-bright)' : 'transparent'),
              borderRadius: 'var(--radius-md)', padding: '4px 8px 4px 4px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div className={`avatar avatar-${user.avatar}`} style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                {user.displayName[0].toUpperCase()}
              </div>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
                {user.displayName}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 8" fill="none" style={{ color: 'var(--text-muted)', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {dropOpen && (
              <div className="card animate-fade-in" style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                minWidth: '200px', padding: '0.5rem', zIndex: 100,
              }}>
                <DropItem href="/profile" icon={<UserIcon />} label="Profile" />
                <DropItem href="/wallet" icon={<WalletIcon />} label="Wallet" />
                <DropItem href="/leaderboard" icon={<TrophyIcon />} label="Leaderboard" />
                <DropItem href="/settings" icon={<SettingsIcon />} label="Settings" />
                {user.role === 'admin' && (
                  <DropItem href="/admin" icon={<ShieldIcon />} label="Admin Panel" highlight />
                )}
                <div className="divider" style={{ margin: '0.4rem 0' }} />
                <button onClick={logout} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'none', border: 'none', color: 'var(--red-neg)',
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 500, transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <LogOutIcon /> Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function DropItem({ href, icon, label, highlight }: { href: string; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      color: highlight ? 'var(--purple-light)' : 'var(--text-secondary)',
      padding: '8px 10px', borderRadius: 'var(--radius-sm)',
      fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
      transition: 'background 0.15s, color 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = highlight ? 'var(--purple-light)' : 'var(--text-secondary)'; }}
    >
      {icon} {label}
    </Link>
  );
}
