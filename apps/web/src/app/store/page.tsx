'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { api, getErrorMsg } from '@/lib/api';
import { toast } from '@/components/ui/Toast';  
import { TrophyIcon, UserIcon, CyberIcon, NatureIcon, NeonIcon, ClassicIcon } from '@/components/layout/Icons';

const ITEMS = [
  { id: 'avatar_1', name: 'Golden King', type: 'avatar', price: 5000, emoji: <TrophyIcon /> },
  { id: 'avatar_2', name: 'Cyber Punk', type: 'avatar', price: 3500, emoji: <CyberIcon /> },
  { id: 'avatar_3', name: 'Nature Spirit', type: 'avatar', price: 2000, emoji: <NatureIcon /> },
  { id: 'skin_1', name: 'Neon Board', type: 'skin', price: 10000, emoji: <NeonIcon /> },
  { id: 'skin_2', name: 'Classic Wood', type: 'skin', price: 1500, emoji: <ClassicIcon /> },
];

export default function StorePage() {
  const [balance, setBalance] = useState({ real: 0, bonus: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const { data } = await api.getBalance();
      setBalance(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buyItem = async (item: typeof ITEMS[0]) => {
    if (balance.real + balance.bonus < item.price) {
      toast.error('Insufficient balance');
      return;
    }

    const ok = window.confirm(`Buy ${item.name} for ${item.price} RWF?`);
    if (!ok) return;

    try {
      // In a real app, we'd have an api.buyItem(itemId)
      // For now, we simulate a purchase by deducting balance locally or calling a mock
      toast.success(`${item.name} purchased!`);
      // Refresh balance
      fetchBalance();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          marginBottom: '2rem', background: 'var(--bg-elevated)', padding: '1.5rem',
          borderRadius: '16px', border: '1px solid var(--border)'
        }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Marketplace</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Customize your experience</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--purple-light)' }}>
              {loading ? '...' : `${(balance.real + balance.bonus).toLocaleString()} RWF`}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {ITEMS.map(item => (
            <div key={item.id} style={{
              background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)',
              padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
              transition: 'transform 0.2s', cursor: 'default'
            }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{item.emoji}</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{item.name}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>
                {item.type}
              </div>
              
              <div style={{ width: '100%', marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Price</span>
                  <span style={{ fontWeight: 600 }}>{item.price.toLocaleString()} RWF</span>
                </div>
                <button 
                  onClick={() => buyItem(item)}
                  className="btn-primary" 
                  style={{ width: '100%', borderRadius: '12px', fontSize: '0.9rem' }}
                >
                  Purchase
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
