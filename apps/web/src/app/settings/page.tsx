'use client';
import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { api, getErrorMsg } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { SettingsIcon, ShieldIcon, AlertIcon, LanguageIcon, LockIcon } from '@/components/layout/Icons';

export default function SettingsPage() {
  const { user, mutate } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('EN');

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await api.updateMe({ displayName: user.displayName, avatar: user.avatar });
      toast.success('Profile updated');
      mutate();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      toast.success('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem' }}>Settings</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* --- Language --- */}
          <section style={{ 
            background: 'var(--bg-elevated)', padding: '1.5rem', 
            borderRadius: '16px', border: '1px solid var(--border)' 
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon /> General
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LanguageIcon /> Language
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose your preferred language</div>
              </div>
              <div style={{ display: 'flex', background: 'var(--bg-base)', borderRadius: '12px', padding: '4px' }}>
                <button 
                  onClick={() => setLang('EN')}
                  style={{ 
                    padding: '8px 16px', borderRadius: '8px', border: 'none', 
                    background: lang === 'EN' ? 'var(--purple-light)' : 'transparent',
                    color: lang === 'EN' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600, cursor: 'pointer'
                  }}>EN</button>
                <button 
                  onClick={() => setLang('RW')}
                  style={{ 
                    padding: '8px 16px', borderRadius: '8px', border: 'none', 
                    background: lang === 'RW' ? 'var(--purple-light)' : 'transparent',
                    color: lang === 'RW' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600, cursor: 'pointer'
                  }}>RW</button>
              </div>
            </div>
          </section>

          {/* --- Password --- */}
          <section style={{ 
            background: 'var(--bg-elevated)', padding: '1.5rem', 
            borderRadius: '16px', border: '1px solid var(--border)' 
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldIcon /> Security
            </h2>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LockIcon /> Current Password
                </label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  style={{ 
                    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)', 
                    borderRadius: '12px', padding: '0.75rem', color: 'var(--text-primary)' 
                  }} 
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ 
                    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)', 
                    borderRadius: '12px', padding: '0.75rem', color: 'var(--text-primary)' 
                  }} 
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{ 
                    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)', 
                    borderRadius: '12px', padding: '0.75rem', color: 'var(--text-primary)' 
                  }} 
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary" 
                style={{ alignSelf: 'flex-start', padding: '0.75rem 2rem', borderRadius: '12px', marginTop: '0.5rem' }}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* --- Account --- */}
          <section style={{ 
            background: 'var(--bg-elevated)', padding: '1.5rem', 
            borderRadius: '16px', border: '1px solid var(--border)',
            opacity: 0.6, pointerEvents: 'none'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--red-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertIcon /> Danger Zone
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Deleting your account is permanent.</p>
            <button className="btn-secondary" style={{ color: 'var(--red-light)', borderColor: 'var(--red-light)' }}>Delete Account</button>
          </section>

        </div>
      </div>
    </div>
  );
}
